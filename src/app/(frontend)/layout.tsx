import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BandeauAlerte } from '@/components/BandeauAlerte'
import { Navigation } from '@/components/Navigation'
import { PiedDePage } from '@/components/PiedDePage'
import { alertesActives, menuCommune, pagesDuMenu } from '@/lib/contenu'
import { resolveCommune } from '@/lib/commune'

import './styles.css'

/**
 * Titre par défaut hérité par toute page qui n'en définit pas la sienne
 * (recette Lighthouse J9 : la page d'accueil n'a pas de <title> propre — ce
 * `template` la couvre sans y toucher). Les pages qui appellent déjà
 * `export const metadata = { title: 'Documents' }` etc. héritent du même
 * template, qui suffixe automatiquement le nom de la commune.
 */
export async function generateMetadata(): Promise<Metadata> {
  const commune = await resolveCommune()
  const nom = commune?.nom ?? 'pdlm'
  return {
    title: { default: nom, template: `%s — ${nom}` },
    description: `Site officiel de la commune de ${nom} : actualités, agenda et démarches.`,
  }
}

/** Layout public : résout la commune une fois par requête (D5, React.cache). */
export default async function LayoutFront({ children }: { children: React.ReactNode }) {
  const commune = await resolveCommune()
  if (!commune) notFound()

  const [alertes, menu] = await Promise.all([alertesActives(commune.id), menuCommune(commune.id)])
  const idsPages = (menu?.items ?? [])
    .flatMap((item) => [item.page, ...(item.enfants ?? []).map((e) => e.page)])
    .filter((v): v is number => typeof v === 'number')
  const pages = await pagesDuMenu(commune.id, idsPages)

  // Couleur non saisie : variable non posée, le défaut de styles.css (:root) s'applique
  const couleurPrincipale = commune.apparence?.couleurPrincipale || undefined
  const couleurAccent = commune.apparence?.couleurAccent || undefined

  return (
    <html lang="fr">
      <body
        style={
          {
            '--couleur-principale': couleurPrincipale,
            '--couleur-accent': couleurAccent,
          } as React.CSSProperties
        }
      >
        <a href="#contenu" className="lien-evitement">
          Aller au contenu
        </a>
        <BandeauAlerte alertes={alertes} />
        <header className="entete-site">
          <div className="entete-site__marque">
            <Link href="/" className="entete-site__titre">
              {commune.nom}
            </Link>
          </div>
          <Navigation menu={menu} pages={pages} />
        </header>
        <main id="contenu">{children}</main>
        <PiedDePage commune={commune} />
      </body>
    </html>
  )
}
