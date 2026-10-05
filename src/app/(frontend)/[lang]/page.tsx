import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Accueil } from '@/gabarits/Accueil'
import { adressesAlternatives, cheminLangue } from '@/lib/adresses'
import {
  basePlateforme,
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
  const { langue } = await versionEnLangue('pages', ctx.site.commune.id, fr, ctx.langue)
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

/**
 * Accueil composé par le gabarit de la commune (spec § 3) : le héros, les
 * sections communes et leurs replis (I30) — la page à blocs « accueil » du
 * rédacteur se rend dans la section texte libre, elle ne compose plus seule
 * la page.
 */
export default async function PageAccueil({ params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  return (
    <Accueil
      commune={ctx.site.commune}
      langue={ctx.langue}
      t={ctx.t}
      lien={(chemin) => cheminLangue(chemin, ctx.langue, ctx.site.langueRacine)}
    />
  )
}
