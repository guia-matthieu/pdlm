// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { POST } from '@/app/(frontend)/mesure/opposition/route'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let commune: { id: number; host: string }

const choisir = (host: string, choix: string, entetes: Record<string, string> = {}) =>
  POST(
    new Request(`https://${host}/mesure/opposition`, {
      method: 'POST',
      headers: {
        'x-commune-host': host,
        'content-type': 'application/x-www-form-urlencoded',
        ...entetes,
      },
      body: new URLSearchParams({ choix }).toString(),
    }),
  )

beforeAll(async () => {
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'opposition')
})
afterAll(async () => {
  await supprimerCommuneTest(payload, commune.id)
})

describe('POST /mesure/opposition (I20)', () => {
  it('refus : cookie posé, retour à la page d’information', async () => {
    const r = await choisir(commune.host, 'refus')
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/mesure-d-audience')
    const cookie = r.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^pdlm_mesure=refus; Max-Age=33696000; Path=\/; HttpOnly; SameSite=Lax/)
  })

  it('acceptation : cookie effacé', async () => {
    const r = await choisir(commune.host, 'accepte')
    expect(r.status).toBe(303)
    expect(r.headers.get('set-cookie')).toMatch(/^pdlm_mesure=; Max-Age=0;/)
  })

  it('formulaire soumis depuis un autre site : 403, cookie intact', async () => {
    const cas: Record<string, string>[] = [
      { origin: 'https://site-hostile.example' },
      { origin: 'null' },
      { origin: `https://${commune.host}:8443` },
      { 'sec-fetch-site': 'cross-site' },
    ]
    for (const entetes of cas) {
      const r = await choisir(commune.host, 'accepte', entetes)
      expect(r.status, JSON.stringify(entetes)).toBe(403)
      expect(r.headers.get('set-cookie')).toBeNull()
    }
  })

  it('formulaire de la page elle-même : accepté', async () => {
    const r = await choisir(commune.host, 'refus', {
      origin: `https://${commune.host}`,
      'sec-fetch-site': 'same-origin',
    })
    expect(r.status).toBe(303)
  })

  it('choix invalide : 400 ; domaine de la plateforme : 404', async () => {
    expect((await choisir(commune.host, 'autre')).status).toBe(400)
    expect(
      (await choisir(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`, 'refus')).status,
    ).toBe(404)
  })
})
