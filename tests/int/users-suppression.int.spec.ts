import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/**
 * Décision (h) — un opérateur qui supprime son propre compte fait échouer la
 * journalisation : l'entrée « Suppression » créée par `journaliserSuppression`
 * référence l'acteur (`utilisateur`, la FK vers `users`) — mais cet acteur est
 * le compte qu'on vient de supprimer dans la même transaction. L'INSERT de la
 * ligne de journal viole donc la contrainte de clé étrangère (violation brute,
 * pas un message clair), même si la colonne autorise NULL : l'action SET NULL
 * ne s'applique qu'aux lignes déjà existantes, jamais à une nouvelle ligne qui
 * référence une ligne absente. Le hook `beforeDelete` doit refuser
 * explicitement l'auto-suppression, avant que Postgres n'ait à le faire.
 */

let payload: Payload
const EMAIL_OPERATEUR = 'operateur@users-suppr.pdlm.invalid'
const EMAIL_AUTRE = 'autre@users-suppr.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')

const req = (user: unknown) => ({ user }) as unknown as PayloadRequest

beforeAll(async () => {
  payload = await getPayloadClient()
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: '@users-suppr.pdlm.invalid' } },
    overrideAccess: true,
  })
})

describe('Décision (h) — suppression de son propre compte', () => {
  it('refuse la suppression de son propre compte', async () => {
    const operateur = await payload.create({
      collection: 'users',
      data: {
        email: EMAIL_OPERATEUR,
        password: MDP_TEST,
        name: 'Opérateur auto-suppression',
        role: 'operateur',
      },
      overrideAccess: true,
    })

    await expect(
      payload.delete({
        collection: 'users',
        id: operateur.id,
        req: req(operateur),
        overrideAccess: false,
      }),
    ).rejects.toThrow(/propre compte/i)

    const restant = await payload.count({
      collection: 'users',
      where: { id: { equals: operateur.id } },
      overrideAccess: true,
    })
    expect(restant.totalDocs).toBe(1)
  })

  it('autorise la suppression du compte d’un autre utilisateur', async () => {
    const operateur = await payload.find({
      collection: 'users',
      where: { email: { equals: EMAIL_OPERATEUR } },
      limit: 1,
      overrideAccess: true,
    })
    const acteur = operateur.docs[0]

    const autre = await payload.create({
      collection: 'users',
      data: {
        email: EMAIL_AUTRE,
        password: MDP_TEST,
        name: 'Autre compte',
      },
      overrideAccess: true,
    })

    await payload.delete({
      collection: 'users',
      id: autre.id,
      req: req(acteur),
      overrideAccess: false,
    })

    const restant = await payload.count({
      collection: 'users',
      where: { id: { equals: autre.id } },
      overrideAccess: true,
    })
    expect(restant.totalDocs).toBe(0)

    const entree = await payload.find({
      collection: 'journal',
      where: {
        and: [{ type: { equals: 'utilisateur' } }, { message: { contains: EMAIL_AUTRE } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    expect(entree.docs).toHaveLength(1)
    expect(entree.docs[0]?.auteurEmail).toBe(EMAIL_OPERATEUR)
  })
})
