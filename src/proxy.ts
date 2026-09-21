import { NextResponse, type NextRequest } from 'next/server'

/**
 * Invariant I7 — proxy Next 16 (ex-middleware, runtime Node) :
 * 1. `/admin` est traité AVANT toute exclusion : si le host n'est pas le
 *    domaine de la plateforme, redirection vers ADMIN_URL (404 si absente) ;
 * 2. sur les domaines communaux, `/api` n'autorise que les routes fichiers
 *    et `/api/health` (exception interne explicite) — le reste vit sur la
 *    plateforme ;
 * 3. `x-commune-host` est TOUJOURS écrasé (jamais lu depuis le client).
 */
const ROUTES_API_PUBLIQUES = [/^\/api\/(media|documents)\/file\//, /^\/api\/health\/?$/]

export function estDomainePlateforme(host: string): boolean {
  const plateforme = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase()
  const nu = host.split(':')[0]
  if (!plateforme) {
    // Sans PLATFORM_DOMAIN, répondre « oui » revient à considérer TOUT host
    // comme la plateforme : l'API s'ouvre alors sur tous les domaines
    // communaux, et une variable d'environnement oubliée suffit à désarmer I7.
    // En production on refuse ce mode dégradé ; en développement le confort
    // (host nu, *.localhost) est conservé.
    return process.env.NODE_ENV !== 'production'
  }
  return nu === plateforme || nu === `www.${plateforme}` || nu === `admin.${plateforme}`
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostBrut = request.headers.get('host') ?? ''
  const host = hostBrut.split(':')[0].toLowerCase()
  const surPlateforme = estDomainePlateforme(host)

  // 1. Admin d'abord (I7) — le matcher n'exclut jamais /admin
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (!surPlateforme) {
      const adminUrl = (process.env.ADMIN_URL ?? '').replace(/\/$/, '')
      if (adminUrl) {
        return NextResponse.redirect(new URL(adminUrl + pathname))
      }
      // ADMIN_URL oubliée : refuser plutôt que servir l'admin sur un domaine
      // communal (même logique que PLATFORM_DOMAIN dans estDomainePlateforme).
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.next()
  }

  // 2. API : sur domaines communaux, seules les routes publiques passent
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (!surPlateforme && !ROUTES_API_PUBLIQUES.some((motif) => motif.test(pathname))) {
      return new NextResponse(null, { status: 404 })
    }
    return NextResponse.next()
  }

  // 3. Statiques et interne de Next : sans traitement
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // 4. Front public : écraser x-commune-host (unique source de vérité)
  const entetes = new Headers(request.headers)
  entetes.set('x-commune-host', host)
  return NextResponse.next({ request: { headers: entetes } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
