import { lirePolice, policesServies } from '@/gabarits/fichiers'

/*
 * Décision 19 : les polices d'un gabarit, auto-hébergées (I27), servies depuis
 * l'origine. Prérendues au build pour les seuls fichiers que les gabarits
 * déclarent (`gabarit.polices`) ; tout autre chemin → 404.
 */
export const dynamic = 'force-static'
export const dynamicParams = false

export function generateStaticParams() {
  return policesServies()
}

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ nom: string; fichier: string }> },
) {
  const { nom, fichier } = await params
  const police = await lirePolice(nom, fichier)
  if (!police) return new Response(null, { status: 404 })
  return new Response(new Uint8Array(police.octets), {
    headers: {
      'Content-Type': police.type,
      // Le nom du fichier ne porte pas d'empreinte : un mois, pas « immutable ».
      'Cache-Control': 'public, max-age=2592000',
    },
  })
}
