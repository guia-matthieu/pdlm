/**
 * Kit de frise du gabarit Littoral : les quatorze pièces de la maquette
 * validée `L-littoral-scenes/frise_littoral.py`, géométrie inchangée, à la
 * signature `(x, sol, taille)` du contrat. Chaque pièce est dessinée à
 * (x, sol), vers le haut en négatif, à l'échelle `s` ; `mer()` de la
 * maquette devient `horizon()`, la ligne d'eau sur laquelle les pièces
 * posent. `goeland` et `portique` n'ont que des traits, les autres pièces
 * sont des aplats. Couleurs : classes CSS (theme.css), jamais un littéral.
 */

import type { Kit, Taille } from '../types'

/** Arrondi à 2 décimales : des chemins compacts, sans bruit d'arrondi. */
const p = (v: number) => Math.round(v * 100) / 100

const L = 1440

/**
 * Ligne de mer du kit : la maquette pose ses frises à y = 160 dans un viewBox
 * de 190 ; le moteur du contrat pose les bases à 150 dans un viewBox de 160
 * (`src/gabarits/frise.ts`, SOL_FRISE).
 */
const SOL = 150

type Dessin = { formes: string[]; traits: string[] }

/** Une pièce du kit : son dessin paramétré, sa largeur et sa hauteur hors-tout au-dessus du sol. */
type Piece = {
  dessiner(x: number, sol: number, s: number): Dessin
  largeur: number
  hauteur: number
}

