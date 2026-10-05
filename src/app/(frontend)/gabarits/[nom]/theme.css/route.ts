import { lireTheme } from '@/gabarits/fichiers'
import { GABARITS } from '@/gabarits/registre'

/*
 * Décision 19 : la feuille d'un gabarit est un fichier statique de l'origine.
 * La route est prérendue au build pour chaque gabarit du registre (aucune
 * lecture du disque en production) ; tout autre nom → 404.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return Object.keys(GABARITS).map((nom) => ({ nom }))
}

export async function GET(_requete: Request, { params }: { params: Promise<{ nom: string }> }) {
  const css = await lireTheme((await params).nom)
  if (css === null) return new Response(null, { status: 404 })
  return new Response(css, {
    headers: {
      'Content-Type': 'text/css; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
