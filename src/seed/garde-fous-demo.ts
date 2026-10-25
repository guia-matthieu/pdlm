/**
 * Garde-fous du seed de démonstration en ligne (brief 2026-10-25, partie A).
 *
 * Logique PURE, sans base ni effet de bord à l'import : le script
 * `demo-en-ligne.ts` travaille au chargement du module (top-level await),
 * ces fonctions doivent donc vivre ailleurs pour être testées (tests/unit/).
 */

/** Variables d'environnement lues par le seed de démo en ligne. */
export interface EnvDemo {
  DEMO_DOMAIN?: string | undefined
  PLATFORM_DOMAIN?: string | undefined
  DEMO_MDP_OPERATEUR?: string | undefined
  DEMO_MDP_ADMIN?: string | undefined
  DEMO_MDP_REDACTEUR?: string | undefined
}

/** Longueur minimale des mots de passe de démonstration (brief, partie A). */
export const TAILLE_MDP_MIN = 16

/** Nombre d'étiquettes d'un domaine : `demo.pdlm.guia.fr` → 4 (retouche G). */
export function nbEtiquettes(domaine: string): number {
  return domaine.split('.').filter((e) => e !== '').length
}

/**
 * DEMO_DOMAIN : un domaine nu — ni schéma, ni port, ni slash, ni point final —
 * avec au moins TROIS étiquettes (retouche G : `guia.fr` ou `com.fr` seraient
 * des domaines réels, pas un sous-domaine dédié à la démo ; une seule étiquette
 * entrerait en collision avec les hostnames réservés de la plateforme).
 */
export function domaineDemoValide(domaine: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domaine) &&
    !domaine.includes('..') &&
    nbEtiquettes(domaine) >= 3
  )
}

/** Variables obligatoires manquantes ou vides — noms seulement, jamais les valeurs. */
export function variablesManquantes(env: EnvDemo): string[] {
  const manquantes: string[] = []
  if (!env.DEMO_DOMAIN) manquantes.push('DEMO_DOMAIN')
  if (!env.DEMO_MDP_OPERATEUR) manquantes.push('DEMO_MDP_OPERATEUR')
  if (!env.DEMO_MDP_ADMIN) manquantes.push('DEMO_MDP_ADMIN')
  if (!env.DEMO_MDP_REDACTEUR) manquantes.push('DEMO_MDP_REDACTEUR')
  return manquantes
}

/** Mots de passe présents mais trop courts — noms seulement, jamais les valeurs. */
export function motsDePasseTropCourts(env: EnvDemo): string[] {
  const tropCourts: string[] = []
  if (env.DEMO_MDP_OPERATEUR && env.DEMO_MDP_OPERATEUR.length < TAILLE_MDP_MIN)
    tropCourts.push('DEMO_MDP_OPERATEUR')
  if (env.DEMO_MDP_ADMIN && env.DEMO_MDP_ADMIN.length < TAILLE_MDP_MIN)
    tropCourts.push('DEMO_MDP_ADMIN')
  if (env.DEMO_MDP_REDACTEUR && env.DEMO_MDP_REDACTEUR.length < TAILLE_MDP_MIN)
    tropCourts.push('DEMO_MDP_REDACTEUR')
  return tropCourts
}

/** Erreurs d'environnement prêtes à journaliser — noms de variables, jamais de valeurs. */
export function erreursEnvironnementDemo(env: EnvDemo): string[] {
  const erreurs: string[] = []
  const manquantes = variablesManquantes(env)
  if (manquantes.length > 0)
    erreurs.push(`Variable(s) manquante(s) ou vide(s) : ${manquantes.join(', ')}`)
  if (env.DEMO_DOMAIN && !domaineDemoValide(env.DEMO_DOMAIN))
    erreurs.push(
      'DEMO_DOMAIN : domaine nu attendu (sans schéma, port ni slash), avec au moins trois étiquettes — ex. demo.pdlm.guia.fr, pas guia.fr',
    )
  // Retouche G : le seed sert des hostnames <slug>.<DEMO_DOMAIN> — si la
  // plateforme en sert d'autres, DEMO_DOMAIN et PLATFORM_DOMAIN doivent être
  // le MÊME domaine. Les deux noms de variables, jamais les valeurs.
  if (env.DEMO_DOMAIN && env.PLATFORM_DOMAIN && env.DEMO_DOMAIN !== env.PLATFORM_DOMAIN)
    erreurs.push('DEMO_DOMAIN et PLATFORM_DOMAIN divergent — le seed exige qu’ils soient égaux.')
  const tropCourts = motsDePasseTropCourts(env)
  if (tropCourts.length > 0)
    erreurs.push(`Mot(s) de passe trop courts (< ${TAILLE_MDP_MIN} caractères) : ${tropCourts.join(', ')}`)
  return erreurs
}

/** Un hostname de démo vit sous DEMO_DOMAIN : `<sous-domaine>.<DEMO_DOMAIN>`. */
export function estHostnameDemo(hostname: string, domaine: string): boolean {
  return hostname.endsWith(`.${domaine}`) && hostname.length > domaine.length + 1
}

/** Commune lue en base : seul son slug compte pour le garde-fou (retouche G). */
export interface CommuneLue {
  slug: string
}

/** Domaine lu en base : hostname et commune de rattachement (retouche G). */
export interface DomaineLu {
  hostname: string
  commune: number
}

/**
 * Retouche G : slugs de communes présents en base mais hors du jeu de démo.
 * Le seed refuse de tourner sur une base qui contient autre chose que les
 * communes de la démo (une base réelle ne doit jamais être re-seedée).
 */
export function slugsEtrangers(slugs: string[], slugsDemo: string[]): string[] {
  return slugs.filter((slug) => !slugsDemo.includes(slug))
}

/**
 * Retouche G : hostnames de démo déjà pris par un domaine rattaché à une
 * AUTRE commune — DEMO_DOMAIN recouvrirait des sites existants.
 */
export function domainesMalRattaches(
  domaines: DomaineLu[],
  attendus: Array<{ hostname: string; commune: number }>,
): string[] {
  return attendus
    .filter((attendu) => {
      const existant = domaines.find((d) => d.hostname === attendu.hostname)
      return existant !== undefined && existant.commune !== attendu.commune
    })
    .map((attendu) => attendu.hostname)
}
