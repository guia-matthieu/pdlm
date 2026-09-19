import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Invariant I1 : le changement de `tenant` après création est interdit pour
 * TOUS, opérateur compris — déplacer une cible référencée créerait des
 * références intercommunales sans réexécuter les hooks des documents sources.
 * (Migration contrôlée de tenant : v0.2+.)
 */
export const figerTenant: CollectionBeforeChangeHook = ({ originalDoc, data }) => {
  if (
    originalDoc &&
    data &&
    'tenant' in data &&
    'tenant' in originalDoc &&
    String((data as { tenant?: unknown }).tenant ?? '') !==
      String((originalDoc as { tenant?: unknown }).tenant ?? '')
  ) {
    throw new Error('Le rattachement de commune d’un contenu existant ne peut pas être modifié.')
  }
  return data
}
