import type { Payload, PayloadRequest } from 'payload'

import type { Page } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/** I36 — matrice de la spec RPNT section 8, avec le filtre du plugin actif. */

let payload: Payload
let communeA: number
let communeC: number
let organisation: number
let mandatA: number
let agentId: number
let redacteurA: number
let compteC: number
let adminA: { id: number }
let adminAComplet: Record<string, unknown>
let pageA: number
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@i36.pdlm.invalid'
const req = (user: unknown) => ({ user, context: {} }) as unknown as PayloadRequest
const charger = async (id: number) => ({
  ...(await payload.findByID({ collection: 'users', id, overrideAccess: true })),
  collection: 'users',
})
const contenuVide = ({
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [{ type: 'text', version: 1, text: 'Texte', format: 0, detail: 0, mode: 'normal', style: '' }],
      },
    ],
  },
}) as unknown as Extract<NonNullable<Page['blocs']>[number], { blockType: 'texteRiche' }>['contenu']
/** Slug généré par le hook `uniqueSlugParCommune`. */
const SLUG_GENERE = undefined as unknown as string
const page = (titre: string, tenant: number) => ({
  titre,
  slug: SLUG_GENERE,
  _status: 'draft' as const,
  tenant,
  blocs: [{ blockType: 'texteRiche' as const, contenu: contenuVide }],
})

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'i36-a')).id
  communeC = (await creerCommuneActive(payload, 'i36-c')).id
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC I36', nature: 'epci', siret: '33000000000003' },
      overrideAccess: true,
    })
  ).id
  adminA = await payload.create({
    collection: 'users',
    data: { email: `admin-a${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communeA, roles: ['admin'] }] },
    overrideAccess: true,
  })
  adminAComplet = await charger(adminA.id)
  redacteurA = (
    await payload.create({
      collection: 'users',
      data: { email: `redacteur-a${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communeA, roles: ['redacteur'] }] },
      overrideAccess: true,
    })
  ).id
  compteC = (
    await payload.create({
      collection: 'users',
      data: { email: `compte-c${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communeC, roles: ['redacteur'] }] },
      overrideAccess: true,
    })
  ).id
  agentId = (
    await payload.create({
      collection: 'users',
      data: { email: `agent${DOMAINE}`, password: MDP_TEST, organisation },
      overrideAccess: true,
    })
  ).id
  mandatA = (
    await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      overrideAccess: true,
    })
  ).id
  pageA = (
    await payload.create({ collection: 'pages', data: page('Page A', communeA), overrideAccess: true })
  ).id
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'pages', where: { tenant: { in: [communeA, communeC] } }, overrideAccess: true })
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    await supprimerCommuneTest(payload, communeA)
    await supprimerCommuneTest(payload, communeC)
  } catch {
    // base jetable
  }
})

describe('le mandataire peut', () => {
  it('voir la commune mandante, et elle seule', async () => {
    const res = await payload.find({ collection: 'communes', req: req(await charger(agentId)), overrideAccess: false })
    expect(res.docs.map((c) => c.id)).toEqual([communeA])
  })

  it('créer et publier une page sur la commune mandante', async () => {
    const p = await payload.create({
      collection: 'pages',
      data: { ...page('Publiée par le mandataire', communeA), _status: 'published' },
      req: req(await charger(agentId)),
      overrideAccess: false,
    })
    expect(p._status).toBe('published')
  })

  it('ne lister que les pages de la commune mandante', async () => {
    const res = await payload.find({ collection: 'pages', req: req(await charger(agentId)), overrideAccess: false })
    const tenants = res.docs.map((d) => (typeof d.tenant === 'object' ? (d.tenant as { id: number }).id : d.tenant))
    expect(new Set(tenants)).toEqual(new Set([communeA]))
  })
})

describe('le mandataire ne peut pas (I36)', () => {
  it('écrire sur une commune qui ne l’a pas mandaté', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: page('Intrus', communeC),
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('D1 : supprimer une page', async () => {
    await expect(
      payload.delete({ collection: 'pages', id: pageA, req: req(await charger(agentId)), overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('activer ou désactiver la commune, ni toucher à la mesure d’audience', async () => {
    for (const data of [{ actif: false }, { mesure: { active: true } }, { coordonnees: { telephone: '0102030405' } }]) {
      await expect(
        payload.update({
          collection: 'communes',
          id: communeA,
          data,
          req: req(await charger(agentId)),
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })

  it('changer le domaine canonique', async () => {
    await expect(
      payload.create({
        collection: 'domaines',
        data: { hostname: `autre-${Date.now()}.test`, commune: communeA, canonique: false },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('gérer les utilisateurs de la commune', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: adminA.id,
        data: { name: 'Renommé par le mandataire' },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('accorder un mandat, même sur la commune qu’il sert', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})

describe('retrait', () => {
  it('retrait : accès coupé à la requête suivante, trace au journal', async () => {
    await payload.update({
      collection: 'mandats',
      id: mandatA,
      data: { dateFin: new Date().toISOString() },
      req: req(adminAComplet),
      overrideAccess: false,
    })
    await expect(
      payload.create({
        collection: 'pages',
        data: page('Après retrait', communeA),
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const journal = await payload.count({
      collection: 'journal',
      where: {
        and: [
          { type: { equals: 'mandat' } },
          { commune: { equals: communeA } },
          { message: { like: 'Mandat retiré — CC I36' } },
        ],
      },
      overrideAccess: true,
    })
    expect(journal.totalDocs).toBe(1)
  })
})
describe('non-régression — lecture des comptes', () => {
  it('un admin voit les comptes qui ont un rôle réel sur sa commune, pas ceux d’une autre', async () => {
    const res = await payload.find({
      collection: 'users',
      req: req(adminAComplet),
      overrideAccess: false,
      limit: 100,
      pagination: false,
    })
    const ids = res.docs.map((u) => u.id)
    expect(ids).toContain(redacteurA)
    expect(ids).not.toContain(compteC)
  })
})
