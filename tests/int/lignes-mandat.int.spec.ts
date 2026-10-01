import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/**
 * Spec RPNT section 8 — les utilisateurs d'une organisation héritent du rôle
 * `mandataire` sur chaque commune qui l'a mandatée, tant que le mandat est actif.
 */

let payload: Payload
const communes: number[] = []
let organisation: number
let agent: { id: number }
let operateur: { id: number }
let adminA: { id: number }
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@lignes.pdlm.invalid'
const ilYA = (ms: number) => new Date(Date.now() - ms).toISOString()
const dans = (ms: number) => new Date(Date.now() + ms).toISOString()
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const idDeRef = (r: unknown) => (r && typeof r === 'object' ? (r as { id: number }).id : r)

/** Comme l'authentification charge `req.user`. */
const charger = async (id: number) => ({
  ...(await payload.findByID({ collection: 'users', id, overrideAccess: true })),
  collection: 'users',
})
const lignes = (u: { tenants?: unknown }) =>
  ((u.tenants ?? []) as Array<{ tenant: unknown; roles: string[] }>).map((l) => ({
    tenant: idDeRef(l.tenant),
    roles: l.roles,
  }))

const mandater = (commune: number, data: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'mandats',
    data: { organisation, commune, ...data },
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getPayloadClient()
  for (const p of ['lig-a', 'lig-b', 'lig-c', 'lig-d', 'lig-e']) {
    communes.push((await creerCommuneActive(payload, p)).id)
  }
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC Lignes', nature: 'epci', siret: '32000000000002' },
      overrideAccess: true,
    })
  ).id
  operateur = await payload.create({
    collection: 'users',
    data: { email: `op${DOMAINE}`, password: MDP_TEST, role: 'operateur' },
    overrideAccess: true,
  })
  adminA = await payload.create({
    collection: 'users',
    data: { email: `admin-a${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communes[0], roles: ['admin'] }] },
    overrideAccess: true,
  })
  // Agent d'une ville qui agit pour ses voisines : rédacteur réel de E.
  agent = await payload.create({
    collection: 'users',
    data: {
      email: `agent${DOMAINE}`,
      password: MDP_TEST,
      organisation,
      tenants: [{ tenant: communes[4], roles: ['redacteur'] }],
    },
    overrideAccess: true,
  })
  await mandater(communes[0]) // A : actif
  await mandater(communes[1], { dateDebut: ilYA(86_400_000), dateFin: ilYA(1000) }) // B : échu
  await mandater(communes[2], { dateDebut: dans(86_400_000) }) // C : futur
  await mandater(communes[4]) // E : rôle réel déjà présent (D6)
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    for (const c of communes) await supprimerCommuneTest(payload, c)
  } catch {
    // base jetable
  }
})

describe('lignes mandataire', () => {
  it('mandat actif : une ligne mandataire', async () => {
    expect(lignes(await charger(agent.id))).toContainEqual({ tenant: communes[0], roles: ['mandataire'] })
  })

  it('mandat échu : aucune ligne', async () => {
    expect(lignes(await charger(agent.id)).map((l) => l.tenant)).not.toContain(communes[1])
  })

  it('mandat futur : aucune ligne', async () => {
    expect(lignes(await charger(agent.id)).map((l) => l.tenant)).not.toContain(communes[2])
  })

  it('rôle réel + mandat sur une autre commune : les deux, le rôle réel intact (D6)', async () => {
    const l = lignes(await charger(agent.id))
    expect(l.filter((x) => x.tenant === communes[4])).toEqual([{ tenant: communes[4], roles: ['redacteur'] }])
    expect(l.map((x) => x.tenant)).toContain(communes[0])
  })

  it('compte sans organisation : inchangé', async () => {
    expect(lignes(await charger(adminA.id))).toEqual([{ tenant: communes[0], roles: ['admin'] }])
  })

  it('lignes mandataire jamais écrites (enregistrement par l’opérateur depuis l’admin)', async () => {
    const affiche = await charger(agent.id)
    await payload.update({
      collection: 'users',
      id: agent.id,
      data: { name: 'Agent renommé', tenants: affiche.tenants },
      req: req(operateur),
      overrideAccess: false,
    })
    // Lecture brute de la base, sans hook : seule la ligne réelle existe.
    const brut = await payload.db.findOne({
      collection: 'users',
      where: { id: { equals: agent.id } },
    })
    expect(lignes(brut as { tenants?: unknown })).toEqual([{ tenant: communes[4], roles: ['redacteur'] }])
  })

  it('D3 : le mandataire ne lit pas les comptes de la commune mandante, mais lit le sien', async () => {
    const moi = await charger(agent.id)
    const res = await payload.find({ collection: 'users', req: req(moi), overrideAccess: false })
    const emails = res.docs.map((u) => u.email)
    expect(emails).toContain(`agent${DOMAINE}`)
    expect(emails).not.toContain(`admin-a${DOMAINE}`)
  })
})
