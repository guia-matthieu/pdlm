import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { dictionnaire } from '@/i18n'
import { Actualites } from '@/gabarits/sections/Actualites'
import { Agenda } from '@/gabarits/sections/Agenda'
import { Heros } from '@/gabarits/sections/Heros'
import { Mosaique } from '@/gabarits/sections/Mosaique'
import type { Illustrations } from '@/gabarits/types'

/**
 * Balisage des sections communes que les gabarits mettent en forme : visuels
 * des actualités (I30), date d'agenda en deux parties, variantes, bouton du
 * héros. Kit factice : la scène dit son nom et ses dimensions.
 */
const illustrations: Illustrations = {
  scene: (nom, l, h) => `<svg data-illustration="${nom}" data-format="${l}x${h}"></svg>`,
  heros: (l, h) => `<svg data-illustration="heros" data-format="${l}x${h}"></svg>`,
}
const html = (element: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(element)
const formats = (rendu: string) => [...rendu.matchAll(/data-format="([^"]+)"/g)].map((m) => m[1])
const scenes = (rendu: string) =>
  [...rendu.matchAll(/data-illustration="([^"]+)"/g)].map((m) => m[1])
const lien = (chemin: string) => chemin
const t = dictionnaire('fr')

const actu = (id: number) =>
  ({
    doc: {
      id,
      titre: `Actu ${id}`,
      slug: `actu-${id}`,
      datePublication: '2026-09-22T10:00:00.000Z',
    },
    langue: 'fr',
  }) as never
const image = { id: 9, url: '/api/media/file/a.jpg', alt: 'École', langueAlt: 'fr' } as never

describe('section Actualités', () => {
  const rendre = (variante: 'une' | undefined, images: never[]) =>
    html(
      createElement(Actualites, {
        titre: 'Actualités',
        toutVoir: 'Toutes',
        langue: 'fr',
        actus: [actu(1), actu(2), actu(3)],
        images,
        illustrations,
        variante,
        lien,
      }),
    )

  it('I30 : sans image, chaque actualité reçoit une scène du kit — jamais un visuel vide', () => {
    const rendu = rendre(undefined, [null, null, null] as never[])
    expect(scenes(rendu)).toEqual(['ecole', 'patrimoine', 'associations'])
    expect(formats(rendu)).toEqual(['480x360', '480x360', '480x360'])
    expect(rendu).not.toContain('<img')
  })

  it('une image remplace la scène de son actualité seulement', () => {
    const rendu = rendre(undefined, [image, null, null] as never[])
    expect(rendu).toContain('<img src="/api/media/file/a.jpg" alt="École"')
    expect(scenes(rendu)).toEqual(['patrimoine', 'associations'])
  })

  it('variante « une » : la première en 4:3, les brèves en carré, classe sur la section', () => {
    const rendu = rendre('une', [null, null, null] as never[])
    expect(formats(rendu)).toEqual(['800x600', '400x400', '400x400'])
    expect(rendu).toContain('class="section-actualites section-actualites--une"')
  })

  it('sans variante : pas de classe de variante', () => {
    expect(rendre(undefined, [null, null, null] as never[])).toContain('class="section-actualites"')
  })
})

describe('section Agenda', () => {
  it('le jour et le mois sont balisés à part, l’année reste dans datetime', () => {
    const rendu = html(
      createElement(Agenda, {
        titre: 'Agenda',
        toutVoir: 'Tout',
        langue: 'fr',
        evenements: [
          { doc: { id: 1, titre: 'Marché', dateDebut: '2026-10-04T08:00:00.000Z' }, langue: 'fr' },
        ] as never,
        lien,
        t,
      }),
    )
    expect(rendu).toContain(
      '<time dateTime="2026-10-04T08:00:00.000Z"><b class="section-agenda__jour">4</b> <span class="section-agenda__mois">octobre</span></time>',
    )
  })
})

describe('section Mosaïque', () => {
  const tuiles = ['sentiers', 'patrimoine', 'commerces', 'associations'].map((illustration, i) => ({
    id: String(i),
    libelle: illustration,
    illustration,
    langue: 'fr',
  })) as never
  const rendre = (variante?: 'une-haute') =>
    html(
      createElement(Mosaique, {
        titre: 'Vivre ici',
        langue: 'fr',
        tuiles,
        photos: [null, null, null, null],
        illustrations,
        variante,
      }),
    )

  it('sans variante : toutes les scènes au même format', () => {
    expect(formats(rendre())).toEqual(['480x600', '480x600', '480x600', '480x600'])
    expect(rendre()).toContain('<ul class="mosaique">')
  })

  it('variante « une-haute » : scènes au format de leur case (grande, haute, simples)', () => {
    expect(formats(rendre('une-haute'))).toEqual(['800x640', '400x640', '400x320', '400x320'])
    expect(rendre('une-haute')).toContain('<ul class="mosaique mosaique--une-haute">')
  })
})

describe('section Héros', () => {
  const rendre = (props: {
    photo: never | null
    action?: { href: string; libelle: string } | null
  }) =>
    html(
      createElement(Heros, {
        nom: { texte: 'Valvert', langue: 'fr' },
        langue: 'fr',
        frise: null,
        illustrations,
        cadrage: 'haut',
        ...props,
      }),
    )

  it('sans photo : scène du kit et classe --illustre ; avec photo : --photo', () => {
    expect(rendre({ photo: null })).toContain('section-heros--illustre')
    expect(scenes(rendre({ photo: null }))).toEqual(['heros'])
    expect(rendre({ photo: image })).toContain('section-heros--photo')
    expect(scenes(rendre({ photo: image }))).toEqual([])
  })

  it('I30 : le bouton n’est rendu que si une action est donnée', () => {
    expect(rendre({ photo: null })).not.toContain('section-heros__action')
    expect(rendre({ photo: null, action: null })).not.toContain('section-heros__action')
    expect(
      rendre({ photo: null, action: { href: '#demarches', libelle: 'Faire une démarche' } }),
    ).toContain('<a class="section-heros__action" href="#demarches">Faire une démarche</a>')
  })
})
