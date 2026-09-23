import { communeDuHost, normaliserHost } from '@/lib/commune'
import { mesureInstallee } from '@/lib/mesure/etat'
import { relayer } from '@/lib/mesure/relais'

export const dynamic = 'force-dynamic'

/**
 * Relais de collecte de la mesure d'audience. Le chemin ne commence pas par
 * /api : le proxy (I7) le traite comme le front public et pose x-commune-host.
 */
export async function POST(request: Request) {
  const host = normaliserHost(request.headers.get('x-commune-host') ?? '')
  const commune = mesureInstallee() ? await communeDuHost(host) : null
  return relayer(request, commune, host)
}
