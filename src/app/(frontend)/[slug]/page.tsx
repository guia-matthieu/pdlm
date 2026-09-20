import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RenduBlocs } from '@/components/RenduBlocs'
import { resolveCommune } from '@/lib/commune'
import { baseUrlsPubliques, pageParSlug } from '@/lib/contenu'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const commune = await resolveCommune()
  if (!commune) return {}
  const page = await pageParSlug(commune.id, slug)
  if (!page) return {}
  const base = await baseUrlsPubliques(commune.id, commune.slug)
  return {
    title: page.metaTitle || page.titre,
    description: page.metaDescription || undefined,
    alternates: {
      canonical: page.slug === 'accueil' ? base || undefined : `${base}/${page.slug}` || undefined,
    },
  }
}

/** Page CMS générique rendue par blocs (uniquement la version publiée). */
export default async function PageGenerique({ params }: Props) {
  const { slug } = await params
  const commune = await resolveCommune()
  if (!commune) notFound()
  const page = await pageParSlug(commune.id, slug)
  if (!page) notFound()
  return <RenduBlocs blocs={page.blocs ?? []} />
}
