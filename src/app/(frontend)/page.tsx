import Link from 'next/link'

import { RenduBlocs } from '@/components/RenduBlocs'
import { resolveCommune } from '@/lib/commune'
import { pageAccueil } from '@/lib/contenu'

/** Accueil : la page publiée de slug « accueil » de la commune. */
export default async function PageAccueil() {
  const commune = await resolveCommune()
  if (!commune) return null
  const page = await pageAccueil(commune.id)
  if (!page) {
    return (
      <section className="bloc bloc-texte">
        <h1>Bienvenue à {commune.nom}</h1>
        <p>
          Le site est en cours de construction. Revenez bientôt ! Vous pouvez consulter les{' '}
          <Link href="/actualites">actualités</Link> et l’<Link href="/agenda">agenda</Link>.
        </p>
      </section>
    )
  }
  return <RenduBlocs blocs={page.blocs ?? []} />
}
