import { describe, expect, it } from 'vitest'

import { SCENES } from '@/lib/accueil-defauts'
import {
  COMPOSITION_HEROS,
  COMPOSITIONS,
  PIECES_ILLUSTRATION,
  illustrations,
} from '@/gabarits/village/illustrations'

/** Illustrations de repli du gabarit Village : portage de `illustrations_village.py` (maquette validée le 25/09). */

/** Les 17 pièces de `illustrations_village.py` (`KIT`). */
const PIECES_ILLUSTRATION_PY = [
  'maison',
  'maisonBasse',
  'eglise',
  'sapin',
  'arbre',
  'mairie',
  'ecole',
  'preau',
  'halle',
  'commerce',
  'kiosque',
  'fanions',
  'lavoir',
  'pont',
  'barque',
  'panneau',
  'vigne',
]

// Un chemin SVG bien formé : commandes connues, nombres finis, rien d'autre.
const CHEMIN = /^(?:[MmLlHhVvCcQqAaZz]|-?\d+(?:\.\d+)?|[\s,])+$/

describe('illustrations Village (illustrations_village.py)', () => {
  it('les 17 pièces de la maquette sont portées', () => {
    expect(Object.keys(PIECES_ILLUSTRATION).sort()).toEqual([...PIECES_ILLUSTRATION_PY].sort())
  })

  it('largeurs et hauteurs de la maquette', () => {
    const attendu: Record<string, [number, number]> = {
      maison: [46, 52],
      maisonBasse: [70, 38],
      eglise: [90, 136],
      arbre: [40, 44],
      mairie: [88, 96],
      ecole: [110, 78],
      preau: [64, 42],
      halle: [120, 56],
      commerce: [52, 56],
      kiosque: [80, 62],
      fanions: [120, 34],
      lavoir: [90, 44],
      pont: [170, 34],
      barque: [54, 10],
      panneau: [34, 44],
      vigne: [110, 14],
    }
    for (const [nom, [l, h]] of Object.entries(attendu)) {
      expect([PIECES_ILLUSTRATION[nom].largeur, PIECES_ILLUSTRATION[nom].hauteur], nom).toEqual([
        l,
        h,
      ])
    }
    expect(PIECES_ILLUSTRATION.sapin.largeur).toBeCloseTo(54.6, 5)
    expect(PIECES_ILLUSTRATION.sapin.hauteur).toBe(50)
  })

  it('chaque pièce rend des chemins bien formés (formes, traits, accents)', () => {
    for (const [nom, piece] of Object.entries(PIECES_ILLUSTRATION)) {
      for (const d of [...piece.formes, ...piece.traits, ...piece.accents])
        expect(d, nom).toMatch(CHEMIN)
    }
  })

  it('les compositions des 7 scènes sont celles de SCENES du Python', () => {
    const resume = (nom: (typeof SCENES)[number]) =>
      COMPOSITIONS[nom].pieces.map((l) => `${l.piece}/${l.taille}/${l.ecart}`)
    expect(resume('sentiers')).toEqual([
      'sapin/grande/0',
      'panneau/moyenne/26',
      'arbre/moyenne/90',
      'sapin/moyenne/6',
    ])
    expect(resume('patrimoine')).toEqual(['lavoir/petite/0', 'eglise/grande/10', 'arbre/petite/8'])
    expect(resume('commerces')).toEqual([
      'commerce/moyenne/0',
      'halle/moyenne/8',
      'commerce/petite/8',
    ])
    expect(resume('associations')).toEqual([
      'arbre/grande/0',
      'fanions/moyenne/-12',
      'arbre/grande/-12',
      'kiosque/moyenne/14',
    ])
    expect(resume('ecole')).toEqual(['arbre/grande/0', 'ecole/moyenne/8', 'preau/petite/4'])
    expect(resume('mer')).toEqual(['sapin/moyenne/0', 'pont/moyenne/4', 'barque/petite/18'])
    expect(resume('nature')).toEqual([
      'sapin/grande/0',
      'sapin/moyenne/-6',
      'arbre/grande/10',
      'sapin/grande/8',
    ])
    expect(Object.keys(COMPOSITIONS).sort()).toEqual([...SCENES].sort())
  })

  it('la composition du héros est celle de heros() du Python', () => {
    expect(COMPOSITION_HEROS.map((l) => `${l.piece}/${l.taille}/${l.ecart}`)).toEqual([
      'sapin/grande/0',
      'arbre/moyenne/4',
      'maison/moyenne/18',
      'eglise/grande/4',
      'maisonBasse/moyenne/6',
      'mairie/moyenne/16',
      'arbre/grande/10',
      'maison/petite/6',
      'sapin/grande/20',
      'sapin/moyenne/-8',
    ])
  })

  it('relief propre à chaque scène (chemin, plan d’eau, vigne, oiseaux)', () => {
    const rendu = (n: (typeof SCENES)[number]) => illustrations.scene(n, 480, 400)
    expect(rendu('sentiers')).toContain('class="i-chemin"')
    expect(rendu('mer')).toContain('class="i-eau"')
    expect(rendu('mer')).toContain('class="i-rides"')
    expect(rendu('mer')).not.toContain('class="i-premier"')
    expect(rendu('nature')).toContain('class="i-rangs"')
    expect(rendu('nature')).toContain('class="i-oiseaux"')
    expect(rendu('ecole')).not.toContain('i-chemin')
    expect(rendu('ecole')).toContain('class="i-accents"')
    expect(illustrations.heros(1600, 660)).toContain('class="i-rangs"')
    expect(illustrations.heros(1600, 660)).toContain('class="i-oiseaux"')
  })

  it('aucune couleur littérale dans le rendu : classes et variables seulement', () => {
    for (const s of SCENES)
      expect(illustrations.scene(s, 480, 400)).not.toMatch(
        /#[0-9a-f]{3,8}\b|rgb\(|fill="|stroke="/i,
      )
    expect(illustrations.heros(1600, 660)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|fill="|stroke="/i)
  })

  it('une scène inconnue se replie sur « nature »', () => {
    const inconnue = illustrations.scene('phare' as never, 480, 400)
    expect(inconnue.replace('data-illustration="phare"', '')).toBe(
      illustrations.scene('nature', 480, 400).replace('data-illustration="nature"', ''),
    )
  })
})
