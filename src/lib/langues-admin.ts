import type { Locale, PayloadRequest } from 'payload'

import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

import { idDe, isOperateur } from '../access/roles'
import { FRANCAIS } from './langues'

/**
 * `localization.filterAvailableLocales` (spec § 5) : le français et les langues
 * activées pour la commune sélectionnée dans l'admin ; un opérateur voit tout.
 */
export async function languesDisponiblesAdmin({
  locales,
  req,
}: {
  locales: Locale[]
  req: PayloadRequest
}): Promise<Locale[]> {
  if (isOperateur(req.user)) return locales
  const tenants = (req.user as { tenants?: Array<{ tenant: unknown }> } | null)?.tenants ?? []
  const siennes = tenants.map((t) => idDe(t?.tenant)).filter((id): id is number => id !== undefined)
  // Le cookie n'est qu'un choix d'affichage : il ne compte que s'il désigne
  // une commune de l'utilisateur (sinon, comme s'il n'y en avait pas).
  const cookie = getTenantFromCookie(req.headers, 'number')
  const choisie = typeof cookie === 'number' && siennes.includes(cookie) ? cookie : undefined
  const idCommune = choisie ?? (siennes.length === 1 ? siennes[0] : undefined)
  if (idCommune === undefined) return locales.filter((l) => l.code === FRANCAIS)
  const commune = await req.payload
    .findByID({ collection: 'communes', id: idCommune, depth: 0, overrideAccess: true })
    .catch(() => null)
  const actives = new Set<string>([FRANCAIS, ...((commune?.langues as string[] | null) ?? [])])
  return locales.filter((l) => actives.has(l.code))
}
