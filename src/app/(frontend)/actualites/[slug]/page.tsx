import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MediaImage } from '@/components/MediaImage'
import { RichText } from '@/components/RichText'
import { resolveCommune } from '@/lib/commune'
import { actualiteParSlug, auteurResume, baseUrlsPubliques, mediaDe } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const commune = await resolveCommune()
  if (!commune) return {}
  const actu = await actualiteParSlug(commune.id, slug)
  if (!actu) return {}
  const base = await baseUrlsPubliques(commune.id, commune.slug)
  return {
    title: actu.titre,
    description: actu.resume,
    alternates: { canonical: `${base}/actualites/${actu.slug}` || undefined },
  }
}

/** Une actualité publiée (relations résolues explicitement — I4). */
export default async function ActualiteDetail({ params }: Props) {
  const { slug } = await params
  const commune = await resolveCommune()
  if (!commune) notFound()
  const actu = await actualiteParSlug(commune.id, slug)
  if (!actu) notFound()

  const image = await mediaDe(commune.id, actu.image)
  const auteur = auteurResume(actu.auteur)

  return (
    <article className="bloc bloc-texte actu-detail">
      <h1>{actu.titre}</h1>
      <p className="actu-detail__meta">
        {actu.datePublication && (
          <time dateTime={actu.datePublication}>
            {formaterDate(actu.datePublication, 'fr', { dateStyle: 'long' })}
          </time>
        )}
        {auteur?.nom ? ` — ${auteur.nom}` : ''}
      </p>
      {image ? <MediaImage media={image} taille="hero" className="actu-detail__image" /> : null}
      <RichText data={actu.contenu} />
    </article>
  )
}
