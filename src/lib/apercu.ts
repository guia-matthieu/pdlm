/**
 * Aperçu de l'apparence (spec gabarits-couleurs § 4) : lecture validée des
 * paramètres d'adresse de `/apercu/apparence`, et contrôle d'accès I28.
 *
 * I29 : l'adresse est une entrée non fiable. Tout paramètre invalide ou
 * inconnu est ignoré et remplacé par la valeur en base ; rien de ce module ne
 * sort sans avoir passé le format I24 (`^#[0-9a-fA-F]{6}$`). Les couleurs
 * rendues sont en minuscules, les listes (gabarit, langue) sont closes.
 *
 * La commune reste chargée par la page : ce module ne touche ni réseau ni
 * base pour ce qui est pur (`lireParametresApercu`), et délègue le reste au
 * client Payload de la page.
 */

import { GABARITS } from '@/gabarits/registre'

import type { Choix, CleForcee, Forcees } from './couleurs'
import { FRANCAIS, estCodeLangue, type CodeLangue } from './langues'

/** I24 : la seule écriture d'une couleur acceptée. */
const FORMAT_COULEUR = /^#[0-9a-fA-F]{6}$/

const CLES_FORCEES = [
  'texte',
  'pale',
  'profond',
  'picto1',
  'picto2',
  'picto3',
  'picto4',
  'picto5',
  'picto6',
] as const satisfies readonly CleForcee[]

/** Ce que la commune a enregistré : la valeur de repli de chaque paramètre. */
export interface ValeursEnBase {
  gabarit: string | null
  choix: Choix | null
  forcees: Forcees | null
}

export interface ParametresApercu {
  communeId: number | null
  gabarit: string
  choix: Choix
  forcees: Forcees
  lang: CodeLangue
}

/** Une couleur valide, en minuscules ; sinon la valeur en base (I29). */
function couleurOu(base: string | null | undefined, brute: string | null): string | null {
  if (brute !== null && FORMAT_COULEUR.test(brute)) return brute.toLowerCase()
  return base ?? null
}

/** Identifiant de commune : entier décimal strict et sûr, sinon `null`. */
export function idCommune(params: URLSearchParams): number | null {
  const brute = params.get('commune')
  if (brute === null || !/^\d+$/.test(brute)) return null
  const id = Number(brute)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Paramètres d'aperçu validés. `get()` rend la première occurrence : un paramètre répété ne fait jamais passer la seconde. */
export function lireParametresApercu(
  params: URLSearchParams,
  enBase: ValeursEnBase,
): ParametresApercu {
  const choix: Choix = {
    principale: couleurOu(enBase.choix?.principale, params.get('principale')),
    accent: couleurOu(enBase.choix?.accent, params.get('accent')),
    terre: couleurOu(enBase.choix?.terre, params.get('terre')),
  }

  // Décision 6 : une forcée hors format est ignorée — la valeur en base
  // l'emporte, la saisie ne passe jamais telle quelle.
  const forcees: Forcees = {}
  for (const cle of CLES_FORCEES) {
    const valeur = couleurOu(enBase.forcees?.[cle], params.get(cle))
    if (valeur !== null) forcees[cle] = valeur
  }

  const gabaritBrut = params.get('gabarit')
  const gabarit =
    gabaritBrut !== null && Object.hasOwn(GABARITS, gabaritBrut)
      ? gabaritBrut
      : (enBase.gabarit ?? 'village')

  const langBrute = params.get('lang')
  const lang = langBrute !== null && estCodeLangue(langBrute) ? langBrute : FRANCAIS

  return { communeId: idCommune(params), gabarit, choix, forcees, lang }
}

// Contrôle d'accès déplacé dans apercu-acces (sans registre) pour tenir le
// registre hors du bundle admin ; réexporté pour ne casser aucun appelant.
export { peutApercevoir } from './apercu-acces'
