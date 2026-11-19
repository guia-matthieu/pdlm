import type { CollectionBeforeChangeHook } from 'payload'
import { ValidationError } from 'payload'

import type { UtilisateurAcces } from '../access/roles'
import { isOperateur } from '../access/roles'

/**
 * Retouche X — un compte de démonstration partagé (dont le mot de passe est
 * public, donné aux visiteurs) ne doit pas pouvoir être verrouillé ou
 * détourné par qui que ce soit se connectant AVEC lui : pas de changement de
 * mot de passe, pas de changement de courriel.
 *
 * La liste vit dans la variable d'environnement `COMPTES_PARTAGES`
 * (courriels séparés par des virgules) : absente en production, elle n'y a
 * aucun effet. La pile démo la pose à `relais@pdlm.invalid` dans
 * docker-compose.demo.yml — en dur, pas dans le `.env`.
 *
 * Refusé : l'auteur de la requête EST le compte modifié, ce compte est
 * listé, et la requête touche `password` ou `email`. Jamais touchés :
 * l'opérateur (qui gère les comptes, invariant I2) et les appels internes
 * sans `req.user` (seed, Local API — la nuit re-pose les mots de passe de la
 * référence). `figerPrivileges` rétablit déjà l'email en silence pour un
 * non-opérateur ; ce hook AVANT lui rend le refus explicite et couvre le
 * mot de passe, que figerPrivileges ne touche pas.
 */

/** Courriels de `COMPTES_PARTAGES`, normalisés (trim + minuscule). */
export function lireComptesPartages(valeur: string | undefined): string[] {
  if (!valeur) return []
  return valeur
    .split(',')
    .map((courriel) => courriel.trim().toLowerCase())
    .filter((courriel) => courriel.length > 0)
}

export interface ContexteRefusIdentite {
  comptesPartages: readonly string[]
  auteur: UtilisateurAcces | null | undefined
  cible: {
    id: string | number | null | undefined
    email: string | null | undefined
  }
  /** Champs de la requête : seul `password` et `email` y sont regardés. */
  modifie: { email?: unknown; password?: unknown; [champ: string]: unknown }
}

/**
 * Champ d'identité que la modification tente de changer (`'password'` ou
 * `'email'`), ou `null` si elle est permise. Fonction pure (retouche X) :
 * l'environnement et la requête y entrent comme arguments, jamais lus dedans.
 */
export function champIdentiteInterdit(
  contexte: ContexteRefusIdentite,
): 'password' | 'email' | null {
  const { auteur, cible, modifie } = contexte
  // Sans auteur (seed, Local API sans req.user) : jamais refusé.
  if (!auteur || isOperateur(auteur)) return null
  // Le compte modifié doit être un compte partagé listé.
  if (!cible.email) return null
  const listes = new Set(contexte.comptesPartages.map((courriel) => courriel.toLowerCase()))
  if (!listes.has(cible.email.toLowerCase())) return null
  // L'auteur doit ÊTRE le compte modifié — un autre compte n'a de toute
  // façon pas le droit d'éditer celui-ci (access update).
  if (String(auteur.id ?? '') !== String(cible.id ?? '')) return null
  // Enfin, la requête doit toucher effectivement l'un des deux champs.
  if (typeof modifie.password === 'string' && modifie.password.length > 0) return 'password'
  if (modifie.email !== undefined && modifie.email !== cible.email) return 'email'
  return null
}

export const protegerComptePartage: CollectionBeforeChangeHook = ({
  req,
  data,
  originalDoc,
  operation,
}) => {
  if (operation !== 'update') return data
  // originalDoc existe toujours en update ; le garde protège le typage.
  const original = originalDoc as
    | { id?: string | number; email?: string | null }
    | undefined
  const interdit =
    original &&
    champIdentiteInterdit({
      comptesPartages: lireComptesPartages(process.env.COMPTES_PARTAGES),
      auteur: req.user as UtilisateurAcces | null | undefined,
      cible: { id: original.id, email: original.email ?? null },
      modifie: data as { email?: unknown; password?: unknown; [champ: string]: unknown },
    })
  if (interdit) {
    throw new ValidationError({
      errors: [
        {
          message: 'Compte de démonstration partagé : mot de passe et courriel non modifiables',
          path: interdit,
        },
      ],
    })
  }
  return data
}
