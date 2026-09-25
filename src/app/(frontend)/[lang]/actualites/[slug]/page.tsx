import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { MediaImage } from '@/components/MediaImage'
import { RichText } from '@/components/RichText'
import { adressesAlternatives, cheminLangue } from '@/lib/adresses'
import {
  actualiteParSlug,
  auteurResume,
  basePlateforme,
  domainesCommune,
  languesDisponibles,
  mediaDe,
  versionEnLangue,
} from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import { contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) return {}
  const fr = await actualiteParSlug(ctx.site.commune.id, slug)
  if (!fr) return {}
  const { doc, langue } = await versionEnLangue('actualites', fr, ctx.langue)
  const dispo = await languesDisponibles(
    'actualites',
    ctx.site.commune.id,
    [fr.id],
    ctx.languesSite,
  )
  return {
    title: doc.titre,
    description: doc.resume,
    alternates: adressesAlternatives({
      chemin: `/actualites/${fr.slug}`,
      langueContenu: langue,
      languesDisponibles: dispo.get(fr.id) ?? ['fr'],
      domaines: await domainesCommune(ctx.site.commune.id),
      basePlateforme: basePlateforme(ctx.site.commune.slug),
    }),
  }
}

/** Une actualité publiée (relations résolues explicitement — I4), dans la langue affichée si traduite. */
export default async function ActualiteDetail({ params }: Props) {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) notFound()
  const fr = await actualiteParSlug(ctx.site.commune.id, slug)
  if (!fr) notFound()
  const { doc: actu, langue } = await versionEnLangue('actualites', fr, ctx.langue)

  const image = await mediaDe(ctx.site.commune.id, actu.image, ctx.langue)
  const auteur = auteurResume(fr.auteur)

  return (
    <ContenuEnLangue langueContenu={langue} langue={ctx.langue} t={ctx.t}>
      <article className="bloc bloc-texte actu-detail">
        <h1>{actu.titre}</h1>
        <p className="actu-detail__meta">
          {actu.datePublication && (
            // La date est de l'interface : toujours dans la langue affichée.
            <time dateTime={actu.datePublication} lang={ctx.langue}>
              {formaterDate(actu.datePublication, ctx.langue, { dateStyle: 'long' })}
            </time>
          )}
          {auteur?.nom ? ` — ${auteur.nom}` : ''}
        </p>
        {image ? (
          <MediaImage
            media={image}
            taille="hero"
            className="actu-detail__image"
            langueAffichee={langue}
          />
        ) : null}
        <RichText
          data={actu.contenu}
          lien={(c) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)}
        />
      </article>
    </ContenuEnLangue>
  )
}
