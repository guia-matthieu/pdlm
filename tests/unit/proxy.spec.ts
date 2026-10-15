// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { proxy } from '@/proxy'

const requete = (host: string, chemin: string) =>
  new NextRequest(`https://${host}${chemin}`, { headers: { host } })

describe('proxy — /admin sur un domaine communal (I7)', () => {
  const avant = { ...process.env }

  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
  })

  afterEach(() => {
    process.env = { ...avant }
  })

  it('redirige vers ADMIN_URL quand elle est configurée', () => {
    process.env.ADMIN_URL = 'https://admin.plateforme.test/'
    const reponse = proxy(requete('mairie-a.fr', '/admin/collections/pages'))
    expect(reponse.status).toBe(307)
    expect(reponse.headers.get('location')).toBe(
      'https://admin.plateforme.test/admin/collections/pages',
    )
  })

  it('refuse (404) quand ADMIN_URL est absente, au lieu de servir l’admin', () => {
    delete process.env.ADMIN_URL
    const reponse = proxy(requete('mairie-a.fr', '/admin'))
    expect(reponse.status).toBe(404)
  })

  it('sert l’admin sur le domaine de la plateforme', () => {
    delete process.env.ADMIN_URL
    const reponse = proxy(requete('admin.plateforme.test', '/admin'))
    expect(reponse.status).toBe(200)
    expect(reponse.headers.get('x-middleware-next')).toBe('1')
  })
})

describe('I7 / I19 — chemins de la mesure d’audience', () => {
  it.each(['/mesure/api/send', '/mesure/script.js', '/mesure/opposition'])(
    '%s : un x-commune-host forgé par le client est écrasé par le host réel',
    (chemin) => {
      const reponse = proxy(
        new NextRequest(`https://mairie-a.fr${chemin}`, {
          method: 'POST',
          headers: { host: 'mairie-a.fr', 'x-commune-host': 'mairie-b.fr' },
        }),
      )
      // NextResponse.next({ request: { headers } }) transmet l'en-tête réécrit
      // sous ce nom (next/dist/server/web/spec-extension/response.js).
      expect(reponse.headers.get('x-middleware-request-x-commune-host')).toBe('mairie-a.fr')
    },
  )
})

describe('proxy — aperçu d’apparence (décision 13)', () => {
  const avant = { ...process.env }

  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
  })

  afterEach(() => {
    process.env = { ...avant }
  })

  it('répond 404 sur un domaine communal, comme pour l’API', () => {
    expect(proxy(requete('mairie-a.fr', '/apercu/apparence')).status).toBe(404)
    expect(proxy(requete('mairie-a.fr', '/apercu')).status).toBe(404)
  })

  it('sert l’aperçu sur la plateforme, sans réécriture de langue', () => {
    // La route vit hors de `[lang]` : si le bloc d’aperçu laissait passer le
    // chemin jusqu’à l’aiguillage, `/apercu/apparence` deviendrait
    // `/racine/apercu/apparence` et la route ne serait jamais atteinte.
    const reponse = proxy(requete('admin.plateforme.test', '/apercu/apparence'))
    expect(reponse.headers.get('x-middleware-next')).toBe('1')
    expect(reponse.headers.get('x-middleware-rewrite')).toBeNull()
  })
})

describe('proxy — aiguillage des langues', () => {
  const avant = { ...process.env }
  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
  })
  afterEach(() => {
    process.env = { ...avant }
  })

  it('réécrit un chemin sans préfixe vers la sentinelle, sans rediriger', () => {
    const reponse = proxy(requete('pigna.fr', '/marche?x=1'))
    expect(reponse.status).toBe(200)
    const cible = new URL(reponse.headers.get('x-middleware-rewrite') ?? '')
    expect(cible.pathname).toBe('/racine/marche')
    expect(cible.search).toBe('?x=1')
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/marche?x=1')
  })

  it('laisse passer un chemin préfixé', () => {
    const reponse = proxy(requete('pigna.fr', '/co/marche'))
    expect(reponse.headers.get('x-middleware-rewrite')).toBeNull()
    expect(reponse.headers.get('x-middleware-next')).toBe('1')
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/co/marche')
  })

  it('écrase un x-pdlm-chemin forgé par le client', () => {
    const reponse = proxy(
      new NextRequest('https://pigna.fr/marche', {
        headers: { host: 'pigna.fr', 'x-pdlm-chemin': '/co/autre' },
      }),
    )
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/marche')
  })

  it('ne réécrit ni le sitemap ni les routes de mesure', () => {
    for (const chemin of ['/sitemap.xml', '/robots.txt', '/mesure/api/send']) {
      expect(proxy(requete('pigna.fr', chemin)).headers.get('x-middleware-rewrite'), chemin).toBeNull()
    }
  })
})
