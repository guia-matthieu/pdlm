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
  // Retouche AB — démo (NOINDEX=1, docker-compose.demo.yml) : interdire toute
  // exploration depuis l'application même, sans dépendre du frontal. Pas de
  // Sitemap, pas d'appel à la base : la démo n'a rien à faire dans un moteur
  // de recherche.
  if (process.env.NOINDEX === '1') {
    return new Response('User-agent: *\nDisallow: /\n', {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
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
