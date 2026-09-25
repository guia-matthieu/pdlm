import { CODES_LANGUES } from '../langues'

/**
 * I20 — un visiteur qui s'est opposé n'est plus mesuré. Ce cookie ne sert
 * qu'à respecter l'opposition : il est lui-même exempté de consentement.
 */
export const COOKIE_OPPOSITION = 'pdlm_mesure'

/** 390 jours : sous le plafond de 13 mois fixé aux traceurs par la CNIL. */
export const DUREE_OPPOSITION_S = 390 * 24 * 60 * 60

export function lireCookie(entete: string | null, nom: string): string | undefined {
  for (const morceau of (entete ?? '').split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=')
    if (cle === nom) return valeur.join('=')
  }
  return undefined
}

export function estOppose(valeur: string | undefined): boolean {
  return valeur === 'refus'
}

export function enteteCookieOpposition(choix: 'refus' | 'accepte', production: boolean): string {
  const attributs = ['Path=/', 'HttpOnly', 'SameSite=Lax', ...(production ? ['Secure'] : [])]
  return choix === 'refus'
    ? [`${COOKIE_OPPOSITION}=refus`, `Max-Age=${DUREE_OPPOSITION_S}`, ...attributs].join('; ')
    : [`${COOKIE_OPPOSITION}=`, 'Max-Age=0', ...attributs].join('; ')
}

/**
 * Vrai si le formulaire d'opposition a été soumis depuis une autre origine :
 * `SameSite=Lax` n'empêche pas une réponse d'effacer le cookie. Sans
 * JavaScript, le navigateur envoie quand même `Origin` (et `Sec-Fetch-Site`)
 * sur un POST de formulaire. `hoteAttendu` : l'en-tête `Host` de la requête
 * (hôte ET port), transmis tel quel par Caddy jusqu'au serveur — jamais
 * `new URL(request.url).host`, que Next reconstruit depuis le hostname/port
 * d'écoute du serveur (`0.0.0.0:3000` en standalone), pas depuis `Host`. Un
 * formulaire intersite ne peut pas forger l'en-tête `Host` reçu par le
 * serveur. Le schéma n'est pas comparé : derrière Caddy, Next peut voir
 * `http` quand le navigateur voit `https`, et le HTTP est redirigé vers
 * HTTPS par Caddy. En-têtes absents (vieux client, curl) : accepté.
 */
export function soumissionIntersite(entetes: Headers, hoteAttendu: string): boolean {
  const site = entetes.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origine = entetes.get('origin')
  if (origine === null) return false
  try {
    return new URL(origine).host.toLowerCase() !== hoteAttendu.toLowerCase()
  } catch {
    return true // « null » ou valeur illisible
  }
}

const RETOUR = new RegExp(`^/(?:(?:${CODES_LANGUES.join('|')})/)?mesure-d-audience$`)

/** Retour après opposition : la page d'information, dans la langue d'où vient le visiteur. */
export function cheminRetour(valeur: unknown): string {
  return typeof valeur === 'string' && RETOUR.test(valeur) ? valeur : '/mesure-d-audience'
}
