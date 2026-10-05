import { describe, expect, it } from 'vitest'

import { composerFrise } from '@/gabarits/frise'
import { GABARITS, gabaritDe } from '@/gabarits/registre'
import { SCENES } from '@/lib/accueil-defauts'
import type { Taille } from '@/gabarits/types'

/**
 * Suite de conformité, point 7 (I31) : chaque pièce du kit rend un SVG bien
 * formé aux trois tailles, chaque scène de SCENES et le héros de repli
 * également. Paramétré par le registre : un gabarit ajouté (Littoral en
 * tâche 8) y passe sans que ce fichier change.
 */

const bienForme = (svg: string, contexte: string) => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
  expect(doc.getElementsByTagName('parsererror'), contexte).toHaveLength(0)
  expect(doc.documentElement.nodeName.toLowerCase(), contexte).toBe('svg')
}

const TAILLES: Taille[] = ['petite', 'moyenne', 'grande']

describe.each(Object.entries(GABARITS))('kit du gabarit %s', (nom, { gabarit, kit, illustrations }) => {
  it('déclare la version 1 du contrat', () => {
    expect(gabarit.versionContrat).toBe(1)
  })

  it.each(Object.keys(kit.pieces))('pièce « %s » : frise bien formée aux trois tailles', (piece) => {
    for (const taille of TAILLES) {
      const { svg, ignorees } = composerFrise(kit, [{ piece, taille }])
      expect(ignorees, `${nom}/${piece}/${taille}`).toEqual([])
      bienForme(svg!, `${nom} pièce ${piece} en ${taille}`)
    }
  })

  it.each(SCENES)('scène « %s » : SVG bien formé en vignette et en bandeau', (scene) => {
    bienForme(illustrations.scene(scene, 480, 600), `${nom} scène ${scene} 480×600`)
    bienForme(illustrations.scene(scene, 960, 400), `${nom} scène ${scene} 960×400`)
  })

  it('héros de repli : SVG bien formé', () => {
    bienForme(illustrations.heros(1600, 660), `${nom} héros`)
  })
})

describe('gabaritDe (décision 18 : registre provisoire à village seul)', () => {
  it('rend le gabarit demandé quand il est au registre', () => {
    expect(gabaritDe('village')).toBe(GABARITS.village)
    expect(gabaritDe(undefined)).toBe(GABARITS.village)
  })

  it('replie toute autre valeur — littoral compris — sur village', () => {
    expect(gabaritDe('littoral')).toBe(GABARITS.village)
    expect(gabaritDe('montagne')).toBe(GABARITS.village)
    expect(gabaritDe(null)).toBe(GABARITS.village)
  })
})