export const PIECES: Record<string, Piece> = {
  phare: {
    largeur: 36,
    hauteur: 118,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x + 4 * s)} ${p(sol)} L${p(x + 10 * s)} ${p(sol - 92 * s)} H${p(x + 26 * s)} L${p(x + 32 * s)} ${p(sol)} Z`,
        `M${p(x + 8 * s)} ${p(sol - 92 * s)} V${p(sol - 106 * s)} H${p(x + 28 * s)} V${p(sol - 92 * s)} Z M${p(x + 6 * s)} ${p(sol - 106 * s)} L${p(x + 18 * s)} ${p(sol - 118 * s)} L${p(x + 30 * s)} ${p(sol - 106 * s)} Z`,
      ],
      traits: [
        `M${p(x + 6.6 * s)} ${p(sol - 60 * s)} H${p(x + 29.4 * s)} M${p(x + 8.4 * s)} ${p(sol - 30 * s)} H${p(x + 27.6 * s)}`,
        `M${p(x - 6 * s)} ${p(sol - 100 * s)} L${p(x - 22 * s)} ${p(sol - 104 * s)} M${p(x + 42 * s)} ${p(sol - 100 * s)} L${p(x + 58 * s)} ${p(sol - 104 * s)}`,
      ],
    }),
  },
  jetee: {
    largeur: 150,
    hauteur: 22,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 12 * s)} H${p(x + 150 * s)} V${p(sol)} Z M${p(x + 112 * s)} ${p(sol - 12 * s)} V${p(sol - 22 * s)} H${p(x + 126 * s)} V${p(sol - 12 * s)} Z`,
      ],
      traits: [
        `M${p(x + 20 * s)} ${p(sol - 12 * s)} V${p(sol)} M${p(x + 50 * s)} ${p(sol - 12 * s)} V${p(sol)} M${p(x + 80 * s)} ${p(sol - 12 * s)} V${p(sol)}`,
      ],
    }),
  },
  barque: {
    largeur: 54,
    hauteur: 14,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol - 10 * s)} H${p(x + 54 * s)} L${p(x + 46 * s)} ${p(sol + 2 * s)} H${p(x + 8 * s)} Z M${p(x + 24 * s)} ${p(sol - 10 * s)} V${p(sol - 14 * s)} H${p(x + 34 * s)} V${p(sol - 10 * s)} Z`,
      ],
      traits: [],
    }),
  },
  voilier: {
    largeur: 46,
    hauteur: 66,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol - 8 * s)} H${p(x + 46 * s)} L${p(x + 40 * s)} ${p(sol + 2 * s)} H${p(x + 6 * s)} Z M${p(x + 22 * s)} ${p(sol - 10 * s)} L${p(x + 22 * s)} ${p(sol - 66 * s)} L${p(x + 44 * s)} ${p(sol - 14 * s)} Z M${p(x + 20 * s)} ${p(sol - 58 * s)} L${p(x + 4 * s)} ${p(sol - 14 * s)} H${p(x + 20 * s)} Z`,
      ],
      traits: [],
    }),
  },
  cabane: {
    largeur: 34,
    hauteur: 36,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 24 * s)} L${p(x + 17 * s)} ${p(sol - 36 * s)} L${p(x + 34 * s)} ${p(sol - 24 * s)} V${p(sol)} Z`,
      ],
      traits: [`M${p(x + 11 * s)} ${p(sol)} V${p(sol - 24 * s)} M${p(x + 23 * s)} ${p(sol)} V${p(sol - 24 * s)}`],
    }),
  },
  pin: {
    largeur: 72,
    hauteur: 64,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x + 26 * s)} ${p(sol)} C${p(x + 27 * s)} ${p(sol - 18 * s)} ${p(x + 29 * s)} ${p(sol - 30 * s)} ${p(x + 34 * s)} ${p(sol - 40 * s)} L${p(x + 37 * s)} ${p(sol - 38 * s)} C${p(x + 33 * s)} ${p(sol - 28 * s)} ${p(x + 31 * s)} ${p(sol - 16 * s)} ${p(x + 31 * s)} ${p(sol)} Z`,
        `M${p(x + 4 * s)} ${p(sol - 44 * s)} C${p(x + 6 * s)} ${p(sol - 58 * s)} ${p(x + 26 * s)} ${p(sol - 64 * s)} ${p(x + 40 * s)} ${p(sol - 60 * s)} C${p(x + 54 * s)} ${p(sol - 64 * s)} ${p(x + 72 * s)} ${p(sol - 56 * s)} ${p(x + 70 * s)} ${p(sol - 46 * s)} C${p(x + 66 * s)} ${p(sol - 38 * s)} ${p(x + 46 * s)} ${p(sol - 40 * s)} ${p(x + 36 * s)} ${p(sol - 40 * s)} C${p(x + 24 * s)} ${p(sol - 38 * s)} ${p(x + 6 * s)} ${p(sol - 36 * s)} ${p(x + 4 * s)} ${p(sol - 44 * s)} Z`,
      ],
      traits: [],
    }),
  },
  eglise: {
    largeur: 84,
    hauteur: 98,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 38 * s)} L${p(x + 30 * s)} ${p(sol - 58 * s)} L${p(x + 60 * s)} ${p(sol - 38 * s)} V${p(sol)} Z`,
        `M${p(x + 60 * s)} ${p(sol)} V${p(sol - 74 * s)} L${p(x + 72 * s)} ${p(sol - 86 * s)} L${p(x + 84 * s)} ${p(sol - 74 * s)} V${p(sol)} Z`,
      ],
      traits: [
        `M${p(x + 68 * s)} ${p(sol - 64 * s)} H${p(x + 76 * s)} V${p(sol - 54 * s)} H${p(x + 68 * s)} Z`,
        `M${p(x + 72 * s)} ${p(sol - 86 * s)} V${p(sol - 98 * s)} M${p(x + 67 * s)} ${p(sol - 93 * s)} H${p(x + 77 * s)}`,
      ],
    }),
  },
  maison: {
    largeur: 40,
    hauteur: 58,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 46 * s)} L${p(x + 20 * s)} ${p(sol - 58 * s)} L${p(x + 40 * s)} ${p(sol - 46 * s)} V${p(sol)} Z`,
      ],
      traits: [
        `M${p(x + 8 * s)} ${p(sol - 34 * s)} H${p(x + 16 * s)} M${p(x + 24 * s)} ${p(sol - 34 * s)} H${p(x + 32 * s)} M${p(x + 8 * s)} ${p(sol - 20 * s)} H${p(x + 16 * s)} M${p(x + 24 * s)} ${p(sol - 20 * s)} H${p(x + 32 * s)}`,
      ],
    }),
  },
  mairie: {
    largeur: 88,
    hauteur: 84,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 42 * s)} H${p(x + 88 * s)} V${p(sol)} Z`,
        `M${p(x - 4 * s)} ${p(sol - 42 * s)} L${p(x + 44 * s)} ${p(sol - 62 * s)} L${p(x + 92 * s)} ${p(sol - 42 * s)} Z`,
      ],
      traits: [
        `M${p(x + 44 * s)} ${p(sol - 62 * s)} V${p(sol - 84 * s)}`,
        `M${p(x + 44 * s)} ${p(sol - 84 * s)} L${p(x + 60 * s)} ${p(sol - 80 * s)} L${p(x + 44 * s)} ${p(sol - 76 * s)}`,
      ],
    }),
  },
  goeland: {
    // Tout en trait : deux ailes en vol, haut perchées dans le ciel.
    largeur: 24,
    hauteur: 126,
    dessiner: (x, sol, s) => ({
      formes: [],
      traits: [
        `M${p(x)} ${p(sol - 120 * s)} Q${p(x + 6 * s)} ${p(sol - 126 * s)} ${p(x + 12 * s)} ${p(sol - 120 * s)} Q${p(x + 18 * s)} ${p(sol - 126 * s)} ${p(x + 24 * s)} ${p(sol - 120 * s)}`,
      ],
    }),
  },
  ecole: {
    // École de bord de mer : bâtiment long et bas, toit à faible pente, clocheton à horloge.
    largeur: 100,
    hauteur: 68,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} V${p(sol - 34 * s)} H${p(x + 100 * s)} V${p(sol)} Z M${p(x - 4 * s)} ${p(sol - 34 * s)} L${p(x + 50 * s)} ${p(sol - 46 * s)} L${p(x + 104 * s)} ${p(sol - 34 * s)} Z`,
        `M${p(x + 44 * s)} ${p(sol - 44 * s)} V${p(sol - 60 * s)} H${p(x + 56 * s)} V${p(sol - 44 * s)} Z M${p(x + 42 * s)} ${p(sol - 60 * s)} L${p(x + 50 * s)} ${p(sol - 68 * s)} L${p(x + 58 * s)} ${p(sol - 60 * s)} Z`,
      ],
      traits: [
        `M${p(x + 10 * s)} ${p(sol - 22 * s)} H${p(x + 22 * s)} M${p(x + 30 * s)} ${p(sol - 22 * s)} H${p(x + 40 * s)} M${p(x + 60 * s)} ${p(sol - 22 * s)} H${p(x + 70 * s)} M${p(x + 78 * s)} ${p(sol - 22 * s)} H${p(x + 90 * s)}`,
        `M${p(x + 47 * s)} ${p(sol - 52 * s)} a${p(3 * s)} ${p(3 * s)} 0 1 1 ${p(6 * s)} 0 a${p(3 * s)} ${p(3 * s)} 0 1 1 ${p(-6 * s)} 0`,
      ],
    }),
  },
  portique: {
    // Portique de cour d'école (balançoire), tout en trait.
    largeur: 60,
    hauteur: 36,
    dessiner: (x, sol, s) => ({
      formes: [],
      traits: [
        `M${p(x)} ${p(sol)} L${p(x + 10 * s)} ${p(sol - 36 * s)} L${p(x + 20 * s)} ${p(sol)} M${p(x + 40 * s)} ${p(sol)} L${p(x + 50 * s)} ${p(sol - 36 * s)} L${p(x + 60 * s)} ${p(sol)} M${p(x + 8 * s)} ${p(sol - 36 * s)} H${p(x + 52 * s)} M${p(x + 30 * s)} ${p(sol - 36 * s)} V${p(sol - 14 * s)} M${p(x + 24 * s)} ${p(sol - 14 * s)} H${p(x + 36 * s)}`,
      ],
    }),
  },
  dune: {
    // Dune et ses oyats (les brins descendent en `l` relatifs, échelle comprise).
    largeur: 120,
    hauteur: 41,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} C${p(x + 24 * s)} ${p(sol - 30 * s)} ${p(x + 70 * s)} ${p(sol - 34 * s)} ${p(x + 120 * s)} ${p(sol)} Z`,
      ],
      traits: [
        `M${p(x + 40 * s)} ${p(sol - 24 * s)} l${p(-5 * s)} ${p(-12 * s)} M${p(x + 46 * s)} ${p(sol - 27 * s)} l0 ${p(-14 * s)} M${p(x + 52 * s)} ${p(sol - 25 * s)} l${p(5 * s)} ${p(-12 * s)} M${p(x + 78 * s)} ${p(sol - 20 * s)} l${p(-4 * s)} ${p(-10 * s)} M${p(x + 83 * s)} ${p(sol - 21 * s)} l${p(3 * s)} ${p(-10 * s)}`,
      ],
    }),
  },
  rocher: {
    largeur: 64,
    hauteur: 28,
    dessiner: (x, sol, s) => ({
      formes: [
        `M${p(x)} ${p(sol)} C${p(x + 4 * s)} ${p(sol - 14 * s)} ${p(x + 16 * s)} ${p(sol - 24 * s)} ${p(x + 30 * s)} ${p(sol - 20 * s)} C${p(x + 42 * s)} ${p(sol - 28 * s)} ${p(x + 58 * s)} ${p(sol - 14 * s)} ${p(x + 64 * s)} ${p(sol)} Z`,
      ],
      traits: [],
    }),
  },
}

/** Échelles des trois tailles d'opérateur (maquette `frise_littoral.py`). */
export const TAILLES: Record<Taille, number> = { petite: 0.72, moyenne: 1, grande: 1.3 }

/**
 * La houle : une ligne d'ondes en quadratiques, deux par période (le `q` de
 * la maquette, cuit en coordonnées absolues). Sert d'horizon, de décor de
 * scène et d'ornement.
 */
export const mer = (y = SOL, amplitude = 3, periode = 48, largeur = L): string => {
  let d = `M0 ${p(y)}`
  for (let x = 0; x < largeur; x += periode) {
    d += ` Q${p(x + periode * 0.25)} ${p(y - amplitude)} ${p(x + periode * 0.5)} ${p(y)}`
    d += ` Q${p(x + periode * 0.75)} ${p(y + amplitude)} ${p(x + periode)} ${p(y)}`
  }
  return d
}

/** L'horizon du Littoral : la ligne de mer, fermée jusqu'en bas du viewBox. */
const horizon = () => `<path class="frise__horizon" d="${mer()} V160 H0 Z"/>`

/** Une vague lissée de cubiques (`_vague` de la maquette), fermée sur `h` quand `fermer`. */
const vague = (
  y: number,
  amp: number,
  periode: number,
  phase: number,
  w = 1440,
  h = 80,
  fermer = true,
): string => {
  let x = -phase
  let d = `M${p(x)} ${p(y)}`
  while (x < w) {
    d += ` C${p(x + periode * 0.25)} ${p(y - amp)} ${p(x + periode * 0.25)} ${p(y - amp)} ${p(x + periode * 0.5)} ${p(y)}`
    d += ` C${p(x + periode * 0.75)} ${p(y + amp)} ${p(x + periode * 0.75)} ${p(y + amp)} ${p(x + periode)} ${p(y)}`
    x += periode
  }
  return fermer ? `${d} V${p(h)} H${p(-phase)} Z` : d
}

/**
 * Transition entre deux bandes de la page : deux vagues décalées (et un
 * liseré d'écume quand les deux fonds sont proches). `dessus` et `dessous`
 * sont des couleurs CSS — une variable du contrat, ou `--blanc` du thème —
 * posées en variables inline du SVG.
 */
const maree = (dessus = 'var(--blanc)', dessous = 'var(--pale)', ecume = false): string => {
  const trait = ecume ? `<path class="ecume" d="${vague(52, 10, 380, 0, 1440, 80, false)}"/>` : ''
  return (
    `<svg class="maree" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden="true" focusable="false" ` +
    `style="--dessus:${dessus};--dessous:${dessous}"><rect class="fond" width="1440" height="80"/>` +
    `<path class="vague1" d="${vague(34, 16, 520, 120)}"/><path class="vague2" d="${vague(52, 10, 380, 0)}"/>${trait}</svg>`
  )
}

/** La ligne de mer en trait qui traverse la photo de l'actualité, avec un voilier. */
const ligneMer = () =>
  `<svg class="ligne-mer" viewBox="0 0 900 90" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">` +
  `<path d="${mer(64, 3, 46, 900)}"/><path class="voile" d="M690 58 L690 8 L716 54 Z M686 52 L668 56 L686 14 Z"/>` +
  `<path d="M660 60 H722 L714 68 H668 Z"/><path d="M120 22 q6 -6 12 0 q6 -6 12 0 M170 34 q5 -5 10 0 q5 -5 10 0"/></svg>`

