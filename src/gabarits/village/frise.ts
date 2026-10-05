/**
 * Kit de frise du gabarit Village — VERSION PROVISOIRE (décision 18) :
 * six pièces portées telles quelles de la maquette validée
 * `K-village-illustre/frise.py` (géométrie inchangée), le temps que la
 * tâche 5 porte le kit complet. Chaque pièce est dessinée à (x, sol), vers
 * le haut en négatif, à l'échelle `s` ; les couleurs passent par des classes
 * CSS (styles.css), jamais un littéral.
 */

import type { Kit, Taille } from '../types'

/** Arrondi à 2 décimales : des chemins compacts, sans bruit d'arrondi. */
const p = (v: number) => Math.round(v * 100) / 100

type Dessin = { formes: string[]; traits: string[] }

/** Une pièce du kit : son dessin paramétré, sa largeur et sa hauteur hors-tout. */
type Piece = { dessiner(x: number, sol: number, s: number): Dessin; largeur: number; hauteur: number }

export const PIECES: Record<string, Piece> = {
  maison: {
    largeur: 46,
    hauteur: 52,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 30 * s)} L${p(x + 23 * s)} ${p(sol - 52 * s)} L${p(x + 46 * s)} ${p(sol - 30 * s)} V${p(sol)} Z`,
      ],
      traits: [`M${p(x + 10 * s)} ${p(sol - 15 * s)} h${p(7 * s)} M${p(x + 29 * s)} ${p(sol - 15 * s)} h${p(7 * s)}`],
    }),
  },
  maisonBasse: {
    largeur: 70,
    hauteur: 38,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 22 * s)} L${p(x + 14 * s)} ${p(sol - 38 * s)} H${p(x + 56 * s)} L${p(x + 70 * s)} ${p(sol - 22 * s)} V${p(sol)} Z`,
      ],
      traits: [
        `M${p(x + 12 * s)} ${p(sol - 10 * s)} h${p(8 * s)} M${p(x + 31 * s)} ${p(sol - 10 * s)} h${p(8 * s)} M${p(x + 50 * s)} ${p(sol - 10 * s)} h${p(8 * s)}`,
      ],
    }),
  },
  eglise: {
    largeur: 90,
    hauteur: 136,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 34 * s)} L${p(x + 32 * s)} ${p(sol - 58 * s)} L${p(x + 64 * s)} ${p(sol - 34 * s)} V${p(sol)} Z`,
        `M${p(x + 64 * s)} ${p(sol)} V${p(sol - 70 * s)} H${p(x + 88 * s)} V${p(sol)} Z`,
        `M${p(x + 62 * s)} ${p(sol - 70 * s)} L${p(x + 76 * s)} ${p(sol - 122 * s)} L${p(x + 90 * s)} ${p(sol - 70 * s)} Z`,
      ],
      traits: [
        `M${p(x + 76 * s)} ${p(sol - 122 * s)} V${p(sol - 136 * s)} M${p(x + 71 * s)} ${p(sol - 130 * s)} H${p(x + 81 * s)}`,
        `M${p(x + 28 * s)} ${p(sol - 22 * s)} a${p(4 * s)} ${p(4 * s)} 0 1 1 ${p(8 * s)} 0 a${p(4 * s)} ${p(4 * s)} 0 1 1 ${p(-8 * s)} 0`,
      ],
    }),
  },
  sapin: {
    largeur: 55,
    hauteur: 50,
    dessiner: (x, sol, s) => {
      const w = 21 * s
      return {
        formes: [
          `M${p(x)} ${p(sol)} L${p(x + w)} ${p(sol - 17.5 * s)} H${p(x + w * 0.55)} L${p(x + w * 1.1)} ${p(sol - 35 * s)} H${p(x + w * 0.75)} L${p(x + w * 1.3)} ${p(sol - 50 * s)} L${p(x + w * 1.85)} ${p(sol - 35 * s)} H${p(x + w * 1.5)} L${p(x + w * 2.05)} ${p(sol - 17.5 * s)} H${p(x + w * 1.6)} L${p(x + w * 2.6)} ${p(sol)} Z`,
        ],
        traits: [],
      }
    },
  },
  arbre: {
    largeur: 40,
    hauteur: 44,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x + 17 * s)} ${p(sol)} V${p(sol - 20 * s)} H${p(x + 23 * s)} V${p(sol)} Z`,
        `M${p(x)} ${p(sol - 24 * s)} a${p(20 * s)} ${p(20 * s)} 0 1 1 ${p(40 * s)} 0 a${p(20 * s)} ${p(20 * s)} 0 1 1 ${p(-40 * s)} 0 Z`,
      ],
      traits: [],
    }),
  },
  mairie: {
    largeur: 88,
    hauteur: 96,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 40 * s)} H${p(x + 84 * s)} V${p(sol)} Z`,
        `M${p(x - 4 * s)} ${p(sol - 40 * s)} L${p(x + 42 * s)} ${p(sol - 62 * s)} L${p(x + 88 * s)} ${p(sol - 40 * s)} Z`,
        `M${p(x + 36 * s)} ${p(sol - 58 * s)} V${p(sol - 76 * s)} H${p(x + 48 * s)} V${p(sol - 58 * s)} Z`,
      ],
      traits: [
        `M${p(x + 12 * s)} ${p(sol - 22 * s)} h${p(9 * s)} M${p(x + 38 * s)} ${p(sol - 22 * s)} h${p(9 * s)} M${p(x + 64 * s)} ${p(sol - 22 * s)} h${p(9 * s)}`,
        `M${p(x + 42 * s)} ${p(sol - 76 * s)} V${p(sol - 96 * s)}`,
      ],
    }),
  },
}

/** Échelles des trois tailles d'opérateur (maquette `illustrations_village.py`). */
export const TAILLES: Record<Taille, number> = { petite: 0.72, moyenne: 1, grande: 1.3 }

/** L'horizon du Village : deux lignes de collines, courbe lissée de `frise.py`. */
const horizon = () =>
  `<path class="frise__horizon" d="M0 160 L0 96 C130 96 130 70 260 70 C440 70 440 92 620 92 C800 92 800 58 980 58 C1120 58 1120 88 1260 88 C1350 88 1350 110 1440 110 L1440 160 Z"/>`

/** Kit public : les pièces du contrat, à l'échelle de leur taille. */
export const kit: Kit = {
  horizon,
  pieces: Object.fromEntries(
    Object.entries(PIECES).map(([nom, piece]) => [
      nom,
      (x: number, sol: number, taille: Taille) => piece.dessiner(x, sol, TAILLES[taille]),
    ]),
  ),
}
