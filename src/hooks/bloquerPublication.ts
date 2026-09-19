import type { CollectionBeforeChangeHook } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'

/**
 * Invariant I3 : la publication (transition `_status → 'published'`) est
 * réservée à l'opérateur et aux admins de la commune du document.
 * Avec drafts activés, l'édition d'un publié par un rédacteur crée un
 * brouillon — la version publique reste intacte jusqu'à publication.
 */
export const bloquerPublication: CollectionBeforeChangeHook = ({ req, originalDoc, data }) => {
  const avant = (originalDoc as { _status?: string } | undefined)?._status
  const apres = (data as { _status?: string } | undefined)?._status

  if (apres === 'published' && avant !== 'published') {
    const commune =
      ((data as { tenant?: unknown }).tenant as string | number | undefined) ??
      ((originalDoc as { tenant?: unknown } | undefined)?.tenant as string | number | undefined)
    if (!isOperateur(req.user) && !aRoleSur(req.user, commune, 'admin')) {
      throw new Error('Seul un administrateur de la commune ou un opérateur peut publier.')
    }
  }
  return data
}
