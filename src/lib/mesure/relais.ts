import { siteMesure, type CommuneMesurable } from './etat'
import { filtrerVisite } from './filtre'
import { ipVisiteur, tronquerIp } from './ip'
import { COOKIE_OPPOSITION, estOppose, lireCookie } from './opposition'

export const TAILLE_MAX_OCTETS = 4096
export const DELAI_UMAMI_MS = 3000

let dernierAvertissement = 0

/** Une panne d'Umami ne doit pas noyer les journaux : une ligne par minute au plus. */
function avertir(message: string): void {
  const maintenant = Date.now()
  if (maintenant - dernierAvertissement < 60_000) return
  dernierAvertissement = maintenant
  console.warn(`[mesure d’audience] ${message}`)
}

const rienTransmis = () => new Response(null, { status: 204 })

/**
 * Lit le corps en comptant les octets : un envoi fragmenté sans
 * Content-Length est coupé dès la limite, sans tout charger en mémoire.
 * Null : limite dépassée.
 */
async function lireBorne(requete: Request, max: number): Promise<string | null> {
  if (!requete.body) return ''
  const lecteur = requete.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await lecteur.cancel().catch(() => undefined)
      return null
    }
    morceaux.push(value)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

/**
 * Relais de collecte (spec, section 3). Garanties :
 * I18 — aucune IP complète ni aucun champ hors liste blanche ne sort vers Umami ;
 * I19 — seule une commune mesurée est transmise, sous son propre site ;
 * I20 — un visiteur opposé n'est pas transmis.
 */
export async function relayer(
  requete: Request,
  commune: CommuneMesurable | null,
  host: string,
): Promise<Response> {
  const umami = process.env.UMAMI_URL
  if (!umami) return new Response(null, { status: 404 })

  if (Number(requete.headers.get('content-length') ?? 0) > TAILLE_MAX_OCTETS) {
    return new Response(null, { status: 413 })
  }
  let texte: string | null
  try {
    texte = await lireBorne(requete, TAILLE_MAX_OCTETS)
  } catch {
    return new Response(null, { status: 400 }) // flux interrompu
  }
  if (texte === null) return new Response(null, { status: 413 })

  const site = siteMesure(commune)
  if (!site || estOppose(lireCookie(requete.headers.get('cookie'), COOKIE_OPPOSITION))) {
    return rienTransmis()
  }

  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return new Response(null, { status: 400 })
  }
  const visite = filtrerVisite(brut, { host, siteUmami: site })
  if (!visite) return rienTransmis()

  // En-têtes transmis, et eux seuls.
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  const agent = requete.headers.get('user-agent')
  if (agent) entetes['user-agent'] = agent
  const ip = tronquerIp(ipVisiteur(requete.headers.get('x-forwarded-for')) ?? '')
  if (ip) entetes['x-pdlm-ip'] = ip
  const jeton = requete.headers.get('x-umami-cache')
  if (jeton) entetes['x-umami-cache'] = jeton

  try {
    const reponse = await fetch(`${umami.replace(/\/$/, '')}/api/send`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify(visite),
      signal: AbortSignal.timeout(DELAI_UMAMI_MS),
    })
    return new Response(await reponse.text(), {
      status: reponse.status,
      headers: { 'content-type': reponse.headers.get('content-type') ?? 'application/json' },
    })
  } catch (erreur) {
    avertir(`Umami ne répond pas (${(erreur as Error).message}) : visites non comptées`)
    return rienTransmis()
  }
}
