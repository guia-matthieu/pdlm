import type { CollectionBeforeChangeHook } from 'payload'

import { Forbidden } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'

/**
 * I1/I36 — à la création, la commune qui compte est celle des DONNÉES FINALES.
 * Les access functions (`creerContenu`, `creerPublication`) ne la voient pas
 * toujours : le plugin multi-tenant remplit un `tenant` absent depuis le cookie
 * `payload-tenant` APRÈS l'accès, en vérifiant seulement que la commune est
 * lisible. Sans ce garde, un admin de A et rédacteur de B publierait dans B.
 * Un `beforeChange` de collection tourne après les valeurs par défaut des
 * champs : `data.tenant` est la valeur définitive.
 * Appels internes (sans `req.user`) et opérateurs passent.
 */
export const verifierCommuneCreation =
  (...roles: string[]): CollectionBeforeChangeHook =>
  ({ data, operation, req }) => {
    if (operation !== 'create') return data
    if (!req.user || isOperateur(req.user)) return data
    const tenant = (data as { tenant?: unknown }).tenant
    const id =
      tenant && typeof tenant === 'object' && 'id' in tenant
        ? (tenant as { id: unknown }).id
        : tenant
    if (!aRoleSur(req.user, id as string | number | null | undefined, ...roles)) {
      throw new Forbidden(req.t)
    }
    return data
  }
