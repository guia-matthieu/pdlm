// @vitest-environment node
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { effacerHistoriqueMesure } from '@/endpoints/effacerHistoriqueMesure'
import { MESSAGES_MESURE } from '@/hooks/mesureAudience'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

import { configurerUmami, demarrerFauxUmami, type FauxUmami } from '../helpers/fauxUmami'

const DOMAINE_EMAIL = '@mesure-historique.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')
const S = `${Date.now()}`

let payload: Payload
let umami: FauxUmami
let communeA: number
let siteA: string
let adminA: User
let adminB: User
let redacteurA: User
let operateur: User

/** Panne du journal : aucune, sur toute écriture, ou seulement après l'entrée « demandé ». */
type PanneJournal = 'aucune' | 'toutes' | 'apresDemande'

/** Requête Payload complète, comme celle que reçoit le vrai point d'accès. */
async function requete(
  user: User | null,
  id: number,
  panne: PanneJournal,
): Promise<PayloadRequest> {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { id: String(id) }
  if (!user) req.user = null
  if (panne !== 'aucune') {
    let ecritures = 0
    req.payload = Object.create(payload, {
      create: {
        value: (...args: Parameters<Payload['create']>) => {
          ecritures += 1
          if (panne === 'toutes' || ecritures > 1) {
            return Promise.reject(new Error('écriture du journal refusée'))
          }
          return payload.create(...args)
        },
      },
    }) as Payload
  }
  return req
}

const effacer = async (user: User | null, id: number, panne: PanneJournal = 'aucune') =>
  effacerHistoriqueMesure.handler(await requete(user, id, panne))

async function creerCommuneMesuree(lettre: string): Promise<{ id: number; site: string }> {
  const { id } = await payload.create({
    collection: 'communes',
    data: { nom: `Historique ${lettre} ${S}`, slug: `mesure-hist-${lettre}-${S}`, actif: false },
    overrideAccess: true,
  })
  const doc = await payload.update({
    collection: 'communes',
    id,
    data: { mesure: { active: true } },
    overrideAccess: true,
  })
  return { id, site: String(doc.mesure?.siteUmami) }
}

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  ;({ id: communeA, site: siteA } = await creerCommuneMesuree('a'))
  const communeB = (
    await payload.create({
      collection: 'communes',
      data: { nom: `Historique b ${S}`, slug: `mesure-hist-b-${S}`, actif: false },
      overrideAccess: true,
    })
  ).id
  const mkUser = async (nom: string, data: Partial<User>) =>
    await payload.create({
      collection: 'users',
      data: {
        email: `${nom}-${S}${DOMAINE_EMAIL}`,
        password: MDP_TEST,
        name: nom,
        ...data,
      } as User,
      overrideAccess: true,
    })
  adminA = await mkUser('admin-a', { tenants: [{ tenant: communeA, roles: ['admin'] }] })
  adminB = await mkUser('admin-b', { tenants: [{ tenant: communeB, roles: ['admin'] }] })
  redacteurA = await mkUser('redacteur-a', {
    tenants: [{ tenant: communeA, roles: ['redacteur'] }],
  })
  operateur = await mkUser('operateur', { role: 'operateur' })
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: DOMAINE_EMAIL } },
    overrideAccess: true,
  })
  umami.reglages.panne = false
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'mesure-hist-' } },
    overrideAccess: true,
  })
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.reglages.horsEquipe = false
  umami.vider()
})

const remisesAZero = () => umami.recues.filter((r) => r.chemin === `/api/websites/${siteA}/reset`)

async function journalEffacement(commune: number, message: string = MESSAGES_MESURE.effacee) {
  const res = await payload.count({
    collection: 'journal',
    where: { and: [{ commune: { equals: commune } }, { message: { like: message } }] },
    overrideAccess: true,
  })
  return res.totalDocs
}

