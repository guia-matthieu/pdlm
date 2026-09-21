import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/**
 * Décision (f) — une commune encore rattachée à des domaines ou des comptes
 * ne peut pas être supprimée en base : `domaines.commune_id` et
 * `users_tenants.tenant_id` sont NOT NULL avec une FK `ON DELETE set null`,
 * ce qui fait échouer la suppression avec une erreur SQL brute (violation de
 * contrainte NOT NULL) plutôt qu'un message clair. Le hook `beforeDelete`
 * doit refuser explicitement, avant que Postgres n'ait à le faire.
 */

let payload: Payload
const EMAIL_OPERATEUR = 'operateur@communes-suppr.pdlm.invalid'
const EMAIL_COMPTE = 'compte@communes-suppr.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')

const req = (user: unknown) => ({ user }) as unknown as PayloadRequest

async function mkCommune(suffixe: string) {
  return payload.create({
    collection: 'communes',
    data: {
      nom: `Suppr ${suffixe}`,
      slug: `communes-suppr-${suffixe}`.toLowerCase(),
      actif: false,
    },
    overrideAccess: true,
  })
}

beforeAll(async () => {
  payload = await getPayloadClient()
  const existant = await payload.find({
    collection: 'users',
    where: { email: { equals: EMAIL_OPERATEUR } },
    limit: 1,
    overrideAccess: true,
  })
  if (existant.docs.length === 0) {
    await payload.create({
      collection: 'users',
      data: {
        email: EMAIL_OPERATEUR,
        password: MDP_TEST,
        name: 'Opérateur suppression communes',
        role: 'operateur',
      },
      overrideAccess: true,
    })
  }
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: '@communes-suppr.pdlm.invalid' } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'communes-suppr-' } },
    overrideAccess: true,
  })
})

describe('Décision (f) — suppression de commune rattachée', () => {
  it('refuse la suppression si un domaine est encore rattaché', async () => {
    const commune = await mkCommune(`domaine${Date.now()}`)
    const domaine = await payload.create({
      collection: 'domaines',
      data: { hostname: `${commune.slug}.example`, commune: commune.id, canonique: false },
      overrideAccess: true,
    })

    await expect(
      payload.delete({ collection: 'communes', id: commune.id, overrideAccess: true }),
    ).rejects.toThrow(/domaine/i)

    const restante = await payload.count({
      collection: 'communes',
      where: { id: { equals: commune.id } },
      overrideAccess: true,
    })
    expect(restante.totalDocs).toBe(1)

    await payload.delete({ collection: 'domaines', id: domaine.id, overrideAccess: true })
  })

  it('refuse la suppression si un compte est encore rattaché', async () => {
    const commune = await mkCommune(`compte${Date.now()}`)
    await payload.create({
      collection: 'users',
      data: {
        email: EMAIL_COMPTE,
        password: MDP_TEST,
        name: 'Compte rattaché',
        tenants: [{ tenant: commune.id, roles: ['admin'] }],
      },
      overrideAccess: true,
    })

    await expect(
      payload.delete({ collection: 'communes', id: commune.id, overrideAccess: true }),
    ).rejects.toThrow(/compte/i)

    const restante = await payload.count({
      collection: 'communes',
      where: { id: { equals: commune.id } },
      overrideAccess: true,
    })
    expect(restante.totalDocs).toBe(1)
  })

  it('autorise la suppression d’une commune sans domaine ni compte', async () => {
    const commune = await mkCommune(`libre${Date.now()}`)

    await payload.delete({
      collection: 'communes',
      id: commune.id,
      req: req(null),
      overrideAccess: true,
    })

    const restante = await payload.count({
      collection: 'communes',
      where: { id: { equals: commune.id } },
      overrideAccess: true,
    })
    expect(restante.totalDocs).toBe(0)
  })
})
