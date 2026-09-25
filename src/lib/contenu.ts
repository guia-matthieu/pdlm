import 'server-only'

import type { Actualite, Alerte, Commune, Evenement, Media, Menu, Page } from '../payload-types'
import type { DataFromCollectionSlug, Where } from 'payload'

import { baseCanonique, sitemapXml, type DomaineLangue, type RessourceSitemap } from './adresses'
import type { Site } from './commune'
import { filtreAlerteActive, filtreEvenementAVenir, filtrePublication } from './dates'
import { FRANCAIS, type CodeLangue } from './langues'
import { languesDuSite } from './langues-site'
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
 * Règle 3 (petits textes) : en langue L, le texte alternatif traduit s'il
 * existe, sinon l'alt français ; `langueAlt` indique lequel est montré.
 */
export async function mediaDe(
  id: IdCommune,
  ref: unknown,
  langue: CodeLangue = FRANCAIS,
): Promise<(Media & { langueAlt: CodeLangue }) | null> {
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
  if (tenant !== id) return null
  if (langue === FRANCAIS) return { ...media, langueAlt: FRANCAIS }
  const enL = await payload
    .findByID({ collection: 'media', id: media.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
    .catch(() => null)
  const altL = enL?.alt
  return { ...media, alt: altL || media.alt, langueAlt: altL ? langue : FRANCAIS }
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

/** Domaines de la commune avec leur langue (canoniques, hreflang, sitemap). */
export async function domainesCommune(id: IdCommune): Promise<DomaineLangue[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection: 'domaines',
    where: { commune: { equals: id } },
    depth: 0,
    limit: 50,
    overrideAccess: true,
  })
  return res.docs.map((d) => ({ hostname: d.hostname, langue: d.langue ?? FRANCAIS, canonique: d.canonique === true }))
}

/** Sous-domaine de la plateforme (repli quand aucun domaine canonique n'existe). */
export function basePlateforme(slug: string): string {
  const plateforme = process.env.PLATFORM_DOMAIN
  return plateforme ? `https://${slug}.${plateforme}` : ''
}

/** Base d'URLs publiques : domaine canonique français, sinon sous-domaine plateforme. */
export async function baseUrlsPubliques(id: IdCommune, slug: string): Promise<string> {
  return baseCanonique(FRANCAIS, await domainesCommune(id), basePlateforme(slug))
}

export type Traduisible = 'pages' | 'actualites' | 'evenements' | 'documents' | 'alertes'

/** `langue` = langue du contenu réellement affiché (pour `lang` et la mention). */
export interface EnLangue<T> {
  doc: T
  langue: CodeLangue
}

/**
 * Règle 1 (spec § 2) : le document entier en L si sa traduction y est
 * « validée », sinon entièrement en français. L'état se lit SANS repli : lu
 * avec repli, `traduction` en L renverrait la valeur française.
 */
export async function versionEnLangue<C extends Traduisible>(
  collection: C,
  docFr: DataFromCollectionSlug<C>,
  langue: CodeLangue,
): Promise<EnLangue<DataFromCollectionSlug<C>>> {
  if (langue === FRANCAIS) return { doc: docFr, langue: FRANCAIS }
  const payload = await getPayloadClient()
  const enL = await payload
    .findByID({ collection, id: docFr.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
    .catch(() => null)
  return (enL as { traduction?: string | null } | null)?.traduction === 'validee'
    ? { doc: enL as DataFromCollectionSlug<C>, langue }
    : { doc: docFr, langue: FRANCAIS }
}

/** Règle 2 : chaque élément d'une liste dans sa langue, en une seule requête. */
export async function versionsEnLangue<C extends Traduisible>(
  collection: C,
  docsFr: DataFromCollectionSlug<C>[],
  langue: CodeLangue,
): Promise<EnLangue<DataFromCollectionSlug<C>>[]> {
  if (langue === FRANCAIS || docsFr.length === 0) return docsFr.map((doc) => ({ doc, langue: FRANCAIS }))
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection,
    where: { id: { in: docsFr.map((d) => d.id) } },
    locale: langue,
    fallbackLocale: false,
    depth: 0,
    limit: docsFr.length,
    overrideAccess: true,
  })
  const valides = new Map(
    res.docs
      .filter((d) => (d as { traduction?: string | null }).traduction === 'validee')
      .map((d) => [d.id, d as DataFromCollectionSlug<C>]),
  )
  return docsFr.map((doc) =>
    valides.has(doc.id) ? { doc: valides.get(doc.id)!, langue } : { doc, langue: FRANCAIS },
  )
}

/**
 * Langues où chaque document est montrable : le français, plus L validée ET
 * activée (I14, I17). I4 : filtré par commune (`baseCommune`) — un id d'une
 * autre commune reste au français seul, jamais annoncé traduit.
 */
export async function languesDisponibles(
  collection: Traduisible,
  idCommune: IdCommune,
  ids: number[],
  languesSite: readonly CodeLangue[],
): Promise<Map<number, CodeLangue[]>> {
  const resultat = new Map<number, CodeLangue[]>(ids.map((id) => [id, [FRANCAIS]]))
  if (ids.length === 0) return resultat
  const payload = await getPayloadClient()
  for (const langue of languesSite.filter((l) => l !== FRANCAIS)) {
    const res = await payload.find({
      collection,
      where: { and: [baseCommune(idCommune), { id: { in: ids } }, { traduction: { equals: 'validee' } }] },
      locale: langue,
      fallbackLocale: false,
      depth: 0,
      limit: ids.length,
      select: { traduction: true },
      overrideAccess: true,
    } as never)
    for (const d of res.docs as Array<{ id: number }>) resultat.get(d.id)?.push(langue)
  }
  return resultat
}

export interface TexteEnLangue {
  texte: string
  langue: CodeLangue
}

/** Règle 3 : petit texte traduit s'il existe, sinon le français, marqué. */
function texteEnLangue(enL: string | null | undefined, fr: string, langue: CodeLangue): TexteEnLangue {
  return enL ? { texte: enL, langue } : { texte: fr, langue: FRANCAIS }
}

export interface ElementMenu {
  label: TexteEnLangue
  href: string
  enfants: Array<{ label: TexteEnLangue; href: string }>
}

/**
 * Menu dans la langue L. `href` SANS préfixe de langue (l'appelant applique
 * `cheminLangue`) ; items « page » résolus par `pages` (I4, pagesDuMenu).
 * Les lignes de tableau sont communes aux langues : on apparie par leur `id`.
 */
export async function menuEnLangue(
  id: IdCommune,
  langue: CodeLangue,
  pages: Map<number, Page>,
): Promise<ElementMenu[]> {
  const fr = await menuCommune(id)
  if (!fr) return []
  const payload = await getPayloadClient()
  const enL =
    langue === FRANCAIS
      ? fr
      : await payload.findByID({ collection: 'menus', id: fr.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
  const labelsL = new Map<string, string | null | undefined>()
  for (const item of enL.items ?? []) {
    if (item.id) labelsL.set(item.id, item.label)
    for (const e of item.enfants ?? []) if (e.id) labelsL.set(e.id, e.label)
  }
  const href = (page: unknown, url: string | null | undefined) => {
    const p = typeof page === 'number' ? pages.get(page) : null
    return p ? `/${p.slug}` : (url ?? '')
  }
  return (fr.items ?? [])
    .map((item) => ({
      label: texteEnLangue(labelsL.get(item.id ?? ''), item.label ?? '', langue),
      href: href(item.page, item.url),
      enfants: (item.enfants ?? [])
        .map((e) => ({ label: texteEnLangue(labelsL.get(e.id ?? ''), e.label ?? '', langue), href: href(e.page, e.url) }))
        .filter((e) => e.href),
    }))
    .filter((e) => e.href)
}

/** Nom et horaires de la commune dans la langue L (règle 3). */
export async function communeEnLangue(
  commune: Commune,
  langue: CodeLangue,
): Promise<{ nom: TexteEnLangue; horaires: TexteEnLangue | null }> {
  const enL =
    langue === FRANCAIS
      ? commune
      : await (await getPayloadClient()).findByID({ collection: 'communes', id: commune.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
  return {
    nom: texteEnLangue(enL.nom, commune.nom ?? '', langue),
    horaires: commune.horaires ? texteEnLangue(enL.horaires, commune.horaires, langue) : null,
  }
}

/** Sitemap du domaine d'un site (spec § 3) : pages, actualités et rubriques, par langue disponible. */
export async function construireSitemap(site: Site): Promise<string> {
  const { commune, langueRacine } = site
  const languesSite = languesDuSite(commune)
  const payload = await getPayloadClient()
  const pages = await payload.find({
    collection: 'pages',
    where: { and: [baseCommune(commune.id), { _status: { equals: 'published' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const actus = await actualitesCommune(commune.id, { limite: 500 })
  const [dispoPages, dispoActus] = await Promise.all([
    languesDisponibles(
      'pages',
      commune.id,
      pages.docs.map((p) => p.id),
      languesSite,
    ),
    languesDisponibles(
      'actualites',
      commune.id,
      actus.docs.map((a) => a.id),
      languesSite,
    ),
  ])
  const accueil = pages.docs.find((p) => p.slug === 'accueil')
  const ressources: RessourceSitemap[] = [
    {
      chemin: '/',
      langues: accueil ? (dispoPages.get(accueil.id) ?? [FRANCAIS]) : languesSite,
      priorite: '1.0',
    },
    ...pages.docs
      .filter((p) => p.slug !== 'accueil')
      .map((p) => ({ chemin: `/${p.slug}`, langues: dispoPages.get(p.id) ?? [FRANCAIS], priorite: '0.7' })),
    { chemin: '/actualites', langues: languesSite, priorite: '0.8' },
    ...actus.docs.map((a) => ({
      chemin: `/actualites/${a.slug}`,
      langues: dispoActus.get(a.id) ?? [FRANCAIS],
      priorite: '0.6',
    })),
    { chemin: '/agenda', langues: languesSite, priorite: '0.6' },
    { chemin: '/documents', langues: languesSite, priorite: '0.5' },
  ]
  return sitemapXml(ressources, langueRacine, await domainesCommune(commune.id), basePlateforme(commune.slug))
}
