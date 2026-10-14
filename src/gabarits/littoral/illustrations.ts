/**
 * Illustrations du gabarit Littoral : le repli quand une photo manque (I30).
 * Portage fidèle de la maquette validée `L-littoral-scenes/frise_littoral.py`
 * (`_scene`, `SCENES`, `SOLEIL`, `heros`) : les 7 scènes de la spec et le
 * héros, composés des pièces du kit de `frise.ts` — au Littoral, la scène
 * garde tous les traits de la pièce (croix de l'église, fenêtres de la
 * maison, horloge de l'école), contrairement au Village qui les y ajoute.
 *
 * Le relief du Littoral est la mer, en trois plans : la ligne lointaine
 * derrière les pièces, puis deux houles par-dessus (`i-loin`, `i-eau`,
 * `i-eau2`). Couleurs : classes CSS, jamais un littéral.
 */

import type { Illustrations, Scene, Taille } from '../types'
import { PIECES, TAILLES, mer } from './frise'

/** Arrondi à 2 décimales : des chemins compacts, sans bruit d'arrondi. */
const p = (v: number) => Math.round(v * 100) / 100

/** Une pièce d'illustration : ses dessins à l'origine (traits de frise compris), sa largeur. */
type PieceIllustration = {
  largeur: number
  hauteur: number
  formes: string[]
  traits: string[]
}

/** Une pièce de frise à l'origine, telle quelle : le Littoral n'ajoute pas de détails de scène. */
function dePiece(nom: string): PieceIllustration {
  const { largeur, hauteur, dessiner } = PIECES[nom]
  return { largeur, hauteur, ...dessiner(0, 0, 1) }
}

/** Les 14 pièces de la maquette (`KIT` du Python). */
export const PIECES_ILLUSTRATION: Record<string, PieceIllustration> = {
  phare: dePiece('phare'),
  jetee: dePiece('jetee'),
  barque: dePiece('barque'),
  voilier: dePiece('voilier'),
  cabane: dePiece('cabane'),
  pin: dePiece('pin'),
  eglise: dePiece('eglise'),
  maison: dePiece('maison'),
  mairie: dePiece('mairie'),
  goeland: dePiece('goeland'),
  ecole: dePiece('ecole'),
  portique: dePiece('portique'),
  dune: dePiece('dune'),
  rocher: dePiece('rocher'),
}

/** Une ligne de composition : la pièce, sa taille, l'écart qui la précède (négatif : elle chevauche la précédente). */
type Ligne = { piece: string; taille: Taille; ecart: number }

/** Une scène : ses pièces et la place de son soleil. Peu de pièces : une scène doit se lire en vignette. */
type Composition = {
  pieces: Ligne[]
  soleilX: number
}

const ligne = (piece: string, taille: Taille, ecart: number): Ligne => ({ piece, taille, ecart })

/** Les 7 scènes de la spec (liste fermée), `SCENES` et `SOLEIL` du Python. */
export const COMPOSITIONS: Record<Scene, Composition> = {
  commerces: {
    pieces: [
      ligne('cabane', 'moyenne', 0),
      ligne('maison', 'grande', 6),
      ligne('maison', 'moyenne', 4),
      ligne('goeland', 'moyenne', 6),
    ],
    soleilX: 0.2,
  },
  patrimoine: {
    pieces: [ligne('eglise', 'grande', 0), ligne('maison', 'petite', 6)],
    soleilX: 0.78,
  },
  sentiers: {
    pieces: [
      ligne('pin', 'grande', 0),
      ligne('cabane', 'petite', 10),
      ligne('pin', 'moyenne', 14),
    ],
    soleilX: 0.5,
  },
  associations: {
    pieces: [
      ligne('voilier', 'grande', 0),
      ligne('voilier', 'moyenne', 14),
      ligne('barque', 'petite', 10),
    ],
    soleilX: 0.3,
  },
  // ajoutées le 25/09 (Q2 du plan gabarits-couleurs) :
  ecole: {
    pieces: [
      ligne('pin', 'moyenne', 0),
      ligne('ecole', 'grande', 10),
      ligne('portique', 'moyenne', 14),
    ],
    soleilX: 0.8,
  },
  mer: {
    pieces: [
      ligne('rocher', 'moyenne', 0),
      ligne('phare', 'grande', -14),
      ligne('goeland', 'moyenne', 50),
      ligne('voilier', 'moyenne', 20),
    ],
    soleilX: 0.88,
  },
  nature: {
    pieces: [
      ligne('dune', 'grande', 0),
      ligne('pin', 'grande', -60),
      ligne('dune', 'moyenne', -30),
      ligne('pin', 'moyenne', -40),
    ],
    soleilX: 0.22,
  },
}

/** Le port du héros sans photo (`heros()` du Python). */
export const COMPOSITION_HEROS: Ligne[] = [
  ligne('pin', 'grande', 0),
  ligne('cabane', 'moyenne', 16),
  ligne('cabane', 'moyenne', 5),
  ligne('maison', 'grande', 40),
  ligne('eglise', 'grande', 6),
  ligne('maison', 'moyenne', 6),
  ligne('mairie', 'moyenne', 30),
  ligne('barque', 'moyenne', 50),
  ligne('voilier', 'grande', 30),
  ligne('jetee', 'moyenne', 40),
  ligne('phare', 'grande', -40),
]

