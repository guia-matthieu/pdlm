/** Schémas autorisés pour les URLs absolues saisies par les rédacteurs (jamais javascript:, data:, etc.). */
const SCHEMAS_AUTORISES = ['http:', 'https:', 'mailto:', 'tel:']

const MESSAGE = 'URL invalide (chemin interne « /… » ou http, https, mailto, tel).'

/** Origine fictive servant à résoudre un chemin interne comme le ferait un navigateur. */
const ORIGINE_INTERNE = 'https://interne.invalid'

/**
 * URLs éditoriales valides : chemins relatifs internes (« /actualites ») ou
 * URLs absolues http/https/mailto/tel. Jamais javascript:, data:, etc.
 */
export function validerUrlEditoriale(valeur: string | null | undefined): true | string {
  if (!valeur) return true
  if (valeur.startsWith('/')) {
    // Un chemin interne doit rester sur le site une fois résolu : `//hôte`,
    // `/\hôte` (le parseur WHATWG lit `\` comme `/`) ou une tabulation
    // (supprimée à l'analyse) mèneraient vers un domaine tiers.
    try {
      return new URL(valeur, ORIGINE_INTERNE).origin === ORIGINE_INTERNE || MESSAGE
    } catch {
      return MESSAGE
    }
  }
  try {
    const u = new URL(valeur)
    return SCHEMAS_AUTORISES.includes(u.protocol) || MESSAGE
  } catch {
    return MESSAGE
  }
}
