import { communeDuHost } from '@/lib/commune'
import { mesureInstallee } from '@/lib/mesure/etat'
import { scriptUmami } from '@/lib/mesure/script'

export const dynamic = 'force-dynamic'

/**
 * Script de mesure servi depuis le domaine de la commune : la CSP
 * (`script-src 'self'`) ne change pas.
 */
export async function GET(request: Request) {
  if (!mesureInstallee()) return new Response(null, { status: 404 })
  const commune = await communeDuHost(request.headers.get('x-commune-host') ?? '')
  if (!commune) return new Response(null, { status: 404 })
  const texte = await scriptUmami()
  if (texte === null) return new Response(null, { status: 503 })
  return new Response(texte, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