const largeur = (lignes: Ligne[], zoom: number) =>
  lignes.reduce(
    (total, l) =>
      total + (l.ecart + PIECES_ILLUSTRATION[l.piece].largeur * TAILLES[l.taille]) * zoom,
    0,
  )

/** Les pièces posées de gauche à droite sur `sol` : un groupe translaté et mis à l'échelle par pièce. */
function composer(lignes: Ligne[], sol: number, zoom: number, depart: number) {
  const formes: string[] = []
  const traits: string[] = []
  let x = depart
  for (const { piece, taille, ecart } of lignes) {
    const dessin = PIECES_ILLUSTRATION[piece]
    const s = TAILLES[taille] * zoom
    x += ecart * zoom
    // La barque et le voilier flottent : ils s'enfoncent un peu sous la ligne d'eau.
    const y = sol + (piece === 'barque' || piece === 'voilier' ? 4 : 0)
    const groupe = (ds: string[]) =>
      `<g transform="translate(${p(x)} ${p(y)}) scale(${p(s)})">${ds.map((d) => `<path d="${d}"/>`).join('')}</g>`
    if (dessin.formes.length > 0) formes.push(groupe(dessin.formes))
    if (dessin.traits.length > 0) traits.push(groupe(dessin.traits))
    x += dessin.largeur * s
  }
  return { formes: formes.join(''), traits: traits.join('') }
}

type Options = {
  soleilX: number
  /** Hauteur du centre du soleil, en fraction de h (0.26 pour une scène, 0.36 pour le héros). */
  soleilY?: number
  /** Rayon du soleil ; le Python le tire de min(w, h) pour une scène, de h pour le héros. */
  rayon?: number
  /** Décalage de la seconde houle sous le sol (26 pour une scène, 30 pour le héros). */
  eau2?: number
  /** Abscisse de la première pièce ; centrée par défaut. */
  depart?: number
}

/** La mer en trois plans et les pièces, du ciel au premier plan (ordre de `_scene` du Python). */
function dessinerScene(
  w: number,
  h: number,
  lignes: Ligne[],
  zoom: number,
  sol: number,
  o: Options,
): string {
  const depart = o.depart ?? (w - largeur(lignes, zoom)) / 2
  const { formes, traits } = composer(lignes, sol, zoom, depart)
  return [
    `<rect class="i-ciel" width="${p(w)}" height="${p(h)}"/>`,
    `<circle class="i-soleil" cx="${p(w * o.soleilX)}" cy="${p(h * (o.soleilY ?? 0.26))}" r="${p(o.rayon ?? Math.min(w, h) * 0.1)}"/>`,
    `<g class="i-loin"><path d="${mer(sol - 6, 2, 60, w)} V${p(h)} H0 Z"/></g>`,
    `<g class="i-formes">${formes}</g><g class="i-traits">${traits}</g>`,
    `<path class="i-eau" d="${mer(sol + 6, 3, 44, w)} V${p(h)} H0 Z"/>`,
    `<path class="i-eau2" d="${mer(sol + (o.eau2 ?? 26), 4, 70, w)} V${p(h)} H0 Z"/>`,
  ].join('')
}

const svg = (nom: string, w: number, h: number, cadrage: string, contenu: string) =>
  `<svg class="scene" data-illustration="${nom}" viewBox="0 0 ${p(w)} ${p(h)}" preserveAspectRatio="${cadrage} slice" aria-hidden="true" focusable="false">${contenu}</svg>`

export const illustrations: Illustrations = {
  /**
   * Scène de repli d'une tuile sans photo (I30), qui occupe ~80 % de la
   * largeur quel que soit le format de l'emplacement. Nom inconnu du kit →
   * « nature » (spec : une scène absente se replie sur nature).
   */
  scene(nom, w, h) {
    // `hasOwn` coupe les noms hérités du prototype (`constructor`, …), qui
    // sinon existeraient sans être des scènes — le repli tient pour tout nom.
    const composition = Object.hasOwn(COMPOSITIONS, nom) ? COMPOSITIONS[nom] : COMPOSITIONS.nature
    const sol = h * 0.8
    // Zoom du Python : borné par la hauteur seule (les goélands volent haut).
    const zoom = Math.min(3.4, (w * 0.8) / largeur(composition.pieces, 1), h * 0.0048)
    return svg(
      nom,
      w,
      h,
      'xMidYMid',
      dessinerScene(w, h, composition.pieces, zoom, sol, composition),
    )
  },

  /** Héros sans photo : le port à droite, le ciel à gauche laissé au titre. */
  heros(w, h) {
    const zoom = 1.25
    const sol = h * 0.8
    const contenu = dessinerScene(w, h, COMPOSITION_HEROS, zoom, sol, {
      soleilX: 0.62,
      soleilY: 0.36,
      rayon: h * 0.09,
      eau2: 30,
      depart: w - largeur(COMPOSITION_HEROS, zoom) - 40,
    })
    return svg('heros', w, h, 'xMaxYMax', contenu)
  },
}
