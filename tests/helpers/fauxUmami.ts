import { randomBytes, randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Faux serveur Umami : reproduit les réponses d'Umami 3.4.0 relevées par
 * exécution le 23/09 (voir la spec, « Points vérifiés par exécution ») et
 * enregistre tout ce qu'il reçoit. `reglages.panne` coupe la connexion comme
 * un conteneur arrêté ; `reglages.delaiEnvoiMs` ralentit /api/send ;
 * `reglages.horsEquipe` imite un compte `pdlm` retiré de l'équipe (clé
 * valide, mais équipe et sites en 401).
 */
export const CLE_TEST = 'umami_clefauxumamipourlestests0000'
export const EQUIPE_TEST = '820bdb78-5430-4fcf-8840-47971ea98a9e'
export const PUBLIC_TEST = 'https://stats.pdlm.test'

export interface RequeteRecue {
  methode: string
  chemin: string
  entetes: IncomingHttpHeaders
  corps: string
}

export interface FauxUmami {
  url: string
  recues: RequeteRecue[]
  sites: Map<string, { teamId: string; name: string; domain: string }>
  partages: Map<string, Array<{ id: string; slug: string; name: string; parameters: unknown }>>
  reglages: {
    panne: boolean
    delaiEnvoiMs: number
    horsEquipe: boolean
    /** Si défini, /api/send répond ce statut avec un corps vide (panne simulée côté Umami). */
    statutEnvoi?: number
    /** Appelé à réception d'une remise à zéro, avant de répondre. */
    surReset?: () => Promise<void>
  }
  vider(): void
  fermer(): Promise<void>
}

export function configurerUmami(url: string): void {
  process.env.UMAMI_URL = url
  process.env.UMAMI_API_KEY = CLE_TEST
  process.env.UMAMI_TEAM_ID = EQUIPE_TEST
  process.env.UMAMI_PUBLIC_URL = PUBLIC_TEST
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((ok, ko) => {
    let texte = ''
    req.setEncoding('utf8')
    req.on('data', (morceau: string) => (texte += morceau))
    req.on('end', () => ok(texte))
    req.on('error', ko)
  })
}

function json(res: ServerResponse, statut: number, corps?: unknown): void {
  res.writeHead(statut, { 'content-type': 'application/json' })
  res.end(corps === undefined ? '' : JSON.stringify(corps))
}

const NON_AUTORISE = { error: { message: 'Unauthorized', code: 'unauthorized', status: 401 } }

/**
 * Script de mesure minimal : lit la balise comme le vrai (data-website-id,
 * data-host-url) et poste une page vue au relais. Il éprouve la chaîne
 * balise → relais → Umami dans les tests de bout en bout ; le vrai script
 * d'Umami est éprouvé à la recette (tâche 15).
 */
export const SCRIPT_FAUX = `(function () {
  var s = document.currentScript; if (!s) return;
  fetch((s.getAttribute('data-host-url') || '') + '/api/send', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'event', payload: { website: s.getAttribute('data-website-id'),
      hostname: location.hostname, url: location.href, referrer: document.referrer,
      title: document.title, screen: screen.width + 'x' + screen.height, language: navigator.language } })
  });
})();`

export async function demarrerFauxUmami(port = 0): Promise<FauxUmami> {
  const recues: RequeteRecue[] = []
  const sites: FauxUmami['sites'] = new Map()
  const partages: FauxUmami['partages'] = new Map()
  const reglages: FauxUmami['reglages'] = { panne: false, delaiEnvoiMs: 0, horsEquipe: false }

  const serveur = createServer(async (req, res) => {
    const corps = await lireCorps(req)
    const chemin = (req.url ?? '/').split('?')[0]
    const methode = req.method ?? 'GET'
    recues.push({ methode, chemin, entetes: req.headers, corps })
    if (reglages.panne) {
      req.socket.destroy()
      return
    }

    if (methode === 'GET' && chemin === '/script.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' })
      res.end(SCRIPT_FAUX)
      return
    }
    if (methode === 'POST' && chemin === '/api/send') {
      await new Promise((r) => setTimeout(r, reglages.delaiEnvoiMs))
      if (res.destroyed) return
      if (reglages.statutEnvoi !== undefined) {
        res.writeHead(reglages.statutEnvoi)
        res.end()
        return
      }
      json(res, 200, { cache: 'jeton-faux', sessionId: 's', visitId: 'v' })
      return
    }
    if (req.headers.authorization !== `Bearer ${CLE_TEST}`) return json(res, 401, NON_AUTORISE)
    if (methode === 'GET' && chemin === '/api/me')
      return json(res, 200, { user: { username: 'pdlm' } })
    if (methode === 'GET' && chemin === `/api/teams/${EQUIPE_TEST}`) {
      return reglages.horsEquipe
        ? json(res, 401, NON_AUTORISE)
        : json(res, 200, { id: EQUIPE_TEST })
    }
    if (methode === 'POST' && chemin === '/api/websites') {
      const d = JSON.parse(corps) as { id: string; name: string; domain: string; teamId: string }
      if (sites.has(d.id)) return json(res, 500) // 3.4.0 : identifiant déjà pris → 500 sans corps
      sites.set(d.id, { teamId: d.teamId, name: d.name, domain: d.domain })
      return json(res, 200, { id: d.id, name: d.name, domain: d.domain, teamId: d.teamId })
    }
    const m = chemin.match(/^\/api\/websites\/([0-9a-f-]{36})(\/shares|\/reset)?$/)
    if (m) {
      const [, id, suite] = m
      const site = sites.get(id)
      // 3.4.0 : site absent, ou hors de portée du compte → 401
      if (!site || reglages.horsEquipe) return json(res, 401, NON_AUTORISE)
      if (!suite && methode === 'GET') return json(res, 200, { id, ...site })
      if (!suite && methode === 'DELETE') {
        sites.delete(id)
        partages.delete(id)
        return json(res, 200, { ok: true })
      }
      if (suite === '/reset' && methode === 'POST') {
        await reglages.surReset?.()
        return json(res, 200, { ok: true })
      }
      if (suite === '/shares' && methode === 'GET') {
        const data = partages.get(id) ?? []
        return json(res, 200, { data, count: data.length, page: 1, pageSize: 10 })
      }
      if (suite === '/shares' && methode === 'POST') {
        const d = JSON.parse(corps) as { name: string; parameters?: unknown }
        const partage = {
          id: randomUUID(),
          slug: randomBytes(8).toString('hex'),
          name: d.name,
          parameters: d.parameters ?? {},
        }
        partages.set(id, [...(partages.get(id) ?? []), partage])
        return json(res, 200, { ...partage, entityId: id, shareType: 1 })
      }
    }
    json(res, 404)
  })

  await new Promise<void>((ok) => serveur.listen(port, '127.0.0.1', ok))
  const { port: portReel } = serveur.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${portReel}`,
    recues,
    sites,
    partages,
    reglages,
    vider: () => {
      recues.length = 0
    },
    fermer: () =>
      new Promise<void>((ok) => {
        serveur.closeAllConnections()
        serveur.close(() => ok())
      }),
  }
}
