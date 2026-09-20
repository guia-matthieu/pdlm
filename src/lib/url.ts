/** Schémas autorisés pour les URLs absolues saisies par les rédacteurs (jamais javascript:, data:, etc.). */
const SCHEMAS_AUTORISES = ['http:', 'https:', 'mailto:', 'tel:']

/**
 * URLs éditoriales valides : chemins relatifs internes (« /actualites ») ou
 * URLs absolues http/https/mailto/tel. Jamais javascript:, data:, etc.
 */
export function validerUrlEditoriale(valeur: string | null | undefined): true | string {
  if (!valeur) return true
  if (valeur.startsWith('/') && !valeur.startsWith('//')) return true
  try {
    const u = new URL(valeur)
    return (
      SCHEMAS_AUTORISES.includes(u.protocol) ||
      'URL invalide (chemin interne « /… » ou http, https, mailto, tel).'
    )
  } catch {
    return 'URL invalide (chemin interne « /… » ou http, https, mailto, tel).'
  }
}
