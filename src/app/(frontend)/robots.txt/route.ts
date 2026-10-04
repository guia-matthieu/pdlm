import { baseCanonique } from '@/lib/adresses'
import { resolveSite } from '@/lib/commune'
import { basePlateforme, domainesCommune } from '@/lib/contenu'

export const dynamic = 'force-dynamic'

/**
 * robots.txt par host : Sitemap sur l'origine de la langue racine du domaine
 * (spec multilingue § 3). Origine seule — un `/L` en queue (repli sans domaine
 * propre, ex. `https://pigna.fr/co`) n'a pas de sitemap qui lui est propre :
 * `sitemap.xml` se résout par host, jamais par chemin.
 */
export async function GET() {
  const site = await resolveSite()
  const base = site
    ? baseCanonique(site.langueRacine, await domainesCommune(site.commune.id), basePlateforme(site.commune.slug))
    : ''
  const origine = base ? new URL(base).origin : null
  const contenu = `User-agent: *
Disallow: /admin
Disallow: /api
${origine ? `\nSitemap: ${origine}/sitemap.xml\n` : ''}`
  return new Response(contenu, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
