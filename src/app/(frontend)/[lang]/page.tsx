import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { RenduBlocs } from '@/components/RenduBlocs'
import { adressesAlternatives, cheminLangue } from '@/lib/adresses'
import {
  basePlateforme,
  communeEnLangue,
  domainesCommune,
  languesDisponibles,
  pageAccueil,
  versionEnLangue,
} from '@/lib/contenu'
import { alternatesRubrique, contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string }>
}

/** Pas de titre propre (template du layout) ; `alternates` de la page « accueil » si elle existe. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) return {}
  const fr = await pageAccueil(ctx.site.commune.id)
  if (!fr) return { alternates: await alternatesRubrique(ctx, '/') }
  const { langue } = await versionEnLangue('pages', fr, ctx.langue)
  const dispo = await languesDisponibles('pages', ctx.site.commune.id, [fr.id], ctx.languesSite)
  return {
    alternates: adressesAlternatives({
      chemin: '/',
      langueContenu: langue,
      languesDisponibles: dispo.get(fr.id) ?? ['fr'],
      domaines: await domainesCommune(ctx.site.commune.id),
      basePlateforme: basePlateforme(ctx.site.commune.slug),
    }),
  }
}

/** Accueil : la page publiée de slug « accueil » de la commune, dans la langue affichée si traduite. */
export default async function PageAccueil({ params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const lien = (c: string) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)
  const fr = await pageAccueil(ctx.site.commune.id)
  if (!fr) {
    const { nom } = await communeEnLangue(ctx.site.commune, ctx.langue)
    return (
      <section className="bloc bloc-texte">
        <h1>{ctx.t.bienvenue(nom.texte)}</h1>
        <p>{ctx.t.enConstruction}</p>
        <p>{ctx.t.consulter}</p>
        <ul>
          <li>
            <a href={lien('/actualites')}>{ctx.t.actualites}</a>
          </li>
          <li>
            <a href={lien('/agenda')}>{ctx.t.agenda}</a>
          </li>
        </ul>
      </section>
    )
  }
  const { doc, langue } = await versionEnLangue('pages', fr, ctx.langue)
  return (
    <ContenuEnLangue langueContenu={langue} langue={ctx.langue} t={ctx.t}>
      <RenduBlocs
        blocs={doc.blocs ?? []}
        lien={(c) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)}
      />
    </ContenuEnLangue>
  )
}
