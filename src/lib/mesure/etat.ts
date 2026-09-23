/** Forme minimale d'une commune pour décider de la mesure (compatible avec `Commune`). */
export interface CommuneMesurable {
  mesure?: { active?: boolean | null; siteUmami?: string | null } | null
}

/** Sans UMAMI_URL, la mesure d'audience n'existe pas sur cette plateforme. */
export function mesureInstallee(): boolean {
  return Boolean(process.env.UMAMI_URL)
}

/** Identifiant du site Umami de la commune, ou null si rien ne doit être mesuré. */
export function siteMesure(commune: CommuneMesurable | null | undefined): string | null {
  if (!mesureInstallee() || commune?.mesure?.active !== true) return null
  return commune.mesure.siteUmami || null
}
