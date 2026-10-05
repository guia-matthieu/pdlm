/**
 * Illustrations du gabarit Village : le repli quand une photo manque (I30).
 * Portage fidèle de la maquette validée par Matthieu le 25/09,
 * `K-village-illustre/illustrations_village.py` : 17 pièces, 7 scènes et le
 * héros. Chaque pièce est dessinée à l'origine (x = 0 à gauche, y = 0 au sol,
 * vers le haut en négatif) et posée par un groupe `translate scale`, comme
 * dans la maquette (les traits suivent l'échelle). Les six pièces de la frise
 * viennent de `frise.ts` ; les pièces neuves (école, halle, kiosque, lavoir,
 * pont…) suivent sa géométrie : toits à deux pans, aplats, aucun détail fin.
 *
 * Le relief de Village est la colline : deux lignes de collines, un sol, un
 * premier plan qui ondule ; « mer » est un plan d'eau (étang, pont, barque).
 * Couleurs : classes CSS (`i-ciel`, `i-soleil`…, mises en forme par le
 * thème), jamais un littéral.
 */

import type { Illustrations, Scene, Taille } from '../types'
import { PIECES, TAILLES } from './frise'

/** Arrondi à 2 décimales : des chemins compacts, sans bruit d'arrondi. */
const p = (v: number) => Math.round(v * 100) / 100

/** Une pièce d'illustration : ses dessins à l'origine, ses dimensions hors-tout (croix, drapeau, épi compris). */
type PieceIllustration = {
  largeur: number
  hauteur: number
  formes: string[]
  traits: string[]
  accents: string[]
}

/** Une pièce de frise à l'origine, complétée de ses détails (traits, accents) propres aux scènes. */
function dePiece(nom: string, traits: string[] = [], accents: string[] = []): PieceIllustration {
  const { largeur, hauteur, dessiner } = PIECES[nom]
  return { largeur, hauteur, formes: dessiner(0, 0, 1).formes, traits, accents }
}

/** Guirlande de fête tendue entre deux pièces (écarts négatifs dans la composition). */
function fanions(): PieceIllustration {
  const w = 120
  const triangles = [0.1, 0.3, 0.5, 0.7, 0.9]
    .map((t) => {
      const x = w * t
      const y = -34 + 48 * t * (1 - t)
      return `M${p(x - 6)} ${p(y)} L${p(x + 6)} ${p(y)} L${p(x)} ${p(y + 10)} Z`
    })
    .join(' ')
  return {
    largeur: w,
    hauteur: 34,
    formes: [],
    traits: [`M0 -34 Q60 -10 ${w} -34`],
    accents: [triangles],
  }
}

/** Les rangs de ceps de la vigne : sept ceps ronds sur un fil. */
function vigne(): PieceIllustration {
  const ceps = [0, 16, 32, 48, 64, 80, 96]
    .map((x) => `M${x} -6 a7 7 0 1 1 14 0 a7 7 0 1 1 -14 0 Z`)
    .join(' ')
  return { largeur: 110, hauteur: 14, formes: [ceps], traits: ['M0 -2 H110'], accents: [] }
}

