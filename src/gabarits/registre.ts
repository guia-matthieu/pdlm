/**
 * Registre des gabarits. Décision 18 : `village`, rejoint par `littoral` à la
 * tâche 8. La suite de conformité est paramétrée par `Object.keys(GABARITS)` :
 * un gabarit ajouté y passe sans qu'elle change.
 */

import { gabarit as gabaritLittoral } from './littoral/gabarit'
import { gabarit as gabaritVillage } from './village/gabarit'
import { illustrations as illustrationsLittoral } from './littoral/illustrations'
import { illustrations as illustrationsVillage } from './village/illustrations'
import { kit as kitLittoral } from './littoral/frise'
import { kit as kitVillage } from './village/frise'
import type { Gabarit, Illustrations, Kit } from './types'

export type NomGabarit = 'village' | 'littoral'

export type EntreeGabarit = { gabarit: Gabarit; kit: Kit; illustrations: Illustrations }

/** `village` requis, `littoral` compris (tâche 8) : `Object.keys` ne liste que l'existant. */
export const GABARITS: { village: EntreeGabarit } & Partial<Record<NomGabarit, EntreeGabarit>> = {
  village: { gabarit: gabaritVillage, kit: kitVillage, illustrations: illustrationsVillage },
  littoral: { gabarit: gabaritLittoral, kit: kitLittoral, illustrations: illustrationsLittoral },
}

/** Le gabarit d'une commune ; toute valeur inconnue replie sur `village`. */
export function gabaritDe(nom: string | null | undefined): EntreeGabarit {
  if (nom && Object.hasOwn(GABARITS, nom)) {
    const entree = GABARITS[nom as NomGabarit]
    if (entree) return entree
  }
  return GABARITS.village
}
