// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { POST } from '@/app/(frontend)/mesure/api/send/route'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { configurerUmami, demarrerFauxUmami, type FauxUmami } from '../helpers/fauxUmami'

/**
 * I18 — rien d'autre que la liste blanche et l'IP tronquée ne sort vers Umami.
 * I19 — Umami ne reçoit que les visites d'une commune mesurée, sous son site.
 * I20 — un visiteur opposé n'est pas transmis.
 */
let payload: Payload
let umami: FauxUmami
let a: { id: number; host: string }
let b: { id: number; host: string }
let siteA: string

const PAGE_VUE = {
  type: 'event',
  payload: { website: 'x', hostname: 'x', url: 'https://ignore/actualites', title: 'Actus' },
}

function envoyer(host: string, corps: unknown, entetes: Record<string, string> = {}) {
  return POST(
    new Request('http://interne/mesure/api/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
        'x-commune-host': host,
        ...entetes,
      },
      body: typeof corps === 'string' ? corps : JSON.stringify(corps),
    }),
  )
}

const envois = () => umami.recues.filter((r) => r.chemin === '/api/send')

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  a = await creerCommuneActive(payload, 'relais-a')
  b = await creerCommuneActive(payload, 'relais-b')
  const doc = await payload.update({
    collection: 'communes',
    id: a.id,
    data: { mesure: { active: true } },
    overrideAccess: true,
  })
  siteA = String(doc.mesure?.siteUmami)
})

afterAll(async () => {
  await supprimerCommuneTest(payload, a.id)
  await supprimerCommuneTest(payload, b.id)
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.reglages.delaiEnvoiMs = 0
  umami.vider()
})

describe('I18 — ce qui sort vers Umami', () => {
  it('liste blanche, IP de droite tronquée, en-têtes limités, réponse d’Umami renvoyée', async () => {
    const reponse = await envoyer(
      a.host,
      {
        type: 'event',
        payload: {
          website: 'autre',
          hostname: 'ailleurs.fr',
          url: `https://${a.host}/actualites?utm_source=x#haut`,
          referrer: 'https://moteur.fr/recherche?q=mairie',
          screen: '1280x720',
          language: 'fr-FR',
          ip: '8.8.8.8',
          id: 'visiteur',
          userAgent: 'Faux/1.0',
          data: { a: 1 },
        },
      },
      {
        'x-forwarded-for': '1.2.3.4, 90.84.235.17',
        'cf-ipcity': 'Paris',
        'cf-ipcountry': 'FR',
        'x-umami-cache': 'jeton-precedent',
        cookie: 'autre=1',
      },
    )
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ cache: 'jeton-faux', sessionId: 's', visitId: 'v' })

    const [recu] = envois()
    expect(JSON.parse(recu.corps)).toEqual({
      type: 'event',
      payload: {
        website: siteA,
        hostname: a.host,
        url: '/actualites',
        referrer: 'https://moteur.fr/recherche',
        screen: '1280x720',
        language: 'fr-FR',
      },
    })
    expect(recu.entetes['x-pdlm-ip']).toBe('90.84.235.0')
    expect(recu.entetes['user-agent']).toBe('Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0')
    expect(recu.entetes['x-umami-cache']).toBe('jeton-precedent')
    for (const interdit of [
      'x-forwarded-for',
      'cf-ipcity',
      'cf-ipcountry',
      'cookie',
      'x-commune-host',
    ]) {
      expect(recu.entetes[interdit], interdit).toBeUndefined()
    }
  })

  it('sans X-Forwarded-For (développement) : pas d’en-tête d’IP', async () => {
    await envoyer(a.host, PAGE_VUE)
    expect(envois()[0].entetes['x-pdlm-ip']).toBeUndefined()
  })

  it('alias www : comptée, sous l’hôte demandé', async () => {
    const r = await envoyer(`www.${a.host}`, PAGE_VUE)
    expect(r.status).toBe(200)
    expect(JSON.parse(envois()[0].corps).payload.hostname).toBe(`www.${a.host}`)
  })
})

describe('I19 / I20 — ce qui n’est pas transmis', () => {
  it('domaine d’une autre commune (mesure coupée), même avec le site de A dans le corps', async () => {
    const r = await envoyer(b.host, {
      ...PAGE_VUE,
      payload: { ...PAGE_VUE.payload, website: siteA },
    })
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('domaine de la plateforme', async () => {
    const r = await envoyer(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`, PAGE_VUE)
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('cookie d’opposition présent', async () => {
    const r = await envoyer(a.host, PAGE_VUE, { cookie: 'x=1; pdlm_mesure=refus' })
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('événement nommé, identification, corps illisible, corps trop gros', async () => {
    expect(
      (await envoyer(a.host, { ...PAGE_VUE, payload: { ...PAGE_VUE.payload, name: 'clic' } }))
        .status,
    ).toBe(204)
    expect((await envoyer(a.host, { type: 'identify', payload: { url: '/' } })).status).toBe(204)
    expect((await envoyer(a.host, '{pas du json')).status).toBe(400)
    expect((await envoyer(a.host, 'x'.repeat(4097))).status).toBe(413)
    expect(envois()).toHaveLength(0)
  })

  it('corps fragmenté sans Content-Length : coupé à la limite (413)', async () => {
    let envoyes = 0
    const flux = new ReadableStream<Uint8Array>({
      pull(controleur) {
        envoyes += 1
        if (envoyes > 1000)
          controleur.close() // ~2 Mo si rien ne coupait la lecture
        else controleur.enqueue(new Uint8Array(2000).fill(120))
      },
    })
    const r = await POST(
      new Request('http://interne/mesure/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-commune-host': a.host },
        body: flux,
        duplex: 'half',
      } as RequestInit),
    )
    expect(r.status).toBe(413)
    expect(envoyes).toBeLessThan(10)
    expect(envois()).toHaveLength(0)
  })

  it('mesure non installée : 404', async () => {
    delete process.env.UMAMI_URL
    expect((await envoyer(a.host, PAGE_VUE)).status).toBe(404)
  })
})

describe('Umami lent ou arrêté', () => {
  it('Umami arrêté : 204 au visiteur', async () => {
    umami.reglages.panne = true
    expect((await envoyer(a.host, PAGE_VUE)).status).toBe(204)
  })

  it('Umami lent : 204 en moins de 4 s', async () => {
    umami.reglages.delaiEnvoiMs = 10_000
    const debut = Date.now()
    const r = await envoyer(a.host, PAGE_VUE)
    expect(r.status).toBe(204)
    expect(Date.now() - debut).toBeLessThan(4000)
  })
})