describe('« Supprimer l’historique »', () => {
  it('refusé à l’admin d’une autre commune, au rédacteur, à l’anonyme', async () => {
    for (const user of [adminB, redacteurA, null]) {
      const r = await effacer(user, communeA)
      expect(r.status).toBe(403)
    }
    expect(remisesAZero()).toHaveLength(0)
  })

  it('l’admin de la commune efface : demande au journal, remise à zéro, puis « effacé »', async () => {
    const r = await effacer(adminA, communeA)
    expect(r.status).toBe(200)
    expect(remisesAZero()).toHaveLength(1)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(1)
    expect(await journalEffacement(communeA)).toBe(1)
  })

  it('l’opérateur aussi', async () => {
    expect((await effacer(operateur, communeA)).status).toBe(200)
  })

  it('Umami refuse : 503 ; au journal, la demande et le refus', async () => {
    const effacees = await journalEffacement(communeA)
    const demandes = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    umami.reglages.horsEquipe = true
    const r = await effacer(operateur, communeA)
    expect(r.status).toBe(503)
    expect((await r.json()).message).toMatch(/rien n’a été effacé/)
    expect(await journalEffacement(communeA)).toBe(effacees)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(demandes + 1)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementRefuse)).toBe(1)
  })

  it('Umami ne répond pas : 504, état incertain annoncé ; la demande reste au journal', async () => {
    const effacees = await journalEffacement(communeA)
    const demandes = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    umami.reglages.panne = true
    const r = await effacer(operateur, communeA)
    expect(r.status).toBe(504)
    expect((await r.json()).message).toMatch(/a peut-être eu lieu/)
    expect(await journalEffacement(communeA)).toBe(effacees)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(demandes + 1)
  })

  it('l’entrée « demandé » est déjà validée quand Umami reçoit la remise à zéro', async () => {
    let visibleAuReset = -1
    umami.reglages.surReset = async () => {
      // Lue par une autre requête que celle du point d'accès : elle doit déjà être validée.
      visibleAuReset = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    }
    const avant = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    try {
      expect((await effacer(operateur, communeA)).status).toBe(200)
    } finally {
      umami.reglages.surReset = undefined
    }
    expect(visibleAuReset).toBe(avant + 1)
  })

  it('effacement confirmé mais journal final en panne : 200, message explicite, la demande reste', async () => {
    const effacees = await journalEffacement(communeA)
    const r = await effacer(operateur, communeA, 'apresDemande')
    expect(r.status).toBe(200)
    expect((await r.json()).message).toMatch(/effacé.*journal/)
    expect(remisesAZero()).toHaveLength(1)
    expect(await journalEffacement(communeA)).toBe(effacees)
  })

  it('journal en panne : Umami n’est pas appelé, rien n’est effacé', async () => {
    const r = await effacer(operateur, communeA, 'toutes')
    expect(r.status).toBe(500)
    expect(remisesAZero()).toHaveLength(0)
  })

  it('commune sans site de mesure : 404', async () => {
    const { id } = await payload.create({
      collection: 'communes',
      data: { nom: `Historique c ${S}`, slug: `mesure-hist-c-${S}`, actif: false },
      overrideAccess: true,
    })
    expect((await effacer(operateur, id)).status).toBe(404)
  })
})

describe('suppression d’une commune', () => {
  it('supprime son site Umami', async () => {
    const { id, site } = await creerCommuneMesuree('d')
    await payload.delete({ collection: 'communes', id, overrideAccess: true })
    expect(
      umami.recues.some((r) => r.methode === 'DELETE' && r.chemin === `/api/websites/${site}`),
    ).toBe(true)
    expect(umami.sites.has(site)).toBe(false)
  })

  it('Umami arrêté : la suppression est refusée, la commune reste', async () => {
    const { id } = await creerCommuneMesuree('e')
    umami.reglages.panne = true
    await expect(
      payload.delete({ collection: 'communes', id, overrideAccess: true }),
    ).rejects.toThrow(/n’a pas été supprimée/)
    umami.reglages.panne = false
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(1)
  })

  it('suppression sans UMAMI_URL : refusée, sauf désinstallation déclarée', async () => {
    const { id, site } = await creerCommuneMesuree('g')
    delete process.env.UMAMI_URL
    await expect(
      payload.delete({ collection: 'communes', id, overrideAccess: true }),
    ).rejects.toThrow(/n’est pas configuré/)
    expect(umami.sites.has(site)).toBe(true)
    process.env.UMAMI_DESINSTALLE = '1'
    try {
      await payload.delete({ collection: 'communes', id, overrideAccess: true })
    } finally {
      delete process.env.UMAMI_DESINSTALLE
    }
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(0)
  })

  it('site déjà absent d’Umami : la suppression passe', async () => {
    const { id, site } = await creerCommuneMesuree('f')
    umami.sites.delete(site)
    await payload.delete({ collection: 'communes', id, overrideAccess: true })
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(0)
  })
})
