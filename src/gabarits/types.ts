/**
 * Types du moteur de gabarits (spec gabarits-couleurs § 3 et § 6). Un gabarit
 * = des données seules (`Gabarit`), un kit de frise (`Kit`) et des
 * illustrations de repli (`Illustrations`). Tout ce qu'un gabarit reçoit et
 * fournit est figé dans `src/gabarits/CONTRAT.md`.
 */

import type { Scene } from '../lib/accueil-defauts'

export type { Scene }

/** Sections d'accueil communes : un gabarit choisit lesquelles et dans quel ordre. */
export type NomSection =
  'heros' | 'demarches' | 'mairie' | 'texteLibre' | 'actualites' | 'agenda' | 'mosaique'

/** Trois tailles de pièce de frise (l'opérateur compose gauche → droite). */
export type Taille = 'petite' | 'moyenne' | 'grande'

/** Données seules d'un gabarit (son `gabarit.ts`). */
export type Gabarit = {
  nom: string
  libelle: string
  /** Version du contrat que ce gabarit respecte (`CONTRAT.md`). */
  versionContrat: number
  /**
   * Fichiers de `polices/` servis et préchargés (décision 19) : chaque police
   * que `theme.css` emploie, par son nom de fichier.
   */
  polices: string[]
  accueil: { section: NomSection; variante?: Variante }[]
  cadrageHeros: 'haut' | 'panorama'
  /** La frise de la commune est aussi rendue en tête du pied de page (au trait). */
  friseAuPied?: boolean
}

/**
 * Variantes de section du contrat (v1) — une variante change le balisage et
 * les dimensions des illustrations, jamais les données :
 * - `actualites` « une » : la première actualité est la une (visuel 4:3),
 *   les suivantes des brèves (vignette carrée) ;
 * - `mosaique` « une-haute » : première tuile grande, deuxième haute, les
 *   autres simples.
 */
export type Variante = 'une' | 'une-haute'

/**
 * Kit de frise d'un gabarit (son `frise.ts`). Chaque pièce reçoit l'abscisse
 * de pose, la ligne de sol et sa taille, et rend ses chemins SVG en
 * coordonnées absolues. Couleurs : jamais en dur, par classes CSS.
 */
export type Kit = {
  horizon(): string
  pieces: Record<
    string,
    (x: number, sol: number, taille: Taille) => { formes: string[]; traits: string[] }
  >
  /** Ornements propres au gabarit (marées, houles…), soumis aux mêmes règles (Q3). */
  ornements?: Record<string, () => string>
}

/** Illustrations de repli quand une photo manque (I30) : l'`illustrations.ts` du gabarit. */
export type Illustrations = {
  scene(nom: Scene, largeur: number, hauteur: number): string
  heros(largeur: number, hauteur: number): string
}
