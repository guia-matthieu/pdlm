import { resolveCommune } from '@/lib/commune'
import { actualitesCommune, baseUrlsPubliques } from '@/lib/contenu'
import { getPayloadClient } from '@/lib/payload'

export const dynamic = 'force-dynamic'

/** Sitemap par host (uniquement les contenus publiés de la commune résolue). */
export async function GET() {
  const commune = await resolveCommune()
  if (!commune) {
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
      {
        headers: { 'Content-Type': 'application/xml' },
      },
    )
  }

  const payload = await getPayloadClient()
  const base = await baseUrlsPubliques(commune.id, commune.slug)

  const pages = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: commune.id } }, { _status: { equals: 'published' } }] },
    limit: 500,
    overrideAccess: true,
    depth: 0,
  })
  const actus = await actualitesCommune(commune.id, { limite: 500 })

  const urls = [
    { loc: `${base}/`, prio: '1.0' },
    ...pages.docs
      .filter((p) => p.slug !== 'accueil')
      .map((p) => ({ loc: `${base}/${p.slug}`, prio: '0.7' })),
    { loc: `${base}/actualites`, prio: '0.8' },
    ...actus.docs.map((a) => ({ loc: `${base}/actualites/${a.slug}`, prio: '0.6' })),
    { loc: `${base}/agenda`, prio: '0.6' },
    { loc: `${base}/documents`, prio: '0.5' },
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
