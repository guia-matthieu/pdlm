import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/** Spec RPNT section 8 — organisations mandataires, tenues par l'opérateur. */

let payload: Payload
let operateur: { id: number }
let simple: { id: number }
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@orga.pdlm.invalid'
const SIRETS = ['20003300000007', '20004400000004']
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest

beforeAll(async () => {
  payload = await getPayloadClient()
  operateur = await payload.create({
    collection: 'users',
    data: { email: `op${DOMAINE}`, password: MDP_TEST, role: 'operateur' },
    overrideAccess: true,
  })
  simple = await payload.create({
    collection: 'users',
    data: { email: `simple${DOMAINE}`, password: MDP_TEST },
    overrideAccess: true,
  })
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({
      collection: 'organisations',
      where: { siret: { in: SIRETS } },
      overrideAccess: true,
    })
  } catch {
    // base jetable
  }
})

describe('organisations', () => {
  it('l’opérateur crée une organisation, SIRET normalisé', async () => {
    const o = await payload.create({
      collection: 'organisations',
      data: { nom: 'CC du Val', nature: 'epci', siret: '200 033 000 00007' },
      req: req(operateur),
      overrideAccess: false,
    })
    expect(o.siret).toBe('20003300000007')
  })

  it('un non-opérateur ne crée pas d’organisation', async () => {
    await expect(
      payload.create({
        collection: 'organisations',
        data: { nom: 'Pirate', nature: 'autre', siret: '20004400000004' },
        req: req(simple),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('un SIRET mal formé est refusé', async () => {
    let erreur: unknown
    try {
      await payload.create({
        collection: 'organisations',
        data: { nom: 'Mal formé', nature: 'autre', siret: '123' },
        overrideAccess: true,
      })
    } catch (e) {
      erreur = e
    }
    expect(erreur).toBeDefined()
    const e = erreur as { data?: { errors?: { message?: string }[] }; message?: string }
    const messages = [e.message ?? '', ...(e.data?.errors ?? []).map((x) => x.message ?? '')]
    expect(messages.join(' | ')).toMatch(/14 chiffres/)
  })

  it('seul l’opérateur rattache un compte à une organisation', async () => {
    const o = await payload.create({
      collection: 'organisations',
      data: { nom: 'Prestataire', nature: 'prestataire', siret: '20004400000004' },
      overrideAccess: true,
    })
    // L'utilisateur tente de se rattacher lui-même : figé par figerPrivileges.
    const apres = await payload.update({
      collection: 'users',
      id: simple.id,
      data: { organisation: o.id },
      req: req(simple),
      overrideAccess: false,
    })
    expect(apres.organisation ?? null).toBeNull()

    const parOperateur = await payload.update({
      collection: 'users',
      id: simple.id,
      data: { organisation: o.id },
      req: req(operateur),
      overrideAccess: false,
    })
    expect(parOperateur.organisation).toBeTruthy()
  })

  it('organisation encore rattachée : suppression refusée en clair', async () => {
    const o = await payload.find({
      collection: 'organisations',
      where: { siret: { equals: '20004400000004' } },
      overrideAccess: true,
    })
    await expect(
      payload.delete({ collection: 'organisations', id: o.docs[0].id, overrideAccess: true }),
    ).rejects.toThrow(/compte\(s\) sont encore rattaché\(s\)/)
  })
})
