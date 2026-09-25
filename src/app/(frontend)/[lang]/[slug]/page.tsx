import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { RenduBlocs } from '@/components/RenduBlocs'
import { adressesAlternatives, cheminLangue } from '@/lib/adresses'
import {
  basePlateforme,
  domainesCommune,
  languesDisponibles,
  pageParSlug,
  versionEnLangue,
} from '@/lib/contenu'
import { contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) return {}
  const fr = await pageParSlug(ctx.site.commune.id, slug)
  if (!fr) return {}
  const { doc, langue } = await versionEnLangue('pages', ctx.site.commune.id, fr, ctx.langue)
  const dispo = await languesDisponibles('pages', ctx.site.commune.id, [fr.id], ctx.languesSite)
  return {
    title: doc.metaTitle || doc.titre,
    description: doc.metaDescription || undefined,
    alternates: adressesAlternatives({
      chemin: fr.slug === 'accueil' ? '/' : `/${fr.slug}`,
      langueContenu: langue,
      languesDisponibles: dispo.get(fr.id) ?? ['fr'],
      domaines: await domainesCommune(ctx.site.commune.id),
      basePlateforme: basePlateforme(ctx.site.commune.slug),
    }),
  }
}

/** Page CMS générique (version publiée), dans la langue affichée si sa traduction est validée. */
export default async function PageGenerique({ params }: Props) {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) notFound()
  const fr = await pageParSlug(ctx.site.commune.id, slug)
  if (!fr) notFound()
  const { doc, langue } = await versionEnLangue('pages', ctx.site.commune.id, fr, ctx.langue)
  return (
    <ContenuEnLangue langueContenu={langue} langue={ctx.langue} t={ctx.t}>
      <RenduBlocs
        blocs={doc.blocs ?? []}
        lien={(c) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)}
      />
    </ContenuEnLangue>
  )
}
