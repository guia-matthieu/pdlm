import { FRANCAIS, estCodeLangue, type CodeLangue } from './langues'

/**
 * Adresses multilingues (spec § 3) — fonctions pures, sans base : testables
 * seules, utilisables dans le proxy comme dans les pages.
 */

/** Valeur sentinelle de `[lang]` : « langue principale du domaine ». Jamais visible. */
export const RACINE = 'racine'

/** Routes qui vivent hors de `[lang]` : jamais réécrites. */
const HORS_LANGUE = [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/mesure\/(api\/send|script\.js|opposition)$/]

/** Proxy : chemin de réécriture interne, ou null si le chemin passe tel quel. */
export function aiguiller(pathname: string): string | null {
  if (HORS_LANGUE.some((motif) => motif.test(pathname))) return null
  const premier = pathname.split('/')[1] ?? ''
  if (estCodeLangue(premier)) return null
  return pathname === '/' ? `/${RACINE}` : `/${RACINE}${pathname}`
}

/** Sépare un éventuel préfixe de langue du reste du chemin (requête comprise). */
export function cheminSansPrefixe(chemin: string): { langue: CodeLangue | null; reste: string } {
  const [chemin_, requete] = splitRequete(chemin)
  const segments = chemin_.split('/')
  const premier = segments[1] ?? ''
  if (!estCodeLangue(premier)) return { langue: null, reste: surLeSite(chemin) }
  const reste = `/${segments.slice(2).join('/')}`.replace(/\/+$/, '') || '/'
  return { langue: premier, reste: surLeSite(reste) + requete }
}

/**
 * `reste` sert de cible à une redirection : `//hôte` ou `/\hôte` (le
 * navigateur lit `\` comme `/`, et ignore tabulations et sauts de ligne)
 * mènerait vers un autre domaine. Le début est réduit à un seul `/`.
 */
function surLeSite(chemin: string): string {
  return chemin.replace(/^[/\\\t\n\r]+/, '/')
}

function splitRequete(chemin: string): [string, string] {
  const i = chemin.search(/[?#]/)
  return i === -1 ? [chemin, ''] : [chemin.slice(0, i), chemin.slice(i)]
}

/**
 * Utilitaire unique des liens internes : n'ajoute le préfixe que si la langue
 * diffère de la langue principale du domaine. Tout ce qui n'est pas un chemin
 * interne (`https:`, `mailto:`, `tel:`, `//hôte`, `#ancre`) reste intact.
 */
export function cheminLangue(chemin: string, langue: CodeLangue, langueRacine: CodeLangue): string {
  if (!chemin.startsWith('/') || chemin.startsWith('//')) return chemin
  if (langue === langueRacine) return chemin
  const [c, requete] = splitRequete(chemin)
  return (c === '/' ? `/${langue}` : `/${langue}${c}`) + requete
}

export type Decision =
  | { type: 'afficher'; langue: CodeLangue }
  | { type: 'introuvable' }
  | { type: 'rediriger'; vers: string }

/** Layout de `[lang]` : que faire de la valeur reçue (spec § 3, « aiguillage en deux temps »). */
export function choisirLangue({
  param,
  langueRacine,
  languesSite,
  cheminDemande,
}: {
  param: string
  langueRacine: CodeLangue
  languesSite: readonly CodeLangue[]
  cheminDemande: string
}): Decision {
  if (param === RACINE) return { type: 'afficher', langue: langueRacine }
  if (!estCodeLangue(param) || !languesSite.includes(param)) return { type: 'introuvable' }
  if (param === langueRacine) return { type: 'rediriger', vers: cheminSansPrefixe(cheminDemande).reste }
  return { type: 'afficher', langue: param }
}

export interface DomaineLangue {
  hostname: string
  langue: string
  canonique: boolean
}

/** Base canonique d'une langue : son domaine canonique, sinon la base française + `/L`. */
export function baseCanonique(
  langue: CodeLangue,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const propre = domaines.find((d) => d.canonique && d.langue === langue)
  if (propre) return `https://${propre.hostname}`
  const francais = domaines.find((d) => d.canonique && d.langue === FRANCAIS)
  const baseFr = francais ? `https://${francais.hostname}` : basePlateforme
  if (langue === FRANCAIS) return baseFr
  return baseFr ? `${baseFr}/${langue}` : ''
}

export function adresseCanonique(
  langue: CodeLangue,
  chemin: string,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const base = baseCanonique(langue, domaines, basePlateforme)
  if (!base) return ''
  return chemin === '/' ? base : `${base}${chemin}`
}

/** `alternates` de Next : canonique dans la langue du contenu, hreflang des langues disponibles. */
export function adressesAlternatives({
  chemin,
  langueContenu,
  languesDisponibles,
  domaines,
  basePlateforme,
}: {
  chemin: string
  langueContenu: CodeLangue
  languesDisponibles: readonly CodeLangue[]
  domaines: readonly DomaineLangue[]
  basePlateforme: string
}): { canonical?: string; languages: Record<string, string> } {
  const adresse = (l: CodeLangue) => adresseCanonique(l, chemin, domaines, basePlateforme)
  const languages: Record<string, string> = {}
  for (const l of languesDisponibles) if (adresse(l)) languages[l] = adresse(l)
  if (adresse(FRANCAIS)) languages['x-default'] = adresse(FRANCAIS)
  return { canonical: adresse(langueContenu) || undefined, languages }
}

export interface RessourceSitemap {
  chemin: string
  langues: readonly CodeLangue[]
  priorite: string
}

/** Échappe le texte inséré dans un document XML (attribut ou contenu). `&` d'abord. */
function echapperXml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Sitemap d'un domaine : les adresses dont le canonique est sur ce domaine
 * (même origine que la base canonique de sa langue principale), chacune avec
 * ses versions dans les autres langues disponibles.
 */
export function sitemapXml(
  ressources: readonly RessourceSitemap[],
  langueRacine: CodeLangue,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const baseIci = baseCanonique(langueRacine, domaines, basePlateforme)
  const origineIci = baseIci ? new URL(baseIci).origin : null
  const lignes: string[] = []
  for (const r of ressources) {
    for (const l of r.langues) {
      const loc = adresseCanonique(l, r.chemin, domaines, basePlateforme)
      if (!loc || !origineIci || new URL(loc).origin !== origineIci) continue
      const liens = [...r.langues, 'x-default' as const]
        .map((autre) => {
          const href = adresseCanonique(autre === 'x-default' ? FRANCAIS : autre, r.chemin, domaines, basePlateforme)
          return `<xhtml:link rel="alternate" hreflang="${autre}" href="${echapperXml(href)}"/>`
        })
        .join('')
      lignes.push(`  <url><loc>${echapperXml(loc)}</loc>${liens}<priority>${r.priorite}</priority></url>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${lignes.join('\n')}
</urlset>`
}
