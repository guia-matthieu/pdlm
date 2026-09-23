/**
 * I18 / I19 — le corps transmis à Umami est reconstruit, jamais recopié.
 * Umami 3.4.0 accepte dans le corps `ip` (prioritaire sur les en-têtes),
 * `id` (identification d'un visiteur), `userAgent`, `timestamp`, etc. : seul
 * ce qui figure ici sort de pdlm, et `website`/`hostname` viennent du domaine
 * demandé, jamais du client.
 */
export interface VisiteFiltree {
  type: 'event'
  payload: {
    website: string
    hostname: string
    url: string
    referrer?: string
    title?: string
    screen?: string
    language?: string
  }
}

const RE_ECRAN = /^\d{1,5}x\d{1,5}$/
const RE_LANGUE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/
const LONGUEUR_MAX = 500

function urlWeb(valeur: string, host: string): URL | null {
  try {
    const u = new URL(valeur, `https://${host}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

export function filtrerVisite(
  brut: unknown,
  { host, siteUmami }: { host: string; siteUmami: string },
): VisiteFiltree | null {
  if (typeof brut !== 'object' || brut === null) return null
  const { type, payload } = brut as { type?: unknown; payload?: unknown }
  if (type !== 'event' || typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  // Événement nommé (clic, téléchargement) : hors périmètre, seules les pages vues passent.
  if (p.name !== undefined) return null
  if (typeof p.url !== 'string') return null
  const url = urlWeb(p.url, host)
  if (!url) return null

  const sortie: VisiteFiltree['payload'] = {
    website: siteUmami,
    hostname: host,
    url: url.pathname.slice(0, LONGUEUR_MAX),
  }
  if (typeof p.referrer === 'string' && p.referrer !== '') {
    const ref = urlWeb(p.referrer, host)
    if (ref) {
      const valeur = ref.hostname === host ? ref.pathname : `${ref.origin}${ref.pathname}`
      sortie.referrer = valeur.slice(0, LONGUEUR_MAX)
    }
  }
  if (typeof p.title === 'string' && p.title !== '') sortie.title = p.title.slice(0, LONGUEUR_MAX)
  if (typeof p.screen === 'string' && RE_ECRAN.test(p.screen)) sortie.screen = p.screen
  if (typeof p.language === 'string' && p.language.length <= 35 && RE_LANGUE.test(p.language)) {
    sortie.language = p.language
  }
  return { type: 'event', payload: sortie }
}
