/**
 * Access functions partagées — invariants I1 et I3 du plan.
 *
 * Principe : la dimension « commune » est doublement garantie (contrainte du
 * plugin multi-tenant + nos contraintes `tenant: { in: [...] }` qui couvrent
 * aussi les opérations en masse). Ces factories n'expriment que la dimension
 * rôle.
 */
import type { Access } from 'payload'

import { communesAvecRole, isOperateur, ROLES_PUBLICATION, ROLES_REDACTION } from './roles'

/** Collections avec workflow drafts (pages, actualites) : l'anonyme ne lit que le publié. */
export const lirePublieOuAuthentifie: Access = ({ req }) =>
  isOperateur(req.user) || Boolean(req.user) || { _status: { equals: 'published' } }

/** Collections immédiatement publiques (media, documents, menus, evenements, alertes) : I5/D9. */
export const lirePublic: Access = () => true

const cibleDe = (data: unknown): string =>
  data && typeof data === 'object' && 'tenant' in data
    ? String((data as { tenant?: unknown }).tenant ?? '')
    : ''

/** Contenu rédigeable (brouillons) : opérateur, admin, rédacteur ou mandataire de la commune visée. */
export const creerContenu: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_REDACTION)
  // Évaluation du droit « afficher le formulaire de création » : l'admin passe
  // `undefined` (liste des permissions) ou `{ _status }` sans `tenant` (vue
  // document, mesuré en e2e) — un rôle sur au moins une commune suffit alors.
  // Payload's create operation always passes data to access (payload/dist/
  // collections/operations/create.js ~l.127-130) : une écriture réelle porte sa
  // commune, vérifiée ci-dessous ; sans commune, le champ `tenant` requis la refuse.
  const cible = cibleDe(data)
  if (data === undefined || cible === '') return ids.length > 0
  return ids.length > 0 && ids.includes(cible)
}

export const majContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_REDACTION)
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Suppression : opérateur ou admin de la commune uniquement (D1 : pas le mandataire). */
export const supprimerContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Collections publiées dès l'écriture (sans workflow) : opérateur, admin ou mandataire (I3, I36). */
export const creerPublication: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_PUBLICATION)
  // Évaluation du droit « afficher le formulaire de création » : l'admin passe
  // `undefined` (liste des permissions) ou `{ _status }` sans `tenant` (vue
  // document, mesuré en e2e) — un rôle sur au moins une commune suffit alors.
  // Payload's create operation always passes data to access (payload/dist/
  // collections/operations/create.js ~l.127-130) : une écriture réelle porte sa
  // commune, vérifiée ci-dessous ; sans commune, le champ `tenant` requis la refuse.
  const cible = cibleDe(data)
  if (data === undefined || cible === '') return ids.length > 0
  return ids.length > 0 && ids.includes(cible)
}

export const majPublication: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_PUBLICATION)
  return ids.length > 0 ? { tenant: { in: ids } } : false
}
