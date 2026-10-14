import { describe, expect, it } from 'vitest'

import { composerFrise } from '@/gabarits/frise'
import { illustrations as illustrationsLittoral } from '@/gabarits/littoral/illustrations'
import { kit as kitLittoral } from '@/gabarits/littoral/frise'
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

  it('scène de nom hérité d’Object.prototype : repli « nature », sans exception', () => {
    // Le champ est une liste fermée, mais le repli doit tenir pour tout nom :
    // `constructor`, `toString`… existent sur tout objet via le prototype.
    for (const nomInconnu of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      bienForme(
        illustrations.scene(nomInconnu as never, 480, 600),
        `${nom} scène « ${nomInconnu} » (repli nature)`,
      )
    }
  })

  it('héros de repli : SVG bien formé', () => {
    bienForme(illustrations.heros(1600, 660), `${nom} héros`)
  })

  it('ne laisse aucune saisie de pièce entrer dans le SVG', () => {
    // `piece` est un champ texte libre : le moteur n'assemble que des nombres
    // et les chemins du kit, une saisie hostile ne doit jamais y paraître.
    const premiere = Object.keys(kit.pieces)[0]
    for (const saisie of ['<script>alert(1)</script>', '" onload="x', 'constructor', '</svg><svg onload=x>']) {
      const { svg, ignorees } = composerFrise(kit, [
        { piece: premiere, taille: 'moyenne' },
        { piece: saisie, taille: 'moyenne' },
      ])
      expect(ignorees, saisie).toEqual([saisie])
      expect(svg!, saisie).not.toContain(saisie)
    }
  })
})

/**
 * Cas propres à Littoral (tâche 8), avant son entrée au registre : la liste
 * fermée des 14 pièces de la maquette, des chemins réellement dessinés (des
 * pièces comme `goeland` ou `portique` n'ont que des traits), et le repli
 * sémantique « scène inconnue → nature » (étape 3 du plan).
 */
describe('kit du gabarit littoral (maquette L, 14 pièces)', () => {
  const PIECES = [
    'phare', 'jetee', 'barque', 'voilier', 'cabane', 'pin', 'eglise', 'maison',
    'mairie', 'goeland', 'ecole', 'portique', 'dune', 'rocher',
  ]

  it('expose exactement les 14 pièces de la maquette', () => {
    expect(Object.keys(kitLittoral.pieces).sort()).toEqual([...PIECES].sort())
  })

  it.each(PIECES)('pièce « %s » : des chemins non vides aux trois tailles', (piece) => {
    for (const taille of TAILLES) {
      const { formes, traits } = kitLittoral.pieces[piece](10, 150, taille)
      expect(formes.length + traits.length, `${piece} en ${taille}`).toBeGreaterThan(0)
      for (const d of [...formes, ...traits]) {
        expect(d, `${piece} en ${taille}`).toMatch(/^M/)
      }
    }
  })

  it.each(SCENES)('scène « %s » : un SVG de scène', (scene) => {
    const svg = illustrationsLittoral.scene(scene, 480, 600)
    expect(svg.startsWith('<svg class="scene"')).toBe(true)
    bienForme(svg, `littoral scène ${scene} 480×600`)
  })

  it('scène absente du kit : rendu identique au repli « nature »', () => {
    // `data-illustration` échoit le nom demandé (diagnostic du repli, sur le
    // modèle de Village) : le dessin, lui, doit être exactement celui de nature.
    const sansNom = (svg: string) => svg.replace(/data-illustration="[^"]*"/, 'data-illustration')
    expect(sansNom(illustrationsLittoral.scene('lagune' as never, 480, 600))).toBe(
      sansNom(illustrationsLittoral.scene('nature', 480, 600)),
    )
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
