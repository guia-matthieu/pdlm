// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { MESSAGES_MESURE } from '@/hooks/mesureAudience'
import { getPayloadClient } from '@/lib/payload'
import { identifiantSite } from '@/lib/umami/uuid'
import type { User } from '@/payload-types'

import {
  configurerUmami,
  demarrerFauxUmami,
  EQUIPE_TEST,
  type FauxUmami,
} from '../helpers/fauxUmami'

/**
 * Activation de la mesure d'audience d'une commune (spec, section 2), contre
 * un faux Umami. Domaine d'e-mail propre à ce fichier : les suites tournent
 * en parallèle et nettoient leurs comptes par domaine.
 */
const DOMAINE_EMAIL = '@mesure-activation.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')
const S = `${Date.now()}`

let payload: Payload
let umami: FauxUmami
let communeA: number
let communeB: number
let communeC: number
let adminA: User
let adminB: User
let redacteurA: User

const appels = (methode: string, chemin: string) =>
  umami.recues.filter((r) => r.methode === methode && r.chemin === chemin)

async function messagesJournal(commune: number): Promise<string[]> {
  const res = await payload.find({
    collection: 'journal',
    where: { commune: { equals: commune } },
    sort: 'createdAt',
    limit: 100,
    overrideAccess: true,
  })
  return res.docs.map((d) => d.message)
}

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  const mk = async (lettre: string) =>
    (
      await payload.create({
        collection: 'communes',
        data: { nom: `Mesure ${lettre} ${S}`, slug: `mesure-act-${lettre}-${S}`, actif: false },
        overrideAccess: true,
      })
    ).id
  communeA = await mk('a')
  communeB = await mk('b')
  communeC = await mk('c')
  const mkUser = async (nom: string, tenants: User['tenants']) =>
    await payload.create({
      collection: 'users',
      data: { email: `${nom}-${S}${DOMAINE_EMAIL}`, password: MDP_TEST, name: nom, tenants },
      overrideAccess: true,
    })
  adminA = await mkUser('admin-a', [{ tenant: communeA, roles: ['admin'] }])
  adminB = await mkUser('admin-b', [{ tenant: communeB, roles: ['admin'] }])
  redacteurA = await mkUser('redacteur-a', [{ tenant: communeA, roles: ['redacteur'] }])
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: DOMAINE_EMAIL } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: `mesure-act-` } },
    overrideAccess: true,
  })
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.vider()
})

describe('droits', () => {
  it('l’admin d’une autre commune ne peut pas activer', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { mesure: { active: true } },
        user: adminB,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    expect(appels('POST', '/api/websites')).toHaveLength(0)
  })

  it('le rédacteur ne peut pas activer', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { mesure: { active: true } },
        user: redacteurA,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('l’admin de la commune active : site déterministe, partage « vue d’ensemble » seul, journal', async () => {
    const doc = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true } },
      user: adminA,
      overrideAccess: false,
    })
    expect(doc.mesure?.active).toBe(true)
    expect(doc.mesure?.siteUmami).toBe(identifiantSite(communeA))
    expect(doc.mesure?.lienPartage).toMatch(/^https:\/\/stats\.pdlm\.test\/share\/[0-9a-f]{16}$/)
    const creation = JSON.parse(appels('POST', '/api/websites')[0].corps)
    expect(creation.teamId).toBe(EQUIPE_TEST)
    // Sans domaine canonique, le domaine informatif est le sous-domaine de plateforme.
    expect(creation.domain).toBe(`mesure-act-a-${S}.${process.env.PLATFORM_DOMAIN ?? 'localhost'}`)
    const partage = JSON.parse(
      appels('POST', `/api/websites/${identifiantSite(communeA)}/shares`)[0].corps,
    )
    expect(partage.parameters).toEqual({ overview: true })
    expect(await messagesJournal(communeA)).toContain(`${MESSAGES_MESURE.activee} — Mesure a ${S}`)
  })
})

