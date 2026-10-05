/**
 * Illustrations du gabarit Village — VERSION PROVISOIRE (décision 18) :
 * les scènes composent les six pièces du kit provisoire sur le relief du
 * Village (collines, sol, plan d'eau pour « mer »), dans la structure de la
 * maquette `K-village-illustre/illustrations_village.py` (mêmes classes
 * i-ciel, i-soleil…, couleurs par styles.css). La tâche 5 porte le kit
 * complet et ses scènes dessinées. Couleurs : par classes CSS, jamais en dur.
 */

import type { Illustrations, Scene, Taille } from '../types'
import { PIECES, TAILLES } from './frise'

const p = (v: number) => Math.round(v * 100) / 100

type Ligne = { piece: string; taille: Taille; ecart: number }

/** Compositions provisoires : peu de pièces, une scène doit se lire en vignette. */
const COMPOSITIONS: Record<Scene, { pieces: Ligne[]; eau?: boolean; soleilX: number }> = {
  sentiers: {
    pieces: [
      { piece: 'sapin', taille: 'grande', ecart: 0 },
      { piece: 'arbre', taille: 'moyenne', ecart: 70 },
      { piece: 'sapin', taille: 'moyenne', ecart: 12 },
    ],
    soleilX: 0.22,
  },
  patrimoine: {
    pieces: [
      { piece: 'eglise', taille: 'grande', ecart: 0 },
      { piece: 'arbre', taille: 'petite', ecart: 10 },
      { piece: 'maison', taille: 'petite', ecart: 12 },
    ],
    soleilX: 0.8,
  },
  commerces: {
    pieces: [
      { piece: 'maisonBasse', taille: 'moyenne', ecart: 0 },
      { piece: 'maison', taille: 'moyenne', ecart: 14 },
      { piece: 'maison', taille: 'petite', ecart: 8 },
      { piece: 'arbre', taille: 'petite', ecart: 14 },
    ],
    soleilX: 0.2,
  },
  associations: {
    pieces: [
      { piece: 'arbre', taille: 'grande', ecart: 0 },
      { piece: 'maison', taille: 'grande', ecart: 22 },
      { piece: 'arbre', taille: 'moyenne', ecart: 14 },
      { piece: 'maisonBasse', taille: 'petite', ecart: 10 },
    ],
    soleilX: 0.78,
  },
  ecole: {
    pieces: [
      { piece: 'maisonBasse', taille: 'grande', ecart: 0 },
      { piece: 'maison', taille: 'moyenne', ecart: 18 },
      { piece: 'arbre', taille: 'petite', ecart: 12 },
    ],
    soleilX: 0.25,
  },
  // « mer » au Village : un plan d'eau (étang), le reste de la colline.
  mer: {
    pieces: [
      { piece: 'sapin', taille: 'moyenne', ecart: 0 },
      { piece: 'maison', taille: 'petite', ecart: 26 },
      { piece: 'arbre', taille: 'moyenne', ecart: 20 },
    ],
    eau: true,
    soleilX: 0.7,
  },
  nature: {
    pieces: [
      { piece: 'sapin', taille: 'grande', ecart: 0 },
      { piece: 'sapin', taille: 'moyenne', ecart: 10 },
      { piece: 'arbre', taille: 'grande', ecart: 14 },
      { piece: 'sapin', taille: 'grande', ecart: 8 },
    ],
    soleilX: 0.3,
  },
}

function largeur(lignes: Ligne[], zoom: number): number {
  return lignes.reduce(
    (total, { piece, taille, ecart }) =>
      total + (ecart + (PIECES[piece]?.largeur ?? 0) * TAILLES[taille]) * zoom,
    0,
  )
}

function hauteurMax(lignes: Ligne[]): number {
  return Math.max(...lignes.map(({ piece, taille }) => (PIECES[piece]?.hauteur ?? 60) * TAILLES[taille]))
}

/** Les pièces posées de gauche à droite sur `sol`, chaque groupe translaté. */
function composer(lignes: Ligne[], sol: number, zoom: number, depart: number) {
  let x = depart
  const formes: string[] = []
  const traits: string[] = []
  const chemin = (d: string) => `<path d="${d}"/>`
  for (const { piece, taille, ecart } of lignes) {
    const dessin = PIECES[piece]
    if (!dessin) continue
    x += ecart * zoom
    const s = TAILLES[taille] * zoom
    const rendu = dessin.dessiner(0, 0, s)
    formes.push(`<g transform="translate(${p(x)} ${p(sol)})">${rendu.formes.map(chemin).join('')}</g>`)
    if (rendu.traits.length > 0) {
      traits.push(`<g transform="translate(${p(x)} ${p(sol)})">${rendu.traits.map(chemin).join('')}</g>`)
    }
    x += dessin.largeur * s
  }
  return { formes: formes.join(''), traits: traits.join('') }
}

