import type { CollectionBeforeValidateHook } from 'payload'

import { ValidationError } from 'payload'

import { slugifier } from './formatSlug'

/** Slugs réservés aux routes statiques du front public (R7). */
export const SLUGS_RESERVES = [
  'actualites',
  'agenda',
  'documents',
  'admin',
  'api',
  'mesure',
  'mesure-d-audience',
]

/**
 * Unicité de slug dans le périmètre de la commune (UX — la garantie forte est
 * l'index unique composite (tenant, slug) en base, I9) + rejet des slugs réservés.
 */
export const uniqueSlugParCommune =
  (source: string): CollectionBeforeValidateHook =>
  async ({ data, originalDoc, collection, req }) => {
    if (!data) return data

    const slug =
      typeof data.slug === 'string' && data.slug !== ''
        ? slugifier(data.slug)
        : typeof data[source] === 'string'
          ? slugifier(data[source] as string)
          : null

    if (!slug) return data

    if (SLUGS_RESERVES.includes(slug)) {
      throw new ValidationError({
        errors: [{ message: `Le slug « ${slug} » est réservé.`, path: 'slug' }],
      })
    }

    data.slug = slug

    const tenant =
      (data.tenant as string | number | undefined) ??
      (originalDoc?.tenant as string | number | undefined)
    if (!tenant) return data

    const existants = await req.payload.find({
      collection: collection.slug,
      where: {
        and: [{ tenant: { equals: tenant } }, { slug: { equals: slug } }],
      },
      limit: 2,
      overrideAccess: true,
    })

    const doublon = existants.docs.some((doc) => String(doc.id) !== String(originalDoc?.id ?? ''))
    if (doublon) {
      throw new ValidationError({
        errors: [
          { message: `Le slug « ${slug} » est déjà utilisé dans cette commune.`, path: 'slug' },
        ],
      })
    }

    return data
  }
