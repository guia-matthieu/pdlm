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
