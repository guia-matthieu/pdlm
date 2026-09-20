import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BandeauAlerte } from '@/components/BandeauAlerte'
import { Navigation } from '@/components/Navigation'
import { PiedDePage } from '@/components/PiedDePage'
import { alertesActives, menuCommune, pagesDuMenu } from '@/lib/contenu'
import { resolveCommune } from '@/lib/commune'

import './styles.css'

/** Layout public : résout la commune une fois par requête (D5, React.cache). */
export default async function LayoutFront({ children }: { children: React.ReactNode }) {
  const commune = await resolveCommune()
  if (!commune) notFound()

  const [alertes, menu] = await Promise.all([alertesActives(commune.id), menuCommune(commune.id)])
  const idsPages = (menu?.items ?? [])
    .flatMap((item) => [item.page, ...(item.enfants ?? []).map((e) => e.page)])
    .filter((v): v is number => typeof v === 'number')
  const pages = await pagesDuMenu(commune.id, idsPages)

  const couleurPrincipale = commune.apparence?.couleurPrincipale || '#000091'
  const couleurAccent = commune.apparence?.couleurAccent || '#000091'

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
