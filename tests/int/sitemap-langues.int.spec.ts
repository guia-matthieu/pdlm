import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { siteDuHost } from '@/lib/commune'
import { construireSitemap } from '@/lib/contenu'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let c: { id: number; host: string }

beforeAll(async () => {
  payload = await getPayloadClient()
  c = await creerCommuneActive(payload, 'sitemap-langues')
  await payload.update({ collection: 'communes', id: c.id, data: { langues: ['co'] }, overrideAccess: true })
  await payload.create({ collection: 'domaines', data: { hostname: `${c.host}.corsica`, commune: c.id, langue: 'co', canonique: true }, overrideAccess: true })
  const p = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Marché', slug: 'marche', _status: 'published', blocs: [{ blockType: 'contact' }] } })
  await payload.update({ collection: 'pages', id: p.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Mercatu', blocs: [{ blockType: 'contact' }], traduction: 'validee', _status: 'published' } })
  await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Démarches', slug: 'demarches', _status: 'published', blocs: [{ blockType: 'contact' }] } })
})

afterAll(async () => {
  await payload.delete({ collection: 'pages', where: { tenant: { equals: c.id } }, overrideAccess: true })
  await supprimerCommuneTest(payload, c.id)
})

describe('sitemap par domaine', () => {
  it('domaine français : pages françaises, avec leur version corse en alternative', async () => {
    const xml = await construireSitemap((await siteDuHost(c.host))!)
    expect(xml).toContain(`<loc>https://${c.host}/marche</loc>`)
    expect(xml).toContain(`<loc>https://${c.host}/demarches</loc>`)
    expect(xml).toContain(`hreflang="co" href="https://${c.host}.corsica/marche"`)
    expect(xml).not.toContain(`<loc>https://${c.host}.corsica`)
  })

  it('domaine corse : seulement ce qui existe en corse (rubriques + page validée)', async () => {
    const xml = await construireSitemap((await siteDuHost(`${c.host}.corsica`))!)
    expect(xml).toContain(`<loc>https://${c.host}.corsica/marche</loc>`)
    expect(xml).toContain(`<loc>https://${c.host}.corsica/actualites</loc>`)
    expect(xml).not.toContain('demarches')
  })

  it('I14 : langue retirée → plus rien en corse', async () => {
    await payload.delete({ collection: 'domaines', where: { hostname: { equals: `${c.host}.corsica` } }, overrideAccess: true })
    await payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true })
    const xml = await construireSitemap((await siteDuHost(c.host))!)
    expect(xml).not.toContain('hreflang="co"')
    expect(xml).not.toContain('/co/')
  })
})
