/**
 * Composition de la frise du territoire (spec § 3) : l'opérateur décrit des
 * lignes « pièce + taille (+ écart) », posées de gauche à droite sur la
 * largeur 1440 — jamais au pixel. Même logique que `composer()` de
 * `frise_littoral.py` : l'écart précède la pièce, le curseur avance d'une
 * largeur par taille. Module pur : ni réseau, ni base.
 */

import type { Kit, Taille } from './types'

/** Hauteur du viewBox de la frise ; les pièces posent leur base sur `SOL`. */
export const HAUTEUR_FRISE = 160
export const SOL_FRISE = 150

/**
 * Avance du curseur par taille. Le contrat du kit ne rend pas la largeur d'une
 * pièce : l'avance est fixée ici, un chevauchement léger reste possible (une
 * frise est une silhouette, pas une rangée alignée).
 */
const AVANCE: Record<Taille, number> = { petite: 48, moyenne: 70, grande: 95 }

/** Une ligne de frise saisie par l'opérateur (champ `apparence.frise`). */
export type LigneFrise = { piece: string; taille: Taille; ecart?: number | null }

/**
 * I30 / « changer de gabarit ne perd rien » : une pièce hors kit est ignorée
 * au rendu et listée (l'admin l'avertit), jamais une erreur ; aucune ligne
 * valide → pas de SVG du tout.
 */
export function composerFrise(
  kit: Kit,
  lignes: LigneFrise[],
  largeur = 1440,
): { svg: string | null; ignorees: string[] } {
  const ignorees: string[] = []
  const formes: string[] = []
  const traits: string[] = []
  let x = 0
  for (const ligne of lignes) {
    const piece = kit.pieces[ligne.piece]
    if (!piece) {
      ignorees.push(ligne.piece)
      continue
    }
    x += ligne.ecart ?? 0
    const rendu = piece(Math.max(0, Math.round(x)), SOL_FRISE, ligne.taille)
    formes.push(...rendu.formes)
    traits.push(...rendu.traits)
    x += AVANCE[ligne.taille]
  }
  if (ignorees.length === lignes.length) {
    return { svg: null, ignorees }
  }
  const chemin = (d: string) => `<path d="${d}"/>`
  const svg =
    `<svg class="frise" viewBox="0 0 ${largeur} ${HAUTEUR_FRISE}" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">` +
    kit.horizon() +
    `<g class="frise__formes">${formes.map(chemin).join('')}</g>` +
    `<g class="frise__traits">${traits.map(chemin).join('')}</g>` +
    `</svg>`
  return { svg, ignorees }
}