/** Les 17 pièces de la maquette (`KIT` du Python). */
export const PIECES_ILLUSTRATION: Record<string, PieceIllustration> = {
  maison: dePiece('maison', ['M10 -15 h7 M29 -15 h7']),
  maisonBasse: dePiece('maisonBasse', ['M12 -10 h8 M31 -10 h8 M50 -10 h8']),
  eglise: (() => {
    const base = dePiece('eglise')
    // La croix de frise.py d'abord, puis la rosace et la baie du clocher.
    return {
      ...base,
      traits: [
        ...PIECES.eglise.dessiner(0, 0, 1).traits,
        'M28 -22 a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0',
        'M76 -50 v-10',
      ],
    }
  })(),
  sapin: dePiece('sapin'),
  arbre: dePiece('arbre'),
  mairie: dePiece(
    'mairie',
    ['M12 -22 h9 M38 -22 h9 M64 -22 h9', 'M42 -76 V-96'],
    ['M42 -96 L58 -92 L42 -88 Z'],
  ),
  ecole: {
    largeur: 110,
    hauteur: 78,
    formes: [
      'M0 0 V-38 H110 V0 Z M-4 -38 L10 -50 H100 L114 -38 Z',
      'M45 -50 V-66 H65 V-50 Z M42 -66 L55 -78 L68 -66 Z',
    ],
    traits: ['M9 -24 h11 M27 -24 h11 M72 -24 h11 M90 -24 h11', 'M55 0 v-15'],
    accents: ['M50 -58 a5 5 0 1 1 10 0 a5 5 0 1 1 -10 0'],
  },
  preau: {
    largeur: 64,
    hauteur: 42,
    formes: ['M-2 -30 L32 -42 L66 -30 Z M4 0 V-30 H8 V0 Z M56 0 V-30 H60 V0 Z'],
    traits: [],
    accents: [],
  },
  halle: {
    largeur: 120,
    hauteur: 56,
    formes: [
      'M-6 -34 L20 -56 H100 L126 -34 Z',
      [4, 40, 76, 110].map((x) => `M${x} 0 V-34 H${x + 6} V0 Z`).join(' '),
    ],
    traits: [],
    accents: ['M14 -16 H36 L33 -10 H17 Z M50 -16 H72 L69 -10 H53 Z M84 -16 H106 L103 -10 H87 Z'],
  },
  commerce: {
    largeur: 52,
    hauteur: 56,
    formes: ['M0 0 V-40 L26 -56 L52 -40 V0 Z'],
    traits: ['M8 -8 h14 M30 -8 h14', 'M18 -36 h16'],
    accents: ['M-3 -27 H55 L51 -19 H1 Z'],
  },
  kiosque: {
    largeur: 80,
    hauteur: 62,
    formes: [
      'M0 0 V-8 H80 V0 Z',
      'M8 -8 V-36 H12 V-8 Z M38 -8 V-36 H42 V-8 Z M68 -8 V-36 H72 V-8 Z',
      'M-4 -36 Q40 -70 84 -36 Z M39 -52 V-62 H41 V-52 Z',
    ],
    traits: ['M2 -22 H78'],
    accents: [],
  },
  fanions: fanions(),
  lavoir: {
    largeur: 90,
    hauteur: 44,
    formes: ['M-4 -30 L45 -44 L94 -30 Z M2 0 V-30 H7 V0 Z M83 0 V-30 H88 V0 Z M0 0 V-8 H90 V0 Z'],
    traits: [],
    accents: [],
  },
  pont: {
    largeur: 170,
    hauteur: 34,
    formes: ['M0 4 V-28 H170 V4 H135 A50 22 0 0 0 35 4 Z'],
    traits: ['M0 -28 V-34 H170 V-28'],
    accents: [],
  },
  barque: { largeur: 54, hauteur: 10, formes: ['M0 -10 H54 L46 2 H8 Z'], traits: [], accents: [] },
  panneau: {
    largeur: 34,
    hauteur: 44,
    formes: ['M15 0 V-40 H19 V0 Z'],
    traits: [],
    accents: ['M0 -44 H28 L34 -38 L28 -32 H0 Z'],
  },
  vigne: vigne(),
}

/** Une ligne de composition : la pièce, sa taille, l'écart qui la précède (négatif : elle chevauche la précédente). */
type Ligne = { piece: string; taille: Taille; ecart: number }

/** Une scène : ses pièces et son relief. Peu de pièces : une scène doit se lire en vignette. */
type Composition = {
  pieces: Ligne[]
  soleilX: number
  /** Plan d'eau au lieu du sol (la « mer » d'un gabarit de l'intérieur). */
  eau?: boolean
  /** Chemin qui monte vers l'horizon. */
  chemin?: boolean
  /** Rangs de vigne pointillés sur la colline du milieu. */
  vignes?: boolean
  /** Abscisse (fraction de la largeur) des oiseaux ; absents sinon. */
  oiseauxX?: number
}

const ligne = (piece: string, taille: Taille, ecart: number): Ligne => ({ piece, taille, ecart })

