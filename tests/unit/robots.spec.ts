// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/(frontend)/robots.txt/route'

// La route n'utilise que langueRacine et commune.{id, slug} du site, et
// domainesCommune/basePlateforme pour l'origine du sitemap — le reste de ces
// modules (base de données, headers()) n'a pas à exister ici.
vi.mock('@/lib/commune', () => ({
  resolveSite: vi.fn(async () => ({
    langueRacine: 'fr',
    commune: { id: 42, slug: 'saint-ex' },
  })),
}))

vi.mock('@/lib/contenu', () => ({
  domainesCommune: vi.fn(async () => [
    { hostname: 'saint-ex.fr', langue: 'fr', canonique: true },
  ]),
  basePlateforme: vi.fn(() => 'https://plateforme.test'),
}))

describe('robots.txt — noindex applicatif (retouche AB, démo)', () => {
  const avant = { ...process.env }

  afterEach(() => {
    process.env = { ...avant }
  })

  it('NOINDEX=1 : Disallow: / intégral, sans Sitemap ni appel à la base', async () => {
    process.env.NOINDEX = '1'
    const reponse = await GET()
    expect(reponse.headers.get('content-type')).toBe('text/plain; charset=utf-8')
    expect(await reponse.text()).toBe('User-agent: *\nDisallow: /\n')
    // resolveSite ne doit même pas être consulté en démo
    const { resolveSite } = await import('@/lib/commune')
    expect(resolveSite).not.toHaveBeenCalled()
  })

  it('sans NOINDEX : robots.txt de production inchangé (admin/api interdits, sitemap présent)', async () => {
    delete process.env.NOINDEX
    const reponse = await GET()
    const contenu = await reponse.text()
    expect(contenu).toContain('Disallow: /admin')
    expect(contenu).toContain('Disallow: /api')
    expect(contenu).toContain('Sitemap: https://saint-ex.fr/sitemap.xml')
    expect(contenu).not.toContain('Disallow: /\n')
  })
})
