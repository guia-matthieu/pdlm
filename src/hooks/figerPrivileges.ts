import type { CollectionBeforeChangeHook } from 'payload'

import { isOperateur } from '../access/roles'

/**
 * Invariant I2 : seul un opérateur peut modifier `role`, `organisation` et `tenants[].roles`.
 * Ce hook force la conservation des valeurs d’origine pour tout non-opérateur
 * (couvre create ET update, indépendamment du field access) — un utilisateur
 * qui s’auto-modifie ne touche qu’à ses champs personnels.
 * Les appels internes sans req.user (seed, overrideAccess) sont laissés passer :
 * l'access control a déjà bloqué toute requête externe non-opérateur.
 */
export const figerPrivileges: CollectionBeforeChangeHook = ({ req, originalDoc, data }) => {
  if (!req.user || isOperateur(req.user)) return data

  if (originalDoc) {
    ;(data as Record<string, unknown>).role = originalDoc.role
    ;(data as Record<string, unknown>).organisation = originalDoc.organisation
    ;(data as Record<string, unknown>).tenants = originalDoc.tenants
    ;(data as Record<string, unknown>).email = originalDoc.email
  }
  // Création : un non-opérateur n'atteint jamais ce stade (access create: operateur only)
  return data
}
