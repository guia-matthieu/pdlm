import { identifiantSite } from './uuid'

/**
 * Umami ne répond pas, refuse, ou la configuration manque. Le message est
 * technique (journaux du serveur) : l'appelant choisit celui montré à l'agent.
 */
export class UmamiIndisponible extends Error {
  /** Vrai quand Umami n'a pas répondu (réseau, délai) : l'action a peut-être eu lieu. */
  readonly sansReponse: boolean

  constructor(detail: string, sansReponse = false) {
    super(`Umami : ${detail}`)
    this.name = 'UmamiIndisponible'
    this.sansReponse = sansReponse
  }
}

interface ConfigUmami {
  url: string
  cle: string
  equipe: string
  publique: string
}

function configUmami(): ConfigUmami {
  const { UMAMI_URL, UMAMI_API_KEY, UMAMI_TEAM_ID, UMAMI_PUBLIC_URL } = process.env
  if (!UMAMI_URL || !UMAMI_API_KEY || !UMAMI_TEAM_ID || !UMAMI_PUBLIC_URL) {
    throw new UmamiIndisponible(
      'configuration incomplète (UMAMI_URL, UMAMI_API_KEY, UMAMI_TEAM_ID, UMAMI_PUBLIC_URL)',
    )
  }
  return {
    url: UMAMI_URL.replace(/\/$/, ''),
    cle: UMAMI_API_KEY,
    equipe: UMAMI_TEAM_ID,
    publique: UMAMI_PUBLIC_URL.replace(/\/$/, ''),
  }
}

async function appeler(chemin: string, methode = 'GET', corps?: unknown): Promise<Response> {
  const { url, cle } = configUmami()
  try {
    return await fetch(`${url}${chemin}`, {
      method: methode,
      headers: {
        authorization: `Bearer ${cle}`,
        ...(corps !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(5000),
    })
  } catch (erreur) {
    throw new UmamiIndisponible(
      `${methode} ${chemin} sans réponse (${(erreur as Error).message})`,
      true,
    )
  }
}

function exiger(reponse: Response, quoi: string): void {
  if (!reponse.ok) throw new UmamiIndisponible(`${quoi} refusé (${reponse.status})`)
}

interface Partage {
  slug: string
  parameters?: unknown
}

/**
 * Lu dans le code d'Umami et vérifié par exécution : dès que `events`,
 * `realtime` ou `revenue` est permis, un lien de partage ouvre le détail des
 * sessions. Seule la vue d'ensemble est donc acceptée.
 */
function estVueEnsembleSeule(parametres: unknown): boolean {
  return (
    typeof parametres === 'object' &&
    parametres !== null &&
    Object.keys(parametres).length === 1 &&
    (parametres as { overview?: unknown }).overview === true
  )
}

/**
 * Crée (ou retrouve) le site Umami d'une commune et son lien de partage.
 * Idempotent : l'identifiant est déterministe, et Umami 3.4.0 répond 500 sans
 * corps quand il est déjà pris — c'est la lecture du site qui tranche.
 */
export async function creerSiteCommune(commune: {
  id: number
  nom: string
  domaine: string
}): Promise<{ siteUmami: string; lienPartage: string }> {
  const { equipe, publique } = configUmami()
  const id = identifiantSite(commune.id)

  const creation = await appeler('/api/websites', 'POST', {
    id,
    name: commune.nom,
    domain: commune.domaine,
    teamId: equipe,
  })
  if (!creation.ok) {
    const lecture = await appeler(`/api/websites/${id}`)
    exiger(lecture, 'création du site')
    const site = (await lecture.json()) as { teamId?: string }
    if (site.teamId !== equipe) {
      throw new UmamiIndisponible(`le site ${id} existe hors de l’équipe UMAMI_TEAM_ID`)
    }
  }

  const liste = await appeler(`/api/websites/${id}/shares`)
  exiger(liste, 'lecture des partages')
  const { data } = (await liste.json()) as { data: Partage[] }
  let partage = data.find((p) => estVueEnsembleSeule(p.parameters))
  if (!partage) {
    const nouveau = await appeler(`/api/websites/${id}/shares`, 'POST', {
      name: 'Vue d’ensemble (maire)',
      parameters: { overview: true },
    })
    exiger(nouveau, 'création du lien de partage')
    partage = (await nouveau.json()) as Partage
  }
  return { siteUmami: id, lienPartage: `${publique}/share/${partage.slug}` }
}

/** Efface visites et sessions ; le site et son lien de partage restent (vérifié le 23/09). */
export async function effacerHistorique(siteUmami: string): Promise<void> {
  exiger(await appeler(`/api/websites/${siteUmami}/reset`, 'POST'), 'remise à zéro')
}

/**
 * Supprime définitivement le site (et son partage). Umami répond 401 aussi
 * bien pour un site absent que pour un compte qui a perdu ses droits.
 * Vérifié le 23/09 : un compte retiré de l'équipe garde `/api/me` à 200 mais
 * perd `GET /api/teams/:id`. Seul un membre de l'équipe qui ne voit pas le
 * site prouve son absence ; sinon, c'est un vrai refus.
 */
export async function supprimerSite(siteUmami: string): Promise<void> {
  const reponse = await appeler(`/api/websites/${siteUmami}`, 'DELETE')
  if (reponse.ok) return
  if (reponse.status === 401) {
    const equipe = await appeler(`/api/teams/${configUmami().equipe}`)
    if (equipe.ok && (await appeler(`/api/websites/${siteUmami}`)).status === 401) return
  }
  throw new UmamiIndisponible(`suppression du site refusée (${reponse.status})`)
}
