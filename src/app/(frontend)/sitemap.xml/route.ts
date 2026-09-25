import { resolveSite } from '@/lib/commune'
import { construireSitemap } from '@/lib/contenu'

export const dynamic = 'force-dynamic'

const VIDE =
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

/** Sitemap par host : les adresses dont le canonique est sur ce domaine (spec multilingue § 3). */
export async function GET() {
  const site = await resolveSite()
  const xml = site ? await construireSitemap(site) : VIDE
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
