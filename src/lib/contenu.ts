import 'server-only'

import type { Actualite, Alerte, Commune, Evenement, Media, Menu, Page } from '../payload-types'
import type { Where } from 'payload'

import { filtreAlerteActive, filtreEvenementAVenir, filtrePublication } from './dates'
import { getPayloadClient } from './payload'

/**
 * Invariant I4 — lectures publiques centralisées. Chaque fonction impose :
 * tenant, visibilité (publication + fenêtres de dates), depth 0 et
 * projection. Les relations sont résolues explicitement par les fonctions
 * dédiées (jamais laissées à la population automatique) : un document public
 * référençant une cible brouillon/future ne sérialise aucun contenu non
 * public. overrideAccess: true cantonné à ce module (les écritures internes
 * du journal sont des cas contrôlés distincts, I12).
 */

type IdCommune = Commune['id']

function baseCommune(id: IdCommune): Where {
  return { tenant: { equals: id } }
}

/** Page publiée d'une commune par slug. */
export async function pageParSlug(id: IdCommune, slug: string): Promise<Page | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: {
      and: [baseCommune(id), { slug: { equals: slug } }, { _status: { equals: 'published' } }],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

/** Page d'accueil (slug « accueil »), publiée. */
export function pageAccueil(id: IdCommune): Promise<Page | null> {
  return pageParSlug(id, 'accueil')
}

/** Actualités publiées (datePublication passée), les plus récentes d'abord. */
export async function actualitesCommune(
  id: IdCommune,
  { limite = 10, page = 1 }: { limite?: number; page?: number } = {},
) {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'actualites',
    // `filtrePublication()` porte déjà l'état publié ET la fenêtre de parution.
    where: { and: [baseCommune(id), filtrePublication()] },
    sort: '-datePublication',
    depth: 0,
    limit: limite,
    page,
    overrideAccess: true,
  })
  return res
}

/**
 * Une actualité publiée par slug.
 * `filtrePublication()` et non `_status` seul : une parution programmée est
 * publiée mais sous embargo, et un slug se devine. Filtrer la liste sans
 * filtrer l'accès direct livrerait le contenu en avance.
 */
export async function actualiteParSlug(id: IdCommune, slug: string): Promise<Actualite | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'actualites',
    where: {
      and: [baseCommune(id), { slug: { equals: slug } }, filtrePublication()],
    },
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

/** Événements à venir ou en cours (dateFin >= now), triés par début. */
export async function evenementsCommune(id: IdCommune, { limite = 50 } = {}) {
  const payload = await getPayloadClient()
  return payload.find({
    collection: 'evenements',
    where: { and: [baseCommune(id), filtreEvenementAVenir()] },
    sort: 'dateDebut',
    depth: 0,
    limit: limite,
    overrideAccess: true,
  })
}

/** Documents administratifs (politique publique explicite, I5), filtrables par catégorie. */
export async function documentsCommune(
  id: IdCommune,
  { categorie, limite = 50 }: { categorie?: string; limite?: number } = {},
) {
  const payload = await getPayloadClient()
  const conditions: Where[] = [baseCommune(id)]
  if (categorie) conditions.push({ categorie: { equals: categorie } })
  return payload.find({
    collection: 'documents',
    where: { and: conditions },
    sort: '-dateDocument',
    depth: 0,
    limit: limite,
    overrideAccess: true,
  })
}

/** Alertes actives (fenêtre de validité), pour le bandeau public. */
export async function alertesActives(id: IdCommune): Promise<Alerte[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'alertes',
    where: { and: [baseCommune(id), filtreAlerteActive()] },
    depth: 0,
    limit: 5,
    overrideAccess: true,
  })
  return res.docs
}

/** Menu de navigation de la commune (une entrée par commune, I9). */
export async function menuCommune(id: IdCommune): Promise<Menu | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'menus',
    where: baseCommune(id),
    depth: 0,
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0] ?? null
}

/**
 * Résolution explicite d'une relation média (depth 0 + projection minimale).
 * Retourne null si le média n'appartient pas à la commune — jamais de fuite.
 */
export async function mediaDe(id: IdCommune, ref: unknown): Promise<Media | null> {
  if (ref === undefined || ref === null || ref === '') return null
  const payload = await getPayloadClient()
  const media = await payload
    .findByID({
      collection: 'media',
      id: ref as string | number,
      depth: 0,
      overrideAccess: true,
    })
    .catch(() => null)
  if (!media) return null
  const tenant =
    typeof (media as unknown as { tenant?: unknown }).tenant === 'object' &&
    (media as unknown as { tenant?: { id?: number } }).tenant !== null
      ? ((media as unknown as { tenant: { id?: number } }).tenant.id ?? null)
      : ((media as unknown as { tenant?: number }).tenant ?? null)
  return tenant === id ? media : null
}

/**
 * Résolution explicite de l'auteur d'une actualité : { nom } uniquement (I2) —
 * jamais le document utilisateur complet, jamais l'email.
 */
export function auteurResume(auteur: Actualite['auteur']): { nom: string } | null {
  if (!auteur || typeof auteur !== 'object') return null
  return { nom: (auteur as { name?: string | null }).name || '' }
}

/**
 * Résolution explicite des pages cibles d'un menu : seules les pages de la
 * commune et publiées sont retenues.
 */
export async function pagesDuMenu(id: IdCommune, ids: Array<string | number>) {
  if (ids.length === 0) return new Map<number, Page>()
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'pages',
    where: {
      and: [baseCommune(id), { id: { in: ids } }, { _status: { equals: 'published' } }],
    },
    depth: 0,
    limit: ids.length,
    overrideAccess: true,
  })
  return new Map(res.docs.map((p) => [p.id, p]))
}

/** Projection publique minimale d'une commune (I8). */
export function communePublique(c: Commune) {
  return {
    nom: c.nom,
    slug: c.slug,
    logo: c.logo ?? null,
    coordonnees: c.coordonnees ?? null,
    horaires: c.horaires ?? null,
    reseaux: c.reseaux ?? null,
    apparence: c.apparence ?? null,
  }
}

/** Hostname canonique de la commune (I6/I10 — canonicals et sitemap). */
export async function domaineCanonique(id: IdCommune): Promise<string | null> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'domaines',
    where: { and: [{ commune: { equals: id } }, { canonique: { equals: true } }] },
    limit: 1,
    overrideAccess: true,
  })
  return res.docs[0]?.hostname ?? null
}

/** Base d'URLs publiques : domaine canonique, sinon sous-domaine plateforme. */
export async function baseUrlsPubliques(id: IdCommune, slug: string): Promise<string> {
  const canonique = await domaineCanonique(id)
  if (canonique) return `https://${canonique}`
  const plateforme = process.env.PLATFORM_DOMAIN
  return plateforme ? `https://${slug}.${plateforme}` : ''
}
