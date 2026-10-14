// Préfixes d'outre-mer laissés au format national : leur indicatif n'est pas
// +33. Liste recopiée du brief, non vérifiée contre le plan de numérotation.
const PREFIXES_OUTRE_MER = [
  '0262',
  '0263',
  '0269',
  '0508',
  '0590',
  '0594',
  '0596',
  '0639',
  '0690',
  '0691',
  '0692',
  '0693',
  '0694',
  '0696',
  '0697',
]

/**
 * Rend la valeur complète du `href` d'appel (`tel:` compris) : un numéro
 * français à dix chiffres devient joignable depuis l'étranger. Le texte
 * affiché, lui, reste la saisie telle quelle.
 */
export function lienTelephone(saisie: string): string {
  const plusEnTete = saisie.trim().startsWith('+')
  // Seuls les chiffres sont gardés ; un « + » ne survit que s'il est en tête.
  const chiffres = saisie.replace(/\D/g, '')

  if (plusEnTete && chiffres.length > 0) return `tel:+${chiffres}`
  if (chiffres.startsWith('00')) return `tel:+${chiffres.slice(2)}`
  if (
    chiffres.length === 10 &&
    chiffres.startsWith('0') &&
    !PREFIXES_OUTRE_MER.some((p) => chiffres.startsWith(p))
  ) {
    return `tel:+33${chiffres.slice(1)}`
  }
  return `tel:${chiffres}`
}
