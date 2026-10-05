import { describe, expect, it } from 'vitest'

import { composerFrise } from '@/gabarits/frise'
import { kit } from '@/gabarits/village/frise'
import type { Taille } from '@/gabarits/types'

/**
 * Portage du kit Village (K-village-illustre : `frise.py`, `illustrations_village.py`).
 * Ces tests tiennent la correspondance avec la maquette validée le 25/09 :
 * mêmes pièces, mêmes scènes, mêmes compositions.
 */

const TAILLES: Taille[] = ['petite', 'moyenne', 'grande']

/** Les pièces de `frise.py` (`maison_basse` s'écrit `maisonBasse` côté TypeScript). */
const PIECES_FRISE_PY = ['maison', 'maisonBasse', 'eglise', 'sapin', 'arbre', 'mairie']

// Un chemin SVG bien formé : commandes connues, nombres finis, rien d'autre.
const CHEMIN = /^(?:[MmLlHhVvCcQqAaZz]|-?\d+(?:\.\d+)?|[\s,])+$/

describe('kit de frise Village (frise.py)', () => {
  it.each(PIECES_FRISE_PY)('pièce « %s » du kit, chemins bien formés aux trois tailles', (nom) => {
    expect(Object.hasOwn(kit.pieces, nom)).toBe(true)
    for (const taille of TAILLES) {
      const { formes, traits } = kit.pieces[nom](100, 150, taille)
      expect(formes.length, `${nom}/${taille}`).toBeGreaterThan(0)
      for (const d of [...formes, ...traits]) expect(d, `${nom}/${taille}`).toMatch(CHEMIN)
    }
  })

  it('le kit ne contient que les pièces de frise.py', () => {
    expect(Object.keys(kit.pieces).sort()).toEqual([...PIECES_FRISE_PY].sort())
  })

  it('les trois tailles agrandissent la pièce (0,72 · 1 · 1,3)', () => {
    const haut = (t: Taille) => kit.pieces.eglise(0, 0, t).traits[0] // croix : sommet à -136·s
    expect(haut('petite')).toContain(`V${-136 * 0.72}`)
    expect(haut('moyenne')).toContain('V-136')
    expect(haut('grande')).toContain(`V${-136 * 1.3}`)
  })

  it('l’église reprend la croix de frise.py à l’identique (taille moyenne)', () => {
    const { formes, traits } = kit.pieces.eglise(420, 150, 'moyenne')
    expect(formes[0]).toBe('M420 150 V116 L452 92 L484 116 V150 Z')
    expect(formes[1]).toBe('M484 150 V80 H508 V150 Z')
    expect(formes[2]).toBe('M482 80 L496 28 L510 80 Z')
    expect(traits).toEqual(['M495 28 V14 M490 20 H501'])
  })

  it('seule l’église a un trait dans frise.py (la croix) : les autres pièces sont des aplats', () => {
    for (const nom of PIECES_FRISE_PY.filter((n) => n !== 'eglise')) {
      expect(kit.pieces[nom](0, 150, 'moyenne').traits, nom).toEqual([])
    }
    expect(kit.pieces.eglise(0, 150, 'moyenne').traits).toHaveLength(1)
  })

  it('horizon : la courbe de collines de frise.py (colline(96, 110, …))', () => {
    expect(kit.horizon()).toBe(
      '<path class="frise__horizon" d="M0 160 L0 96 C130 96 130 70 260 70 C440 70 440 92 620 92 C800 92 800 58 980 58 C1120 58 1120 88 1260 88 C1350 88 1350 110 1440 110 L1440 160 Z"/>',
    )
  })

  it('compose par le moteur sans pièce ignorée', () => {
    const lignes = PIECES_FRISE_PY.map((piece) => ({ piece, taille: 'moyenne' as Taille }))
    const { svg, ignorees } = composerFrise(kit, lignes)
    expect(ignorees).toEqual([])
    expect(svg).toContain('aria-hidden="true"')
  })
})