/** Les 7 scènes de la spec (liste fermée), `SCENES` du Python. */
export const COMPOSITIONS: Record<Scene, Composition> = {
  sentiers: {
    pieces: [
      ligne('sapin', 'grande', 0),
      ligne('panneau', 'moyenne', 26),
      ligne('arbre', 'moyenne', 90),
      ligne('sapin', 'moyenne', 6),
    ],
    chemin: true,
    soleilX: 0.22,
  },
  patrimoine: {
    pieces: [
      ligne('lavoir', 'petite', 0),
      ligne('eglise', 'grande', 10),
      ligne('arbre', 'petite', 8),
    ],
    soleilX: 0.8,
  },
  commerces: {
    pieces: [
      ligne('commerce', 'moyenne', 0),
      ligne('halle', 'moyenne', 8),
      ligne('commerce', 'petite', 8),
    ],
    soleilX: 0.2,
  },
  associations: {
    pieces: [
      ligne('arbre', 'grande', 0),
      ligne('fanions', 'moyenne', -12),
      ligne('arbre', 'grande', -12),
      ligne('kiosque', 'moyenne', 14),
    ],
    soleilX: 0.78,
  },
  ecole: {
    pieces: [
      ligne('arbre', 'grande', 0),
      ligne('ecole', 'moyenne', 8),
      ligne('preau', 'petite', 4),
    ],
    soleilX: 0.25,
  },
  // « mer » au Village : un plan d'eau (étang, pont de pierre, barque).
  mer: {
    pieces: [
      ligne('sapin', 'moyenne', 0),
      ligne('pont', 'moyenne', 4),
      ligne('barque', 'petite', 18),
    ],
    eau: true,
    soleilX: 0.7,
  },
  nature: {
    pieces: [
      ligne('sapin', 'grande', 0),
      ligne('sapin', 'moyenne', -6),
      ligne('arbre', 'grande', 10),
      ligne('sapin', 'grande', 8),
    ],
    vignes: true,
    soleilX: 0.3,
    oiseauxX: 0.7,
  },
}

/** Le village du héros sans photo (`heros()` du Python). */
export const COMPOSITION_HEROS: Ligne[] = [
  ligne('sapin', 'grande', 0),
  ligne('arbre', 'moyenne', 4),
  ligne('maison', 'moyenne', 18),
  ligne('eglise', 'grande', 4),
  ligne('maisonBasse', 'moyenne', 6),
  ligne('mairie', 'moyenne', 16),
  ligne('arbre', 'grande', 10),
  ligne('maison', 'petite', 6),
  ligne('sapin', 'grande', 20),
  ligne('sapin', 'moyenne', -8),
]

const largeur = (lignes: Ligne[], zoom: number) =>
  lignes.reduce(
    (total, l) =>
      total + (l.ecart + PIECES_ILLUSTRATION[l.piece].largeur * TAILLES[l.taille]) * zoom,
    0,
  )

const hauteurMax = (lignes: Ligne[]) =>
  Math.max(...lignes.map((l) => PIECES_ILLUSTRATION[l.piece].hauteur * TAILLES[l.taille]))

/** Les pièces posées de gauche à droite sur `sol` : un groupe translaté et mis à l'échelle par pièce. */
function composer(lignes: Ligne[], sol: number, zoom: number, depart: number) {
  const formes: string[] = []
  const traits: string[] = []
  const accents: string[] = []
  let x = depart
  for (const { piece, taille, ecart } of lignes) {
    const dessin = PIECES_ILLUSTRATION[piece]
    const s = TAILLES[taille] * zoom
    x += ecart * zoom
    // La barque flotte : elle s'enfonce un peu sous la ligne de sol.
    const y = sol + (piece === 'barque' ? 5 * zoom : 0)
    const groupe = (ds: string[]) =>
      `<g transform="translate(${p(x)} ${p(y)}) scale(${p(s)})">${ds.map((d) => `<path d="${d}"/>`).join('')}</g>`
    if (dessin.formes.length > 0) formes.push(groupe(dessin.formes))
    if (dessin.traits.length > 0) traits.push(groupe(dessin.traits))
    if (dessin.accents.length > 0) accents.push(groupe(dessin.accents))
    x += dessin.largeur * s
  }
  return { formes: formes.join(''), traits: traits.join(''), accents: accents.join('') }
}

/** Ligne de collines lissée, fermée jusqu'en bas (même courbe que l'horizon de la frise). */
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

/** Rangs pointillés sur la colline du milieu, à gauche (le vignoble). */
function rangsDeVigne(w: number, sol: number): string {
  let d = ''
  for (let i = 0; i < 4; i++) {
    const y = sol - 10 - i * 9
    d += `M${p(w * 0.02)} ${p(y + i * 3)} L${p(w * 0.3 - i * w * 0.03)} ${p(y - 6)} `
  }
  return `<path class="i-rangs" d="${d.trim()}"/>`
}

/** Deux vols d'oiseaux, en traits. */
function oiseaux(w: number, h: number, fraction: number): string {
  const x = w * fraction
  const y = h * 0.2
  const k = Math.min(w, h) / 400
  const vol = (l: number) =>
    `q${p(l * 0.5 * k)} ${p(-l * 0.5 * k)} ${p(l * k)} 0 q${p(l * 0.5 * k)} ${p(-l * 0.5 * k)} ${p(l * k)} 0`
  return `<path class="i-oiseaux" d="M${p(x)} ${p(y)} ${vol(12)} M${p(x + 26 * k)} ${p(y - 12 * k)} ${vol(8)}"/>`
}

