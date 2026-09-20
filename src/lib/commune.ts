import { cache } from 'react'
import { headers } from 'next/headers'

import type { Commune } from '../payload-types'

import { getPayloadClient } from './payload'

/** Normalise un host reçu : minuscules, sans port, sans www. initial. */
export function normaliserHost(brut: string): string {
  let h = brut.trim().toLowerCase()
  h = h.replace(/\.+$/, '')
  h = h.split(':')[0]
  return h
}

/** Retire le « www. » initial (alias explicite, pas une identité). */
export function sansWww(host: string): string {
  return host.startsWith('www.') ? host.slice(4) : host
}

/** Hosts de développement reconnus pour le fallback DEFAULT_COMMUNE_SLUG (I6). */
const HOSTS_DEV = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

export interface CandidatCommune {
  /** Slug exact si le host est un sous-domaine de la plateforme. */
  slugPlateforme?: string
  /** Host exact (sans www.) pour une recherche par domaine propre. */
  domaine?: string
  /** Fallback dev si host local nu. */
  fallbackDev?: string
}

/**
 * Fonction pure : déduit le candidat de résolution d'un host (testable sans DB).
 * - sous-domaine de PLATFORM_DOMAIN → slug exact ;
 * - sinon → domaine propre (comparaison exacte en base, I6) ;
 * - host local nu → DEFAULT_COMMUNE_SLUG (jamais en production).
 */
export function candidatCommune(hostBrut: string): CandidatCommune | null {
  const host = normaliserHost(hostBrut)
  if (host === '') return null

  const plateforme = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase()
  if (plateforme) {
    if (host === plateforme || host === `www.${plateforme}` || host === `admin.${plateforme}`) {
      // La plateforme elle-même, son www et son admin ne sont pas des communes
      return null
    }
    if (host.endsWith(`.${plateforme}`)) {
      const slug = host.slice(0, -1 * (plateforme.length + 1))
      if (slug !== '' && slug !== 'admin' && slug !== 'www' && !slug.includes('.')) {
        return { slugPlateforme: slug }
      }
      return null
    }
  }

  if (HOSTS_DEV.has(host)) {
    if (process.env.NODE_ENV === 'production') return null
    const slug = process.env.DEFAULT_COMMUNE_SLUG
    return slug ? { fallbackDev: slug } : null
  }

  if (host.endsWith('.localhost')) {
    // *.localhost résout en loopback : traité comme sous-domaine de plateforme
    if (process.env.NODE_ENV === 'production') return null
    const slug = host.slice(0, -'.localhost'.length)
    return slug && slug !== 'www' ? { slugPlateforme: slug } : null
  }

  return { domaine: sansWww(host) }
}

/**
 * Résolution host → commune (D5). Mémoïsée par requête via React.cache.
 * Lit uniquement le header `x-commune-host` écrasé par le proxy (I7).
 */
export const resolveCommune = cache(async (): Promise<Commune | null> => {
  const entetes = await headers()
  const hostBrut = entetes.get('x-commune-host') ?? ''
  const candidat = candidatCommune(hostBrut)
  if (!candidat) return null

  const payload = await getPayloadClient()

  if (candidat.slugPlateforme || candidat.fallbackDev) {
    const slug = candidat.slugPlateforme ?? candidat.fallbackDev
    const res = await payload.find({
      collection: 'communes',
      where: { and: [{ slug: { equals: slug } }, { actif: { equals: true } }] },
      limit: 1,
      overrideAccess: true,
    })
    return res.docs[0] ?? null
  }

  if (candidat.domaine) {
    // Le host (sans www.) doit correspondre à un domaine de la commune :
    // le www est un alias explicite, on cherche donc le host ET sa variante
    // canonique (I6 — comparaison exacte, jamais contains).
    const variantes = [candidat.domaine]
    if (candidat.domaine.startsWith('www.')) variantes.push(candidat.domaine.slice(4))
    else variantes.push(`www.${candidat.domaine}`)
    const res = await payload.find({
      collection: 'domaines',
      where: { hostname: { in: variantes } },
      limit: 1,
      overrideAccess: true,
      depth: 1,
    })
    const domaine = res.docs[0]
    if (!domaine) return null
    const communeId =
      typeof domaine.commune === 'object' && domaine.commune !== null
        ? domaine.commune.id
        : domaine.commune
    if (communeId === undefined || communeId === null) return null
    const commune = await payload.findByID({
      collection: 'communes',
      id: communeId,
      overrideAccess: true,
    })
    return commune.actif ? commune : null
  }

  return null
})