/** Courbe qui relie les quatre dates de l'agenda (creux et crêtes alternés). */
const courbeMarees = () =>
  `<svg class="courbe" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">` +
  `<path d="M0 8 C12.5 8 12.5 32 25 32 S37.5 8 50 8 S62.5 32 75 32 S87.5 8 100 8"/></svg>`

/** Le sable : une dernière houle très plate. */
const sable = () =>
  `<svg class="sable" viewBox="0 0 1440 40" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${mer(20, 4, 160, 1440)}"/></svg>`

/**
 * Ornements du Littoral (export libre du contrat) : la houle `mer`, la
 * transition `maree`, la `ligne_mer`, la `courbe_marees` de l'agenda et le
 * `sable`. Couleurs par classes CSS, jamais un littéral de commune.
 */
export const ornements: Record<string, () => string> = {
  mer,
  maree,
  ligne_mer: ligneMer,
  courbe_marees: courbeMarees,
  sable,
}

/** Kit public : les pièces du contrat, à l'échelle de leur taille. */
export const kit: Kit = {
  horizon,
  pieces: Object.fromEntries(
    Object.entries(PIECES).map(([nom, piece]) => [
      nom,
      (x: number, sol: number, taille: Taille) => piece.dessiner(x, sol, TAILLES[taille]),
    ]),
  ),
  ornements,
}
