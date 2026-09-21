import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/**
 * I6 — une commune active doit posséder un domaine canonique. Le contrôle
 * (`beforeChange` de `Communes`) compare `commune_id` à
 * `originalDoc?.id ?? data.id` — sur une CRÉATION, ni l'un ni l'autre
 * n'existe encore (Postgres n'assigne l'id qu'après l'insert), donc la
 * requête reçoit un id absent et Postgres répond une erreur brute
 * (« invalid input syntax for type integer: "NaN" ») au lieu du message
 * clair prévu. Aucun domaine ne peut de toute façon référencer une commune
 * qui n'existe pas encore : le cas est donc à traiter sans même interroger
 * la base.
 */

let payload: Payload

afterAll(async () => {
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'communes-activation-' } },
    overrideAccess: true,
  })
})

describe('I6 — activation d’une commune à la création', () => {
  beforeAll(async () => {
    payload = await getPayloadClient()
  })

  it('refuse avec un message clair la création d’une commune active sans domaine canonique', async () => {
    const suffixe = `${Date.now()}`
    await expect(
      payload.create({
        collection: 'communes',
        data: {
          nom: `Activation ${suffixe}`,
          slug: `communes-activation-${suffixe}`,
          actif: true,
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/domaine canonique/i)

    const restante = await payload.count({
      collection: 'communes',
      where: { slug: { equals: `communes-activation-${suffixe}` } },
      overrideAccess: true,
    })
    expect(restante.totalDocs).toBe(0)
  })
})
