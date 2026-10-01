import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'

import { idDe } from '../access/roles'
import { whereMandatsActifs } from './mandats'

type Ligne = { tenant?: unknown; roles?: string[] | null } | null

/**
 * I36 — les utilisateurs d'une organisation mandataire héritent du rôle
 * `mandataire` sur chaque commune qui l'a mandatée. `req.user` est chargé par
 * `findByID` à chaque requête authentifiée (stratégie JWT) : la ligne apparaît
 * et disparaît avec le mandat, sans rien stocker. Le plugin multi-tenant et
 * `communesAvecRole` la lisent comme un rôle par commune ordinaire.
 * D6 : une commune où le compte a déjà un rôle réel ne reçoit pas de ligne.
 */
export const ajouterLignesMandat: CollectionAfterReadHook = async ({ doc, req }) => {
  const organisation = idDe(doc.organisation)
  if (organisation === undefined) return doc
  const { docs } = await req.payload.find({
    collection: 'mandats',
    where: { and: [{ organisation: { equals: organisation } }, whereMandatsActifs(new Date())] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const reelles = ((doc.tenants ?? []) as Ligne[]).filter(Boolean)
  // D6 : une ligne réelle sans rôle ne compte pas comme « déjà là ».
  const dejaLa = new Set(
    reelles.filter((l) => (l!.roles ?? []).length > 0).map((l) => String(idDe(l!.tenant))),
  )
  const ajouts: Ligne[] = []
  for (const mandat of docs) {
    const commune = idDe(mandat.commune)
    if (commune === undefined || dejaLa.has(String(commune))) continue
    dejaLa.add(String(commune))
    ajouts.push({ tenant: commune, roles: ['mandataire'] })
  }
  return ajouts.length > 0 ? { ...doc, tenants: [...reelles, ...ajouts] } : doc
}

/**
 * Les lignes `mandataire` ne sont jamais écrites : le formulaire de l'admin
 * renvoie celles qu'il a affichées. Hook de collection `beforeChange` : il
 * tourne avant la validation des champs (operations/utilities/update.js).
 * Dernier de la liste, après `figerPrivileges` qui peut recopier `tenants`.
 */
export const retirerLignesMandat: CollectionBeforeChangeHook = ({ data }) => {
  const lignes = (data as { tenants?: Ligne[] }).tenants
  if (!Array.isArray(lignes)) return data
  ;(data as { tenants?: Ligne[] }).tenants = lignes
    .filter((l): l is NonNullable<Ligne> => Boolean(l))
    .flatMap((l) => {
      const roles = l.roles ?? []
      if (!roles.includes('mandataire')) return [l]
      const reels = roles.filter((r) => r !== 'mandataire')
      return reels.length > 0 ? [{ ...l, roles: reels }] : []
    })
  return data
}
