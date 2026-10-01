import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/** Spec RPNT section 8, I36 — accorder, retirer, journaliser un mandat. */

let payload: Payload
let communeA: number
let communeB: number
let organisation: number
let operateur: { id: number }
let adminA: { id: number }
let adminB: { id: number }
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@mandats.pdlm.invalid'
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const ilYA = (ms: number) => new Date(Date.now() - ms).toISOString()
const dans = (ms: number) => new Date(Date.now() + ms).toISOString()
const idDeRef = (r: unknown) => (r && typeof r === 'object' ? (r as { id: number }).id : r)

const mkUser = (nom: string, data: Record<string, unknown>) =>
  payload.create({
    collection: 'users',
    data: { email: `${nom}${DOMAINE}`, password: MDP_TEST, ...data },
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'mandat-a')).id
  communeB = (await creerCommuneActive(payload, 'mandat-b')).id
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC Mandats', nature: 'epci', siret: '31000000000001' },
      overrideAccess: true,
    })
  ).id
  operateur = await mkUser('op', { role: 'operateur' })
  adminA = await mkUser('admin-a', { tenants: [{ tenant: communeA, roles: ['admin'] }] })
  adminB = await mkUser('admin-b', { tenants: [{ tenant: communeB, roles: ['admin'] }] })
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    await supprimerCommuneTest(payload, communeA)
    await supprimerCommuneTest(payload, communeB)
  } catch {
    // base jetable
  }
})

describe('accorder un mandat', () => {
  it('l’admin de A accorde un mandat sur A ; accordePar est figé sur lui', async () => {
    const m = await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(m.id).toBeDefined()
    expect(String(idDeRef(m.accordePar))).toBe(String(adminA.id))
    expect(m.dateDebut).toBeTruthy()

    const journal = await payload.find({
      collection: 'journal',
      where: { and: [{ type: { equals: 'mandat' } }, { commune: { equals: communeA } }] },
      overrideAccess: true,
    })
    expect(journal.docs.map((e) => e.message)).toContain(
      `Mandat accordé — CC Mandats pour ${(await payload.findByID({ collection: 'communes', id: communeA, overrideAccess: true })).nom}`,
    )
  })

  it('l’admin de B ne peut pas accorder un mandat sur A', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(adminB),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('doublon actif refusé', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(operateur),
        overrideAccess: false,
      }),
    ).rejects.toThrow('Cette organisation est déjà mandataire de cette commune.')
  })

  it('date de fin avant la date de début refusée', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeB, dateDebut: dans(86_400_000), dateFin: ilYA(0) },
        req: req(operateur),
        overrideAccess: false,
      }),
    ).rejects.toThrow('La date de fin précède la date de début.')
  })
})

describe('lire les mandats', () => {
  it('l’admin de B ne voit pas les mandats de A', async () => {
    const res = await payload.find({
      collection: 'mandats',
      where: { commune: { equals: communeA } },
      req: req(adminB),
      overrideAccess: false,
    })
    expect(res.totalDocs).toBe(0)
  })
})

describe('retirer un mandat (D4)', () => {
  it('l’admin pose la date de fin : « Mandat retiré » au journal ; organisation et commune restent figées', async () => {
    const [m] = (
      await payload.find({
        collection: 'mandats',
        where: { and: [{ organisation: { equals: organisation } }, { commune: { equals: communeA } }] },
        overrideAccess: true,
      })
    ).docs
    const apres = await payload.update({
      collection: 'mandats',
      id: m.id,
      data: { dateFin: ilYA(0), commune: communeB },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(idDeRef(apres.commune)).toBe(communeA)

    const nomA = (await payload.findByID({ collection: 'communes', id: communeA, overrideAccess: true })).nom
    const journal = await payload.find({
      collection: 'journal',
      where: {
        and: [
          { type: { equals: 'mandat' } },
          { message: { like: 'Mandat retiré — CC Mandats' } },
          { communeNom: { equals: nomA } },
        ],
      },
      overrideAccess: true,
    })
    expect(journal.totalDocs).toBe(1)
  })

  it('un mandat retiré ne se rouvre pas', async () => {
    const [m] = (
      await payload.find({
        collection: 'mandats',
        where: { and: [{ organisation: { equals: organisation } }, { commune: { equals: communeA } }] },
        overrideAccess: true,
      })
    ).docs
    await expect(
      payload.update({
        collection: 'mandats',
        id: m.id,
        data: { dateFin: null },
        req: req(adminA),
        overrideAccess: false,
      }),
    ).rejects.toThrow('Un mandat retiré ne se rouvre pas : accordez un nouveau mandat.')
  })

  it('après retrait, un nouveau mandat peut être accordé', async () => {
    const m = await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(m.id).toBeDefined()
  })

  it('seul l’opérateur supprime un mandat', async () => {
    const [m] = (
      await payload.find({ collection: 'mandats', where: { commune: { equals: communeA } }, overrideAccess: true })
    ).docs
    await expect(
      payload.delete({ collection: 'mandats', id: m.id, req: req(adminA), overrideAccess: false }),
    ).rejects.toThrow()
  })
})

describe('suppressions liées', () => {
  it('commune liée par un mandat : suppression refusée en clair', async () => {
    // le contrôle des comptes passe avant celui des mandats : on libère la commune des comptes
    await payload.delete({ collection: 'users', id: adminA.id, overrideAccess: true })
    await payload.update({ collection: 'communes', id: communeA, data: { actif: false }, overrideAccess: true })
    await payload.delete({ collection: 'domaines', where: { commune: { equals: communeA } }, overrideAccess: true })
    await expect(
      payload.delete({ collection: 'communes', id: communeA, overrideAccess: true }),
    ).rejects.toThrow(/mandat\(s\) sont encore rattaché\(s\) à cette commune/)
  })

  it('organisation liée par un mandat : suppression refusée en clair', async () => {
    await expect(
      payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true }),
    ).rejects.toThrow(/mandat\(s\) sont encore rattaché\(s\) à cette organisation/)
  })
})
