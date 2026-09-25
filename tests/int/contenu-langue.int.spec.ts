import type { Payload } from 'payload'

import type { Actualite } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { siteDuHost } from '@/lib/commune'
import {
  communeEnLangue,
  languesDisponibles,
  menuEnLangue,
  pageParSlug,
  versionEnLangue,
  versionsEnLangue,
  actualitesCommune,
} from '@/lib/contenu'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let c: { id: number; host: string }
const texte = (t: string): NonNullable<Actualite['contenu']> => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: null,
  children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null,
    children: [{ type: 'text', text: t, format: 0, version: 1, detail: 0, mode: 'normal', style: '' }] }] } })

beforeAll(async () => {
  payload = await getPayloadClient()
  c = await creerCommuneActive(payload, 'contenu-langue')
  await payload.update({ collection: 'communes', id: c.id, data: { langues: ['co'], horaires: 'Lundi 9h-12h' }, overrideAccess: true })
  await payload.update({ collection: 'communes', id: c.id, locale: 'co', data: { nom: 'Paese' }, overrideAccess: true })
  await payload.create({ collection: 'domaines', data: { hostname: `${c.host}.corsica`, commune: c.id, langue: 'co', canonique: true }, overrideAccess: true })

  const traduite = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Marché', slug: 'marche', _status: 'published', blocs: [{ blockType: 'contact', titre: 'Venez' }] } })
  await payload.update({ collection: 'pages', id: traduite.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Mercatu', blocs: [{ blockType: 'contact', titre: 'Venite' }], traduction: 'validee', _status: 'published' } })
  const aRelire = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Démarches', slug: 'demarches', _status: 'published', blocs: [{ blockType: 'contact', titre: 'Mairie' }] } })
  await payload.update({ collection: 'pages', id: aRelire.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Pratiche', blocs: [{ blockType: 'contact', titre: 'Merria' }], traduction: 'a-relire', _status: 'published' } })

  for (const [slug, titre, trad] of [['a1', 'Une', true], ['a2', 'Deux', false]] as const) {
    const a = await payload.create({ collection: 'actualites', overrideAccess: true,
      data: { tenant: c.id, titre, slug, resume: 'r', contenu: texte('t'), _status: 'published', datePublication: new Date(Date.now() - 86_400_000).toISOString() } })
    if (trad) await payload.update({ collection: 'actualites', id: a.id, locale: 'co', overrideAccess: true,
      data: { titre: 'Una', resume: 'r', contenu: texte('t'), traduction: 'validee', _status: 'published' } })
  }

  const menu = await payload.create({ collection: 'menus', overrideAccess: true,
    data: { tenant: c.id, nom: 'Principal', items: [
      { label: 'Marché', url: '/marche' },
      { label: 'Démarches', url: '/demarches' },
      { label: 'Lien direct', page: traduite.id },
      { label: 'Lien absent', page: aRelire.id },
    ] } })
  await payload.update({ collection: 'menus', id: menu.id, locale: 'co', overrideAccess: true,
    data: { items: [
      { id: menu.items[0].id, label: 'Mercatu', url: '/marche' },
      { id: menu.items[1].id, url: '/demarches' },
      { id: menu.items[2].id, page: traduite.id },
      { id: menu.items[3].id, page: aRelire.id },
    ] } })
})

afterAll(async () => {
  for (const collection of ['pages', 'actualites', 'menus'] as const) {
    await payload.delete({ collection, where: { tenant: { equals: c.id } }, overrideAccess: true })
  }
  await supprimerCommuneTest(payload, c.id)
})

describe('site du host', () => {
  it('donne la langue principale du domaine', async () => {
    expect((await siteDuHost(`${c.host}.corsica`))?.langueRacine).toBe('co')
    expect((await siteDuHost(c.host))?.langueRacine).toBe('fr')
  })
})

describe('règle 1 — page ou fiche', () => {
  it('traduction validée : tout le document en corse', async () => {
    const fr = await pageParSlug(c.id, 'marche')
    const v = await versionEnLangue('pages', fr!, 'co')
    expect(v.langue).toBe('co')
    expect(v.doc.titre).toBe('Mercatu')
    expect(v.doc.blocs?.[0]).toMatchObject({ titre: 'Venite' })
  })

  it('I17 : « à relire » ne s’affiche pas — tout le document en français', async () => {
    const fr = await pageParSlug(c.id, 'demarches')
    const v = await versionEnLangue('pages', fr!, 'co')
    expect(v.langue).toBe('fr')
    expect(v.doc.titre).toBe('Démarches')
    expect(v.doc.blocs?.[0]).toMatchObject({ titre: 'Mairie' })
  })
})

describe('règle 2 — listes', () => {
  it('tous les éléments apparaissent, chacun dans sa langue', async () => {
    const res = await actualitesCommune(c.id)
    const v = await versionsEnLangue('actualites', res.docs, 'co')
    expect(v.map((x) => [x.doc.titre, x.langue])).toEqual(
      expect.arrayContaining([['Una', 'co'], ['Deux', 'fr']]),
    )
    expect(v).toHaveLength(2)
  })
})

describe('règle 3 — petits textes', () => {
  it('libellé de menu non traduit : repli français marqué', async () => {
    const menu = await menuEnLangue(c.id, 'co', new Map())
    expect(menu.map((e) => e.label)).toEqual([
      { texte: 'Mercatu', langue: 'co' },
      { texte: 'Démarches', langue: 'fr' },
    ])
  })

  it('nom traduit, horaires en repli', async () => {
    const commune = await payload.findByID({ collection: 'communes', id: c.id, overrideAccess: true })
    expect(await communeEnLangue(commune, 'co')).toEqual({
      nom: { texte: 'Paese', langue: 'co' },
      horaires: { texte: 'Lundi 9h-12h', langue: 'fr' },
    })
  })

  it('items « page » : href résolu si la page est dans la map fournie, retiré sinon', async () => {
    const marche = await pageParSlug(c.id, 'marche')
    const pages = new Map([[marche!.id, marche!]])
    const menu = await menuEnLangue(c.id, 'fr', pages)
    expect(menu.find((e) => e.label.texte === 'Lien direct')?.href).toBe('/marche')
    expect(menu.some((e) => e.label.texte === 'Lien absent')).toBe(false)
  })
})

describe('langues disponibles (hreflang, sitemap)', () => {
  it('le français toujours, une autre langue seulement validée ET activée', async () => {
    const pages = await payload.find({ collection: 'pages', where: { tenant: { equals: c.id } }, overrideAccess: true })
    const ids = pages.docs.map((p) => p.id)
    const dispo = await languesDisponibles('pages', c.id, ids, ['fr', 'co'])
    const parSlug = Object.fromEntries(pages.docs.map((p) => [p.slug, dispo.get(p.id)]))
    expect(parSlug).toEqual({ marche: ['fr', 'co'], demarches: ['fr'] })
    // Commune qui a retiré le corse : plus annoncé, même validé
    const sansCorse = await languesDisponibles('pages', c.id, ids, ['fr'])
    expect([...sansCorse.values()].every((l) => l.length === 1 && l[0] === 'fr')).toBe(true)
  })

  it('I4 : une page validée d’une autre commune reste au français seul (jamais annoncée traduite)', async () => {
    const autre = await creerCommuneActive(payload, 'contenu-langue-isolee')
    const pageAutre = await payload.create({ collection: 'pages', overrideAccess: true,
      data: { tenant: autre.id, titre: 'Ailleurs', slug: 'ailleurs', _status: 'published', blocs: [{ blockType: 'contact', titre: 'x' }] } })
    await payload.update({ collection: 'pages', id: pageAutre.id, locale: 'co', overrideAccess: true,
      data: { titre: 'Altrò', blocs: [{ blockType: 'contact', titre: 'x' }], traduction: 'validee', _status: 'published' } })
    try {
      const dispo = await languesDisponibles('pages', c.id, [pageAutre.id], ['fr', 'co'])
      expect(dispo.get(pageAutre.id)).toEqual(['fr'])
    } finally {
      await payload.delete({ collection: 'pages', where: { tenant: { equals: autre.id } }, overrideAccess: true })
      await supprimerCommuneTest(payload, autre.id)
    }
  })
})
