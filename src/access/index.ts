/**
 * Access functions partagées — invariants I1 et I3 du plan.
 *
 * Principe : la dimension « commune » est doublement garantie (contrainte du
 * plugin multi-tenant + nos contraintes `tenant: { in: [...] }` qui couvrent
 * aussi les opérations en masse). Ces factories n'expriment que la dimension
 * rôle.
 */
import type { Access } from 'payload'

import { communesAvecRole, isOperateur } from './roles'

/** Collections avec workflow drafts (pages, actualites) : l'anonyme ne lit que le publié. */
export const lirePublieOuAuthentifie: Access = ({ req }) =>
  isOperateur(req.user) || Boolean(req.user) || { _status: { equals: 'published' } }

/** Collections immédiatement publiques (media, documents, menus, evenements, alertes) : I5/D9. */
export const lirePublic: Access = () => true

/** Contenu rédigeable (brouillons) : opérateur, admin ou rédacteur de la commune visée. */
export const creerContenu: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin', 'redacteur')
  const cible = data && 'tenant' in data ? String((data as { tenant?: unknown }).tenant ?? '') : ''
  return ids.length > 0 && cible !== '' && ids.includes(cible)
}

export const majContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin', 'redacteur')
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Suppression : opérateur ou admin de la commune uniquement. */
export const supprimerContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Écritures réservées aux admin/opérateur (collections sans workflow) : I3. */
export const creerAdmin: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  const cible = data && 'tenant' in data ? String((data as { tenant?: unknown }).tenant ?? '') : ''
  return ids.length > 0 && cible !== '' && ids.includes(cible)
}

export const majAdmin: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  return ids.length > 0 ? { tenant: { in: ids } } : false
}