/** Ligne de collines lissée, fermée jusqu'en bas (même courbe que `frise.py`). */
function colline(w: number, h: number, pts: Array<[number, number]>): string {
  const points: Array<[number, number]> = [
    [0, pts[0][1]],
    ...pts.map(([fx, y]) => [fx * w, y] as [number, number]),
    [w, pts[pts.length - 1][1]],
  ]
  let d = `M0 ${p(h)} L0 ${p(points[0][1])}`
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i]
    const [x1, y1] = points[i + 1]
    const cx = (x0 + x1) / 2
    d += ` C${p(cx)} ${p(y0)} ${p(cx)} ${p(y1)} ${p(x1)} ${p(y1)}`
  }
  return `${d} L${p(w)} ${p(h)} Z`
}

function decor(w: number, h: number, sol: number, soleilX: number, eau: boolean) {
  return (
    `<rect class="i-ciel" width="${p(w)}" height="${p(h)}"/>` +
    `<circle class="i-soleil" cx="${p(w * soleilX)}" cy="${p(h * 0.24)}" r="${p(Math.min(w, h) * 0.09)}"/>` +
    `<path class="i-loin" d="${colline(w, h, [
      [0.2, sol - h * 0.2],
      [0.55, sol - h * 0.1],
      [0.85, sol - h * 0.24],
    ])}"/>` +
    `<path class="i-mi" d="${colline(w, h, [
      [0.15, sol - h * 0.07],
      [0.5, sol - h * 0.02],
      [0.8, sol - h * 0.09],
    ])}"/>` +
    (eau
      ? `<rect class="i-eau" y="${p(sol - 2)}" width="${p(w)}" height="${p(h - sol + 2)}"/>`
      : `<rect class="i-sol" y="${p(sol - 0.5)}" width="${p(w)}" height="${p(h - sol + 0.5)}"/>`)
  )
}

export const illustrations: Illustrations = {
  /**
   * Scène de repli d'une tuile sans photo (I30). Nom inconnu du kit →
   * « nature » (spec : une scène absente se replie sur nature).
   */
  scene(nom, w, h) {
    // `hasOwn` coupe les noms hérités du prototype (`constructor`, …), qui
    // sinon existeraient sans être des scènes — le repli tient pour tout nom.
    const composition = Object.hasOwn(COMPOSITIONS, nom) ? COMPOSITIONS[nom] : COMPOSITIONS.nature
    const sol = h * 0.74
    const l = largeur(composition.pieces, 1)
    const zoom = Math.min(3.4, (w * 0.8) / l, (sol - h * 0.1) / hauteurMax(composition.pieces))
    const { formes, traits } = composer(
      composition.pieces,
      sol,
      zoom,
      (w - largeur(composition.pieces, zoom)) / 2,
    )
    const premier = composition.eau
      ? ''
      : `<path class="i-premier" d="${colline(w, h, [
          [0.25, sol + h * 0.1],
          [0.6, sol + h * 0.06],
          [0.9, sol + h * 0.12],
        ])}"/>`
    return (
      `<svg class="scene" data-illustration="${nom}" viewBox="0 0 ${p(w)} ${p(h)}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">` +
      decor(w, h, sol, composition.soleilX, composition.eau ?? false) +
      `<g class="i-formes">${formes}</g><g class="i-traits">${traits}</g>` +
      premier +
      `</svg>`
    )
  },

  /** Héros sans photo : le village à droite, le ciel à gauche laissé au titre. */
  heros(w, h) {
    const pieces: Ligne[] = [
      { piece: 'sapin', taille: 'grande', ecart: 0 },
      { piece: 'arbre', taille: 'moyenne', ecart: 4 },
      { piece: 'maison', taille: 'moyenne', ecart: 18 },
      { piece: 'eglise', taille: 'grande', ecart: 4 },
      { piece: 'maisonBasse', taille: 'moyenne', ecart: 6 },
      { piece: 'mairie', taille: 'moyenne', ecart: 16 },
      { piece: 'arbre', taille: 'grande', ecart: 10 },
      { piece: 'maison', taille: 'petite', ecart: 6 },
      { piece: 'sapin', taille: 'grande', ecart: 20 },
      { piece: 'sapin', taille: 'moyenne', ecart: -8 },
    ]
    const zoom = 1.1
    const sol = h * 0.86
    const { formes, traits } = composer(pieces, sol, zoom, w - largeur(pieces, zoom) - 60)
    return (
      `<svg class="scene" data-illustration="heros" viewBox="0 0 ${p(w)} ${p(h)}" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false">` +
      decor(w, h, sol, 0.66, false) +
      `<g class="i-formes">${formes}</g><g class="i-traits">${traits}</g>` +
      `<path class="i-premier" d="${colline(w, h, [
        [0.25, sol + h * 0.06],
        [0.6, sol + h * 0.03],
        [0.9, sol + h * 0.08],
      ])}"/>` +
      `</svg>`
    )
  },
}
