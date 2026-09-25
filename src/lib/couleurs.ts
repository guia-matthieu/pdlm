/**
 * Dérivation des couleurs d'une commune (spec gabarits-couleurs, section 2).
 *
 * Trois couleurs choisies (principale, accent, terre) → toutes les variables
 * CSS du contrat de gabarit, avec leurs garanties de contraste (I25). Module
 * pur : ni réseau, ni base. Calculs en OKLCH, conversions d'après Björn
 * Ottosson, portés ligne à ligne du prototype validé
 * `docs/recherche/2026-09-25_front-beau/J-maquette-littoral/couleurs.py`.
 * Écart volontaire au prototype : une couleur achromatique reste un gris
 * exact (le prototype teintait légèrement les gris par arrondi).
 */

export type Choix = { principale?: string | null; accent?: string | null; terre?: string | null }
export type CleForcee = 'texte' | 'pale' | 'profond' | `picto${1 | 2 | 3 | 4 | 5 | 6}`
export type Forcees = Partial<Record<CleForcee, string | null>>

export interface Controle {
  role: string
  couleur: string
  fond: string
  contraste: number
  seuil: number
  force: boolean
}

export interface Derivation {
  variables: Record<string, string>
  controles: Controle[]
  avertissements: string[]
}

/** Défauts (spec § 1) : jamais le bleu France, réservé à l'État. */
export const DEFAUTS = { principale: '#264653', accent: '#e2a72e', terre: '#b36b00' } as const

/** Variables fournies aux gabarits (contrat, `src/gabarits/CONTRAT.md`). */
export const VARIABLES_CONTRAT = [
  '--principale-sure',
  '--pale',
  '--profond',
  '--encre',
  '--accent',
  '--accent-sur-profond',
  '--texte-sur-accent',
  '--terre-sure',
  '--picto-1',
  '--picto-2',
  '--picto-3',
  '--picto-4',
  '--picto-5',
  '--picto-6',
] as const

const BLANC = '#ffffff'
const NOIR = '#000000'
/** I24 : le seul format admis, partout. */
const FORMAT = /^#[0-9a-fA-F]{6}$/
/** En deçà, la teinte n'a plus de sens : la couleur est traitée comme un gris. */
const CHROMA_ACHROMATIQUE = 1e-4
/** Écart OKLab en deçà duquel deux couleurs saisies « se confondent » (à étalonner). */
const SEUIL_HARMONIE = 0.08

function valide(h: string | null | undefined): string | undefined {
  return typeof h === 'string' && FORMAT.test(h) ? h.toLowerCase() : undefined
}

function hexRgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function rgbHex(c: readonly number[]): string {
  return (
    '#' +
    c
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const delin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function luminance(h: string): number {
  const [r, g, b] = hexRgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG 2 entre deux couleurs `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (claire + 0.05) / (sombre + 0.05)
}

/** `#rrggbb` → [L, C, H°] en OKLCH. */
export function vers_oklch(h: string): [number, number, number] {
  const [r, g, b] = hexRgb(h).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const H = ((((Math.atan2(bb, a) * 180) / Math.PI) % 360) + 360) % 360
  return [L, Math.hypot(a, bb), H]
}

function oklchRgbLineaire(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** OKLCH → `#rrggbb`, en réduisant la saturation jusqu'au gamut sRGB (teinte et clarté gardées). */
function depuis_oklch(L: number, C: number, H: number): string {
  if (C < CHROMA_ACHROMATIQUE) {
    // Gris exact : l = m = s = L³ et la matrice rend r = g = b.
    const v = delin(Math.min(1, Math.max(0, L ** 3)))
    return rgbHex([v, v, v])
  }
  let rgb = oklchRgbLineaire(L, C, H)
  for (let i = 0; i < 40; i++) {
    if (rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) break
    C *= 0.93
    rgb = oklchRgbLineaire(L, C, H)
  }
  return rgbHex(rgb.map((v) => delin(Math.min(1, Math.max(0, v)))))
}

/** Plus grande clarté (teinte gardée) qui atteint `seuil` contre `fond` ; inchangée si déjà conforme. */
function assombrirJusqua(h: string, fond: string, seuil: number): string {
  if (contraste(h, fond) >= seuil) return h
  const [L, C, H] = vers_oklch(h)
  let bas = 0
  let haut = L
  for (let i = 0; i < 30; i++) {
    const milieu = (bas + haut) / 2
    if (contraste(depuis_oklch(milieu, C, H), fond) >= seuil) bas = milieu
    else haut = milieu
  }
  return depuis_oklch(bas, C, H)
}

/** Plus petite clarté (teinte gardée) qui atteint `seuil` contre `fond` ; inchangée si déjà conforme. */
function eclaircirJusqua(h: string, fond: string, seuil: number): string {
  if (contraste(h, fond) >= seuil) return h
  const [L, C, H] = vers_oklch(h)
  let bas = L
  let haut = 1
  for (let i = 0; i < 30; i++) {
    const milieu = (bas + haut) / 2
    if (contraste(depuis_oklch(milieu, C, H), fond) >= seuil) haut = milieu
    else bas = milieu
  }
  return depuis_oklch(haut, C, H)
}

function ecartOklab(x: string, y: string): number {
  const [L1, C1, H1] = vers_oklch(x)
  const [L2, C2, H2] = vers_oklch(y)
  const rad = Math.PI / 180
  return Math.hypot(
    L1 - L2,
    C1 * Math.cos(H1 * rad) - C2 * Math.cos(H2 * rad),
    C1 * Math.sin(H1 * rad) - C2 * Math.sin(H2 * rad),
  )
}

const NOMS = { principale: 'la principale', accent: 'l’accent', terre: 'la terre' } as const
const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const format2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2).replace('.', ',')

/**
 * I23 : rien de ceci n'est stocké ; recalculé à chaque rendu.
 * I24 : aucune couleur n'est refusée ; une saisie hors format vaut le défaut,
 * une forcée hors format est ignorée.
 */
export function deriver(choix: Choix, forcees: Forcees = {}): Derivation {
  const saisies = {
    principale: valide(choix.principale),
    accent: valide(choix.accent),
    terre: valide(choix.terre),
  }
  const p = saisies.principale ?? DEFAUTS.principale
  const a = saisies.accent ?? DEFAUTS.accent
  const t = saisies.terre ?? DEFAUTS.terre
  const f = Object.fromEntries(
    Object.entries(forcees).flatMap(([cle, v]) => (valide(v) ? [[cle, valide(v)!]] : [])),
  ) as Partial<Record<CleForcee, string>>

  const [pL, pC, pH] = vers_oklch(p)
  const sure = assombrirJusqua(p, BLANC, 4.5)
  const encre = depuis_oklch(0.24, Math.min(pC, 0.03), pH)
  const pale = depuis_oklch(0.965, Math.min(pC, 0.03), pH)
  const profond = assombrirJusqua(depuis_oklch(Math.min(pL, 0.34), pC, pH), BLANC, 7)
  const terreSure = assombrirJusqua(t, BLANC, 3)

  // 4 tons de pictos : teintes réparties par pas de 67°, à ≥ 30° des deux premières.
  const [sL, sC, sH] = vers_oklch(sure)
  const [tL, tC, tH] = vers_oklch(terreSure)
  const Lb = (sL + tL) / 2
  const Cb = Math.max(0.08, (sC + tC) / 2)
  const tons: string[] = []
  let h = sH
  while (tons.length < 4) {
    h = (h + 67) % 360
    if (Math.min(...[sH, tH].map((x) => Math.abs(((h - x + 540) % 360) - 180))) >= 30) {
      tons.push(assombrirJusqua(depuis_oklch(Lb, Cb, h), BLANC, 3))
    }
  }

  // Une forcée remplace sa variable ; les dérivées qui en dépendent se
  // recalculent contre la valeur réellement servie.
  const pictos = [sure, terreSure, ...tons].map((x, i) => f[`picto${i + 1}` as CleForcee] ?? x)
  const v: Record<string, string> = {
    '--principale-sure': f.texte ?? sure,
    '--pale': f.pale ?? pale,
    '--profond': f.profond ?? profond,
    '--encre': encre,
    '--accent': a,
    '--texte-sur-accent': contraste(NOIR, a) >= contraste(BLANC, a) ? NOIR : BLANC,
    '--terre-sure': terreSure,
  }
  v['--accent-sur-profond'] = eclaircirJusqua(a, v['--profond'], 3)
  pictos.forEach((x, i) => (v[`--picto-${i + 1}`] = x))

  const lignes: [string, string, string, number, boolean][] = [
    ['texte et liens sur blanc', v['--principale-sure'], BLANC, 4.5, Boolean(f.texte)],
    ['texte courant sur pâle', encre, v['--pale'], 4.5, Boolean(f.pale)],
    ['texte blanc sur profond', BLANC, v['--profond'], 7, Boolean(f.profond)],
    ['grandes dates sur profond', v['--accent-sur-profond'], v['--profond'], 3, Boolean(f.profond)],
    ['texte sur accent', v['--texte-sur-accent'], a, 4.5, false],
    ...[1, 2, 3, 4, 5, 6].map(
      (i) =>
        [
          `picto blanc sur ton ${i}`,
          BLANC,
          v[`--picto-${i}`],
          3,
          Boolean(f[`picto${i}` as CleForcee]),
        ] as [string, string, string, number, boolean],
    ),
  ]
  const controles = lignes.map(([role, couleur, fond, seuil, force]) => ({
    role,
    couleur,
    fond,
    contraste: contraste(couleur, fond),
    seuil,
    force,
  }))

  const avertissements = controles
    .filter((c) => c.contraste < c.seuil)
    .map((c) => `${capitale(c.role)} : ${format2(c.contraste)}:1, illisible`)
  // Harmonie : seulement entre couleurs saisies, jamais sur un défaut.
  const noms = (['principale', 'accent', 'terre'] as const).filter((n) => saisies[n])
  for (let i = 0; i < noms.length; i++) {
    for (let j = i + 1; j < noms.length; j++) {
      if (ecartOklab(saisies[noms[i]]!, saisies[noms[j]]!) < SEUIL_HARMONIE) {
        avertissements.push(`${capitale(NOMS[noms[j]])} se confond avec ${NOMS[noms[i]]}`)
      }
    }
  }

  return { variables: v, controles, avertissements }
}

/** Propositions d'accent pour une principale : teintes voisine, triade, complémentaires. */
export function accords(principale: string): string[] {
  const [, C, H] = vers_oklch(valide(principale) ?? DEFAUTS.principale)
  const chroma = Math.min(0.16, Math.max(0.1, C))
  return [30, 120, 150, 180, 210].map((d) => depuis_oklch(0.78, chroma, (H + d) % 360))
}
