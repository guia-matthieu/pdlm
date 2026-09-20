import { baseUrlsPubliques } from '@/lib/contenu'
import { resolveCommune } from '@/lib/commune'

export const dynamic = 'force-dynamic'

/** robots.txt par host (domaine canonique de la commune). */
export async function GET() {
  const commune = await resolveCommune()
  const base = commune ? await baseUrlsPubliques(commune.id, commune.slug) : ''
  const contenu = `User-agent: *
Disallow: /admin
Disallow: /api

Sitemap: ${base}/sitemap.xml
`
  return new Response(contenu, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
