import type { CollectionBeforeChangeHook } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'

/**
 * Invariant I3 : toute écriture aboutissant à l'état publié est réservée à
 * l'opérateur et aux admins de la commune du document. Cela couvre la
 * transition brouillon→publié ET la ré-écriture d'un contenu déjà publié
 * (sinon un rédacteur pourrait modifier directement la version publique en
 * soumettant `_status: 'published'` — contournement B3 identifié en revue).
 */
export const bloquerPublication: CollectionBeforeChangeHook = ({ req, originalDoc, data }) => {
  const apres = (data as { _status?: string } | undefined)?._status

  if (apres === 'published') {
    const commune =
      ((data as { tenant?: unknown }).tenant as string | number | undefined) ??
      ((originalDoc as { tenant?: unknown } | undefined)?.tenant as string | number | undefined)
    if (!isOperateur(req.user) && !aRoleSur(req.user, commune, 'admin')) {
      throw new Error('Seul un administrateur de la commune ou un opérateur peut publier.')
    }
  }
  return data
}
