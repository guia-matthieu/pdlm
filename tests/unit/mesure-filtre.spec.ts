import { describe, expect, it } from 'vitest'

import { filtrerVisite } from '@/lib/mesure/filtre'

const CONTEXTE = { host: 'mairie-exemple.fr', siteUmami: '11111111-1111-5111-8111-111111111111' }

const pageVue = (payload: Record<string, unknown>) => ({ type: 'event', payload })

describe('filtrerVisite — liste blanche (I18)', () => {
  it('retire chaque champ hors liste blanche', () => {
    const resultat = filtrerVisite(
      pageVue({
        website: 'autre-site',
        hostname: 'ailleurs.fr',
        url: 'https://mairie-exemple.fr/actualites?utm_source=x#haut',
        referrer: 'https://www.moteur.fr/recherche?q=mairie#r',
        title: 'Actualités',
        screen: '1280x720',
        language: 'fr-FR',
        ip: '8.8.8.8',
        id: 'visiteur-identifie',
        userAgent: 'Faux/1.0',
        timestamp: 1,
        data: { a: 1 },
        tag: 'campagne',
        browser: 'chrome',
        os: 'Mac OS',
        device: 'desktop',
        link: 'x',
        pixel: 'y',
        lcp: 1200,
      }),
      CONTEXTE,
    )
    expect(resultat).toEqual({
      type: 'event',
      payload: {
        website: CONTEXTE.siteUmami,
        hostname: 'mairie-exemple.fr',
        url: '/actualites',
        referrer: 'https://www.moteur.fr/recherche',
        title: 'Actualités',
        screen: '1280x720',
        language: 'fr-FR',
      },
    })
  })

  it('website et hostname viennent du domaine demandé, jamais du client (I19)', () => {
    const r = filtrerVisite(pageVue({ website: 'x', hostname: 'y', url: '/' }), CONTEXTE)
    expect(r?.payload.website).toBe(CONTEXTE.siteUmami)
    expect(r?.payload.hostname).toBe('mairie-exemple.fr')
  })

  it('référent interne : chemin seul', () => {
    const r = filtrerVisite(
      pageVue({ url: '/agenda', referrer: 'https://mairie-exemple.fr/actualites?page=2' }),
      CONTEXTE,
    )
    expect(r?.payload.referrer).toBe('/actualites')
    const relatif = filtrerVisite(
      pageVue({ url: '/agenda', referrer: '/documents?x=1#y' }),
      CONTEXTE,
    )
    expect(relatif?.payload.referrer).toBe('/documents')
  })

  it("titre tronqué à 500 caractères ; écran et langue gardés seulement s'ils sont bien formés", () => {
    const r = filtrerVisite(
      pageVue({
        url: '/',
        title: 'a'.repeat(600),
        screen: '1280x720; DROP',
        language: 'fr-FR-x'.repeat(10),
      }),
      CONTEXTE,
    )
    expect(r?.payload.title).toHaveLength(500)
    expect(r?.payload.screen).toBeUndefined()
    expect(r?.payload.language).toBeUndefined()
  })

  it('seules les pages vues passent', () => {
    expect(filtrerVisite({ type: 'identify', payload: { url: '/' } }, CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({ url: '/', name: 'clic-bouton' }), CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({}), CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({ url: 'javascript:alert(1)' }), CONTEXTE)).toBeNull()
    expect(filtrerVisite('texte', CONTEXTE)).toBeNull()
    expect(filtrerVisite(null, CONTEXTE)).toBeNull()
  })
})
