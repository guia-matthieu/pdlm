import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { BandeauAlerte } from '@/components/BandeauAlerte'
import { Navigation } from '@/components/Navigation'
import { PiedDePage } from '@/components/PiedDePage'
import { SelecteurLangue } from '@/components/SelecteurLangue'
import { cheminLangue } from '@/lib/adresses'
import {
  alertesActives,
  communeEnLangue,
  menuCommune,
  menuEnLangue,
  pagesDuMenu,
  versionsEnLangue,
} from '@/lib/contenu'
import { contexteLangue } from '@/lib/langue-courante'
import { siteMesure } from '@/lib/mesure/etat'
import { COOKIE_OPPOSITION, estOppose } from '@/lib/mesure/opposition'

import '../styles.css'

interface Props {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

/**
 * Titre par défaut hérité par toute page qui n'en définit pas la sienne
 * (recette Lighthouse J9 : la page d'accueil n'a pas de <title> propre — ce
 * `template` la couvre sans y toucher). Les pages qui définissent un titre
 * (« Documents », etc.) héritent du même template, qui suffixe
 * automatiquement le nom de la commune. Titre et description sont dans la
 * langue affichée.
 */
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) return { title: 'pdlm' }
  const { nom } = await communeEnLangue(ctx.site.commune, ctx.langue)
  return {
    title: { default: nom.texte, template: `%s — ${nom.texte}` },
    description: ctx.t.descriptionSite(nom.texte),
  }
}

/** Layout public : commune, langue du domaine et langue affichée résolues une fois par requête (D5, React.cache). */
export default async function LayoutLangue({ children, params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { commune, langueRacine } = ctx.site
  const lien = (chemin: string) => cheminLangue(chemin, ctx.langue, langueRacine)

  const menuFr = await menuCommune(commune.id)
  const idsPages = (menuFr?.items ?? [])
    .flatMap((item) => [item.page, ...(item.enfants ?? []).map((e) => e.page)])
    .filter((v): v is number => typeof v === 'number')
  const pages = await pagesDuMenu(commune.id, idsPages)
  const [alertesFr, elements, identite] = await Promise.all([
    alertesActives(commune.id),
    menuEnLangue(commune.id, ctx.langue, pages),
    communeEnLangue(commune, ctx.langue),
  ])
  const alertes = await versionsEnLangue('alertes', commune.id, alertesFr, ctx.langue)

  // Couleur non saisie : variable non posée, le défaut de styles.css (:root) s'applique
  const couleurPrincipale = commune.apparence?.couleurPrincipale || undefined
  const couleurAccent = commune.apparence?.couleurAccent || undefined

  // I20 : pas de script pour un visiteur qui s'est opposé.
  const oppose = estOppose((await cookies()).get(COOKIE_OPPOSITION)?.value)
  const siteUmami = oppose ? null : siteMesure(commune)

  return (
    <html lang={ctx.langue}>
      <body
        style={
          {
            '--couleur-principale': couleurPrincipale,
            '--couleur-accent': couleurAccent,
          } as React.CSSProperties
        }
      >
        <a href="#contenu" className="lien-evitement">
          {ctx.t.evitement}
        </a>
        <BandeauAlerte alertes={alertes} langue={ctx.langue} />
        <header className="entete-site">
          <div className="entete-site__marque">
            <a
              href={lien('/')}
              className="entete-site__titre"
              lang={identite.nom.langue !== ctx.langue ? identite.nom.langue : undefined}
            >
              {identite.nom.texte}
            </a>
          </div>
          <SelecteurLangue ctx={ctx} />
          <Navigation elements={elements} ctx={ctx} />
        </header>
        <main id="contenu">{children}</main>
        <PiedDePage commune={commune} identite={identite} ctx={ctx} />
        {siteUmami && (
          <script
            defer
            src="/mesure/script.js"
            data-website-id={siteUmami}
            data-host-url="/mesure"
            data-exclude-search="true"
            data-exclude-hash="true"
            data-do-not-track="true"
            data-fetch-credentials="same-origin"
          />
        )}
      </body>
    </html>
  )
}
