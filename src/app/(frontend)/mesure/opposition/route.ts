import { communeDuHost, normaliserHost } from '@/lib/commune'
import { cheminRetour, enteteCookieOpposition, soumissionIntersite } from '@/lib/mesure/opposition'

export const dynamic = 'force-dynamic'

/** I20 — opposition sans JavaScript : formulaire classique, réponse 303. */
export async function POST(request: Request) {
  const host = normaliserHost(request.headers.get('x-commune-host') ?? '')
  const commune = await communeDuHost(host)
  if (!commune) return new Response(null, { status: 404 })
  // Un site tiers ne doit pas pouvoir lever l'opposition d'un visiteur.
  if (soumissionIntersite(request.headers, (request.headers.get('host') ?? '').toLowerCase())) {
    return new Response('Origine refusée', { status: 403 })
  }
  const formulaire = await request.formData().catch(() => null)
  const choix = formulaire?.get('choix')
  if (choix !== 'refus' && choix !== 'accepte') {
    return new Response('Choix invalide', { status: 400 })
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: cheminRetour(formulaire?.get('retour')),
      'Set-Cookie': enteteCookieOpposition(choix, process.env.NODE_ENV === 'production'),
    },
  })
}
