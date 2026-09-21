import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/**
 * I6 — les hostnames de la plateforme (domaine racine, www., admin., hôte
 * d'ADMIN_URL, hôte public du stockage) ne peuvent pas devenir le domaine
 * d'une commune : `resolveCommune` servirait sinon le site communal sur une
 * adresse opérationnelle.
 */

let payload: Payload
let commune: number
const envAvant = { ...process.env }

beforeAll(async () => {
  payload = await getPayloadClient()
  // Lu à chaque appel par hostnamesReserves(), après l'initialisation de Payload.
  process.env.PLATFORM_DOMAIN = 'plateforme.test'
  process.env.ADMIN_URL = 'https://gestion.admin-pdlm.test'
  process.env.NEXT_PUBLIC_S3_PUBLIC_URL = 'https://fichiers.stockage-pdlm.test'
  await payload.delete({
    collection: 'domaines',
    where: { hostname: { like: '.domaines-reserves.example' } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'domaines-reserves-' } },
    overrideAccess: true,
  })
  commune = (
    await payload.create({
      collection: 'communes',
      data: { nom: 'Domaines réservés', slug: `domaines-reserves-${Date.now()}`, actif: false },
      overrideAccess: true,
    })
  ).id
})

afterAll(async () => {
  await payload.delete({
    collection: 'domaines',
    where: { commune: { equals: commune } },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'communes', id: commune, overrideAccess: true })
  process.env = { ...envAvant }
})

describe('I6 — hostnames réservés à la plateforme', () => {
  it.each([
    'plateforme.test',
    'www.plateforme.test',
    'admin.plateforme.test',
    'ADMIN.Plateforme.test.',
    'gestion.admin-pdlm.test',
    'fichiers.stockage-pdlm.test',
  ])('refuse la création du domaine %s', async (hostname) => {
    await expect(
      payload.create({
        collection: 'domaines',
        data: { hostname, commune, canonique: false },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/réservé/i)
  })

  it('refuse de renommer un domaine existant en hostname réservé', async () => {
    const domaine = await payload.create({
      collection: 'domaines',
      data: { hostname: 'mairie.domaines-reserves.example', commune, canonique: false },
      overrideAccess: true,
    })
    await expect(
      payload.update({
        collection: 'domaines',
        id: domaine.id,
        data: { hostname: 'admin.plateforme.test' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/réservé/i)
  })
})
