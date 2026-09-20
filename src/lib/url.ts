/** Schémas autorisés pour les URLs saisies par les rédacteurs (jamais javascript:, data:, etc.). */
const SCHEMAS_AUTORISES = ['http:', 'https:', 'mailto:', 'tel:']

export function validerUrlEditoriale(valeur: string | null | undefined): true | string {
  if (!valeur) return true
  try {
    const u = new URL(valeur)
    return (
      SCHEMAS_AUTORISES.includes(u.protocol) ||
      'URL invalide (http, https, mailto ou tel uniquement).'
    )
  } catch {
    return 'URL invalide (http, https, mailto ou tel uniquement).'
  }
}
