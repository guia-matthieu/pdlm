// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GET } from '@/app/(frontend)/mesure/script.js/route'
import { viderCacheScript } from '@/lib/mesure/script'
import { SLUGS_RESERVES } from '@/hooks/uniqueSlugParCommune'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import {
  configurerUmami,
  demarrerFauxUmami,
  SCRIPT_FAUX,
  type FauxUmami,
} from '../helpers/fauxUmami'

let payload: Payload
let umami: FauxUmami
let commune: { id: number; host: string }

const script = (host: string) =>
  GET(new Request('http://interne/mesure/script.js', { headers: { 'x-commune-host': host } }))

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'script')
})
afterAll(async () => {
  await supprimerCommuneTest(payload, commune.id)
  await umami.fermer()
})
beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.vider()
  viderCacheScript()
})

describe('/mesure/script.js', () => {
  it('sert le script d’Umami, mis en cache une heure', async () => {
    const r = await script(commune.host)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe(SCRIPT_FAUX)
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(r.headers.get('content-type')).toMatch(/javascript/)
    await script(commune.host)
    expect(umami.recues.filter((q) => q.chemin === '/script.js')).toHaveLength(1)
  })

  it('Umami arrêté sans copie en mémoire : 503', async () => {
    umami.reglages.panne = true
    expect((await script(commune.host)).status).toBe(503)
  })

  it('domaine de la plateforme ou mesure non installée : 404', async () => {
    expect((await script(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`)).status).toBe(404)
    delete process.env.UMAMI_URL
    expect((await script(commune.host)).status).toBe(404)
  })
})

describe('slugs réservés', () => {
  it('mesure et mesure-d-audience ne peuvent pas être des slugs de page', () => {
    expect(SLUGS_RESERVES).toEqual(expect.arrayContaining(['mesure', 'mesure-d-audience']))
  })
})
