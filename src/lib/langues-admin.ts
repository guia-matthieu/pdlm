import type { Locale, PayloadRequest } from 'payload'

import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

import { isOperateur } from '../access/roles'
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
  const id =
    getTenantFromCookie(req.headers, 'number') ??
    (tenants.length === 1 ? (tenants[0].tenant as number | { id: number }) : null)
  const idCommune = typeof id === 'object' && id !== null ? id.id : id
  if (idCommune === null || idCommune === undefined)
    return locales.filter((l) => l.code === FRANCAIS)
  const commune = await req.payload
    .findByID({ collection: 'communes', id: idCommune, depth: 0, overrideAccess: true })
    .catch(() => null)
  const actives = new Set<string>([FRANCAIS, ...((commune?.langues as string[] | null) ?? [])])
  return locales.filter((l) => actives.has(l.code))
}