/** Le chemin qui monte du bas du cadre vers l'horizon (scène « sentiers »). */
function chemin(w: number, h: number, sol: number): string {
  const a = sol + h * 0.03
  const b = h
  return (
    `<path class="i-chemin" d="M${p(w * 0.3)} ${p(b)} C${p(w * 0.44)} ${p(b - h * 0.08)} ${p(w * 0.62)} ${p(a + h * 0.05)} ${p(w * 0.5)} ${p(a)}` +
    ` L${p(w * 0.53)} ${p(a)} C${p(w * 0.7)} ${p(a + h * 0.06)} ${p(w * 0.56)} ${p(b - h * 0.08)} ${p(w * 0.5)} ${p(b)} Z"/>`
  )
}

type Options = {
  soleilX: number
  eau?: boolean
  chemin?: boolean
  vignes?: boolean
  oiseauxX?: number
  /** Abscisse de la première pièce ; centrée par défaut. */
  depart?: number
}

/** Le décor et les pièces d'une scène, du ciel au premier plan (ordre de `_scene` du Python). */
function dessinerScene(
  w: number,
  h: number,
  lignes: Ligne[],
  zoom: number,
  sol: number,
  o: Options,
): string {
  const depart = o.depart ?? (w - largeur(lignes, zoom)) / 2
  const { formes, traits, accents } = composer(lignes, sol, zoom, depart)
  const parts = [
    `<rect class="i-ciel" width="${p(w)}" height="${p(h)}"/>`,
    `<circle class="i-soleil" cx="${p(w * o.soleilX)}" cy="${p(h * 0.24)}" r="${p(Math.min(w, h) * 0.09)}"/>`,
  ]
  if (o.oiseauxX !== undefined) parts.push(oiseaux(w, h, o.oiseauxX))
  parts.push(
    `<path class="i-loin" d="${colline(w, h, [
      [0.2, sol - h * 0.2],
      [0.55, sol - h * 0.1],
      [0.85, sol - h * 0.24],
    ])}"/>`,
    `<path class="i-mi" d="${colline(w, h, [
      [0.15, sol - h * 0.07],
      [0.5, sol - h * 0.02],
      [0.8, sol - h * 0.09],
    ])}"/>`,
  )
  if (o.vignes) parts.push(rangsDeVigne(w, sol))
  if (o.eau) {
    parts.push(`<rect class="i-eau" y="${p(sol - 2)}" width="${p(w)}" height="${p(h - sol + 2)}"/>`)
    const rides = [
      [0.08, 0.06],
      [0.6, 0.05],
      [0.3, 0.11],
      [0.78, 0.13],
      [0.15, 0.17],
    ]
      .map(([fx, fy]) => `M${p(w * fx)} ${p(sol + h * fy)} h${p(w * 0.12)}`)
      .join(' ')
    parts.push(`<path class="i-rides" d="${rides}"/>`)
  } else {
    parts.push(
      `<rect class="i-sol" y="${p(sol - 0.5)}" width="${p(w)}" height="${p(h - sol + 0.5)}"/>`,
    )
  }
  parts.push(
    `<g class="i-formes">${formes}</g><g class="i-traits">${traits}</g><g class="i-accents">${accents}</g>`,
  )
  if (!o.eau) {
    parts.push(
      `<path class="i-premier" d="${colline(w, h, [
        [0.25, sol + h * 0.1],
        [0.6, sol + h * 0.06],
        [0.9, sol + h * 0.12],
      ])}"/>`,
    )
  }
  if (o.chemin) parts.push(chemin(w, h, sol))
  return parts.join('')
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
    const sol = h * 0.74
    // La plus haute pièce reste dans le cadre.
    const zoom = Math.min(
      3.4,
      (w * 0.8) / largeur(composition.pieces, 1),
      (sol - h * 0.1) / hauteurMax(composition.pieces),
    )
    return svg(
      nom,
      w,
      h,
      'xMidYMid',
      dessinerScene(w, h, composition.pieces, zoom, sol, composition),
    )
  },

  /** Héros sans photo : le village à droite, le ciel à gauche laissé au titre. */
  heros(w, h) {
    const zoom = 1.1
    const sol = h * 0.86 // le ciel est laissé au titre ; la frise du héros mange le bas, devant le village
    const contenu = dessinerScene(w, h, COMPOSITION_HEROS, zoom, sol, {
      soleilX: 0.66,
      vignes: true,
      oiseauxX: 0.82,
      depart: w - largeur(COMPOSITION_HEROS, zoom) - 60,
    })
    return svg('heros', w, h, 'xMaxYMax', contenu)
  },
}