describe('protection des champs écrits par le hook', () => {
  it('un enregistrement sans le groupe mesure ne touche à rien', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    const doc = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { horaires: 'Lundi 9 h – 12 h' },
      overrideAccess: true,
    })
    expect(doc.mesure).toEqual(avant.mesure)
    expect(umami.recues).toHaveLength(0)
  })

  it('siteUmami forgé par le client ignoré', async () => {
    const doc = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { mesure: { siteUmami: 'forge', lienPartage: 'https://ailleurs/' } },
      overrideAccess: true,
    })
    expect(doc.mesure?.siteUmami ?? null).toBeNull()
    expect(doc.mesure?.lienPartage ?? null).toBeNull()
    const surA = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true, siteUmami: identifiantSite(communeB) } },
      overrideAccess: true,
    })
    expect(surA.mesure?.siteUmami).toBe(identifiantSite(communeA))
  })

  it('mesure: null ou lienPartage seul sur une commune active : champs du hook conservés', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: null } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { lienPartage: 'https://ailleurs/' } },
      overrideAccess: true,
    })
    const apres = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    expect(apres.mesure?.active).toBe(true)
    expect(apres.mesure?.siteUmami).toBe(avant.mesure?.siteUmami)
    expect(apres.mesure?.lienPartage).toBe(avant.mesure?.lienPartage)
  })
})

describe('couper puis réactiver', () => {
  const couper = () =>
    payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: false } },
      overrideAccess: true,
    })
  const reactiver = () =>
    payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true } },
      overrideAccess: true,
    })

  it('couper n’appelle pas Umami ; réactiver revérifie sans rien créer ; deux entrées de journal', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    const coupe = await couper()
    expect(coupe.mesure?.siteUmami).toBe(identifiantSite(communeA))
    expect(umami.recues).toHaveLength(0)
    const reactive = await reactiver()
    expect(reactive.mesure?.lienPartage).toBe(avant.mesure?.lienPartage)
    expect(umami.sites.size).toBeGreaterThan(0)
    expect(appels('POST', `/api/websites/${identifiantSite(communeA)}/shares`)).toHaveLength(0)
    const messages = await messagesJournal(communeA)
    expect(messages).toContain(`${MESSAGES_MESURE.desactivee} — Mesure a ${S}`)
    expect(messages.filter((m) => m.startsWith(MESSAGES_MESURE.activee))).toHaveLength(2)
  })

  it('réactivation répare un site disparu d’Umami (même identifiant, nouveau partage)', async () => {
    const id = identifiantSite(communeA)
    await couper()
    umami.sites.delete(id)
    umami.partages.delete(id)
    const reactive = await reactiver()
    expect(reactive.mesure?.siteUmami).toBe(id)
    expect(umami.sites.has(id)).toBe(true)
    expect(appels('POST', `/api/websites/${id}/shares`)).toHaveLength(1)
    expect(reactive.mesure?.lienPartage).toBe(
      `https://stats.pdlm.test/share/${umami.partages.get(id)?.[0].slug}`,
    )
  })

  it('réactivation refusée quand Umami n’est plus installé, même avec un site existant', async () => {
    await couper()
    delete process.env.UMAMI_URL
    await expect(reactiver()).rejects.toThrow(/non installée/)
  })
})

describe('refus', () => {
  it('activation à la création', async () => {
    await expect(
      payload.create({
        collection: 'communes',
        data: {
          nom: `Mesure d ${S}`,
          slug: `mesure-act-d-${S}`,
          actif: false,
          mesure: { active: true },
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/une fois la commune créée/)
  })

  it('Umami arrêté : refus clair, la mesure reste coupée', async () => {
    umami.reglages.panne = true
    await expect(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { mesure: { active: true } },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({
      status: 503,
      isPublic: true,
      message: expect.stringMatching(/ne répond pas ; la mesure reste coupée/),
    })
    const b = await payload.findByID({ collection: 'communes', id: communeB, overrideAccess: true })
    expect(b.mesure?.active ?? false).toBe(false)
  })

  it('Umami non installé : refus', async () => {
    delete process.env.UMAMI_URL
    await expect(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { mesure: { active: true } },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/non installée/)
  })
})

describe('nouvel essai après un échec côté pdlm', () => {
  it('retombe sur le site et le partage déjà créés dans Umami', async () => {
    const id = identifiantSite(communeC)
    umami.sites.set(id, { teamId: EQUIPE_TEST, name: 'C', domain: 'c.fr' })
    umami.partages.set(id, [
      { id: 'p', slug: 'abcdef0123456789', name: 'x', parameters: { overview: true } },
    ])
    const doc = await payload.update({
      collection: 'communes',
      id: communeC,
      data: { mesure: { active: true } },
      overrideAccess: true,
    })
    expect(doc.mesure?.lienPartage).toBe('https://stats.pdlm.test/share/abcdef0123456789')
    expect(appels('POST', `/api/websites/${id}/shares`)).toHaveLength(0)
  })
})
