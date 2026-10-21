/**
 * Contrôle d'accès de l'aperçu d'apparence (I28), seul bout de `lib/apercu`
 * utile à l'admin : il vit ici pour que le composant client n'emporte pas le
 * registre des gabarits dans le bundle.
 */

import { aRoleSur, isOperateur, type UtilisateurAcces } from '@/access/roles'

/**
 * I28 : l'aperçu d'apparence d'une commune est servi à l'opérateur et à
 * l'admin de cette commune, à personne d'autre. Décision 15 : le mandataire
 * n'a pas la main sur la fiche commune — il n'aperçoit pas non plus.
 */
export function peutApercevoir(
  user: UtilisateurAcces | null | undefined,
  communeId: string | number | null | undefined,
): boolean {
  if (isOperateur(user)) return true
  return aRoleSur(user, communeId, 'admin')
}
