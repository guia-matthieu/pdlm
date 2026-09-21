import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/**
 * I12 — une suppression de commune est réellement exécutée ET journalisée.
 *
 * Régression visée : l'entrée de journal référençait la commune qu'on venait de
 * supprimer. La clé étrangère refusait l'insert, Postgres avortait la
 * transaction, le hook avalait l'erreur — et le COMMIT d'une transaction
 * avortée devenant un ROLLBACK muet, `payload.delete` répondait « succès »
 * alors que la commune restait en base, sans aucune trace au journal.
 */

let payload: Payload
let operateur: { id: number }

/**
 * Domaine distinct de `@pdlm.test` : la suite d'isolation supprime ses
 * utilisateurs par `email like '@pdlm.test'`, et les fichiers tournent en parallèle.
 */
const EMAIL_OPERATEUR = 'operateur@journal.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')

const req = (user: unknown) => ({ user }) as unknown as PayloadRequest

beforeAll(async () => {
  payload = await getPayloadClient()
  const existant = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL_OPERATEUR } },
    limit: 1,
    overrideAccess: true,
  })
  operateur =
    existant.docs[0] ??
    (await payload.create({
      collection: 'users',
      data: {
        email: EMAIL_OPERATEUR,
        password: MDP_TEST,
        name: 'Opérateur journal',
        role: 'operateur',
      },
      overrideAccess: true,
    }))
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { equals: EMAIL_OPERATEUR } },
    overrideAccess: true,
  })
})

describe('I12 — suppression de commune', () => {
  it.each(['par id', 'en masse'] as const)(
    'suppression %s : la commune disparaît et la suppression est journalisée',
    async (mode) => {
      const suffixe = `${mode.replace(' ', '')}${Date.now()}`
      const nom = `Journal ${suffixe}`
      const commune = await payload.create({
        collection: 'communes',
        data: { nom, slug: `journal-${suffixe}`.toLowerCase(), actif: false },
        overrideAccess: true,
      })

      const suppression =
        mode === 'par id'
          ? payload.delete({
              collection: 'communes',
              id: commune.id,
              req: req(operateur),
              overrideAccess: false,
            })
          : payload.delete({
              collection: 'communes',
              where: { id: { equals: commune.id } },
              req: req(operateur),
              overrideAccess: false,
            })
      await suppression

      const restante = await payload.count({
        collection: 'communes',
        where: { id: { equals: commune.id } },
        overrideAccess: true,
      })
      expect(restante.totalDocs).toBe(0)

      const entrees = await payload.find({
        collection: 'journal',
        where: { message: { like: nom } },
        depth: 0,
        overrideAccess: true,
      })
      const suppressions = entrees.docs.filter((e) => e.message.startsWith('Suppression'))
      expect(suppressions).toHaveLength(1)
      expect(suppressions[0].type).toBe('commune')
      expect(suppressions[0].utilisateur).toBe(operateur.id)
    },
  )
})
