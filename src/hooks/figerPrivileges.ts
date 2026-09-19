import type { CollectionBeforeChangeHook } from 'payload'

import { isOperateur } from '../access/roles'

/**
 * Invariant I2 : seul un opérateur peut modifier `role` et `tenants[].roles`.
 * Ce hook force la conservation des valeurs d’origine pour tout non-opérateur
 * (couvre create ET update, indépendamment du field access) — un utilisateur
 * qui s’auto-modifie ne touche qu’à ses champs personnels.
 */
export const figerPrivileges: CollectionBeforeChangeHook = ({ req, originalDoc, data }) => {
  if (isOperateur(req.user)) return data

  if (originalDoc) {
    ;(data as Record<string, unknown>).role = originalDoc.role
    ;(data as Record<string, unknown>).tenants = originalDoc.tenants
    ;(data as Record<string, unknown>).email = originalDoc.email
  } else {
    // Création par un non-opérateur : refusée par l'access control (opérateur seul),
    // ce hook n'est qu'une ceinture de sécurité.
    delete (data as Record<string, unknown>).role
    delete (data as Record<string, unknown>).tenants
  }
  return data
}
