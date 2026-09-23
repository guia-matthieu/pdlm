import { afterEach, describe, expect, it } from 'vitest'

import { mesureInstallee, siteMesure } from '@/lib/mesure/etat'
import {
  COOKIE_OPPOSITION,
  enteteCookieOpposition,
  estOppose,
  lireCookie,
  soumissionIntersite,
} from '@/lib/mesure/opposition'

describe("cookie d'opposition (I20)", () => {
  it("se lit parmi d'autres cookies", () => {
    expect(lireCookie('a=1; pdlm_mesure=refus; b=2', COOKIE_OPPOSITION)).toBe('refus')
    expect(lireCookie('a=1', COOKIE_OPPOSITION)).toBeUndefined()
    expect(lireCookie(null, COOKIE_OPPOSITION)).toBeUndefined()
    expect(estOppose('refus')).toBe(true)
    expect(estOppose('')).toBe(false)
    expect(estOppose(undefined)).toBe(false)
  })

  it('refus : 390 jours, HttpOnly, SameSite=Lax, Secure en production seulement', () => {
    expect(enteteCookieOpposition('refus', true)).toBe(
      'pdlm_mesure=refus; Max-Age=33696000; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
    expect(enteteCookieOpposition('refus', false)).not.toContain('Secure')
  })

  it('acceptation : le cookie est effacé', () => {
    expect(enteteCookieOpposition('accepte', true)).toBe(
      'pdlm_mesure=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
  })
})

describe('formulaire soumis depuis un autre site', () => {
  const h = (e: Record<string, string>) => new Headers(e)
  it('refusé : autre origine, origine « null », Sec-Fetch-Site intersite', () => {
    expect(soumissionIntersite(h({ origin: 'https://hostile.example' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ origin: 'null' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'cross-site' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'same-site' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ origin: 'https://mairie.fr:8443' }), 'mairie.fr')).toBe(true)
  })
  it('accepté : même origine, ou en-têtes absents', () => {
    expect(soumissionIntersite(h({ origin: 'https://mairie.fr' }), 'mairie.fr')).toBe(false)
    expect(soumissionIntersite(h({ origin: 'http://localhost:3000' }), 'localhost:3000')).toBe(
      false,
    )
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'same-origin' }), 'mairie.fr')).toBe(false)
    expect(soumissionIntersite(h({}), 'mairie.fr')).toBe(false)
  })
})

describe('état de la mesure', () => {
  const avant = process.env.UMAMI_URL
  afterEach(() => {
    if (avant === undefined) delete process.env.UMAMI_URL
    else process.env.UMAMI_URL = avant
  })

  it("sans UMAMI_URL, rien n'est mesuré", () => {
    delete process.env.UMAMI_URL
    expect(mesureInstallee()).toBe(false)
    expect(siteMesure({ mesure: { active: true, siteUmami: 'abc' } })).toBeNull()
    process.env.UMAMI_URL = ''
    expect(mesureInstallee()).toBe(false)
  })

  it("mesurée seulement si active ET dotée d'un site", () => {
    process.env.UMAMI_URL = 'http://umami:3000'
    expect(siteMesure({ mesure: { active: true, siteUmami: 'abc' } })).toBe('abc')
    expect(siteMesure({ mesure: { active: false, siteUmami: 'abc' } })).toBeNull()
    expect(siteMesure({ mesure: { active: true, siteUmami: null } })).toBeNull()
    expect(siteMesure({})).toBeNull()
    expect(siteMesure(null)).toBeNull()
  })
})
