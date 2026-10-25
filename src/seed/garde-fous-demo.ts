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
  DEMO_MDP_OPERATEUR?: string | undefined
  DEMO_MDP_ADMIN?: string | undefined
  DEMO_MDP_REDACTEUR?: string | undefined
}

/** Longueur minimale des mots de passe de démonstration (brief, partie A). */
export const TAILLE_MDP_MIN = 16

/**
 * DEMO_DOMAIN : un domaine nu — ni schéma, ni port, ni slash, ni point final —
 * avec au moins un point (une seule étiquette entrerait en collision avec les
 * hostnames réservés de la plateforme, cf. hostnamesReserves).
 */
export function domaineDemoValide(domaine: string): boolean {
  return (
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(domaine) &&
    !domaine.includes('..')
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
      'DEMO_DOMAIN : domaine nu attendu (sans schéma, port ni slash), avec au moins un point — ex. demo.pdlm.guia.fr',
    )
  const tropCourts = motsDePasseTropCourts(env)
  if (tropCourts.length > 0)
    erreurs.push(`Mot(s) de passe trop courts (< ${TAILLE_MDP_MIN} caractères) : ${tropCourts.join(', ')}`)
  return erreurs
}

/** Un hostname de démo vit sous DEMO_DOMAIN : `<sous-domaine>.<DEMO_DOMAIN>`. */
export function estHostnameDemo(hostname: string, domaine: string): boolean {
  return hostname.endsWith(`.${domaine}`) && hostname.length > domaine.length + 1
}
