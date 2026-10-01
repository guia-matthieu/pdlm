import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type PayloadRequest,
  type Where,
} from 'payload'

import { idDe } from '../access/roles'
import { ecrire } from './journaliser'

const temps = (v: unknown): number | null =>
  typeof v === 'string' && v !== '' ? new Date(v).getTime() : null

/** Un mandat agit entre sa date de début (incluse) et sa date de fin (exclue). */
export function whereMandatsActifs(maintenant: Date): Where {
  const iso = maintenant.toISOString()
  return {
    and: [
      { dateDebut: { less_than_equal: iso } },
      { or: [{ dateFin: { exists: false } }, { dateFin: { greater_than: iso } }] },
    ],
  }
}

const refus = (message: string) => new APIError(message, 400, null, true)

/**
 * I36 — un mandat lie une organisation à une commune. Après création, seule la
 * date de fin bouge (D4) ; un mandat retiré ne se rouvre pas.
 */
export const preparerMandat: CollectionBeforeChangeHook = async ({
  req,
  data,
  originalDoc,
  operation,
}) => {
  const maintenant = new Date()
  if (operation === 'create') {
    data.accordePar = req.user ? idDe(req.user.id) : null
    data.dateDebut = data.dateDebut ?? maintenant.toISOString()
    const organisation = idDe(data.organisation)
    const commune = idDe(data.commune)
    if (organisation === undefined || commune === undefined) {
      throw refus('Un mandat lie une organisation à une commune.')
    }
    const actifs = await req.payload.count({
      collection: 'mandats',
      where: {
        and: [
          { organisation: { equals: organisation } },
          { commune: { equals: commune } },
          { or: [{ dateFin: { exists: false } }, { dateFin: { greater_than: maintenant.toISOString() } }] },
        ],
      },
      overrideAccess: true,
      req,
    })
    if (actifs.totalDocs > 0) throw refus('Cette organisation est déjà mandataire de cette commune.')
  } else if (originalDoc) {
    data.organisation = idDe(originalDoc.organisation)
    data.commune = idDe(originalDoc.commune)
    data.dateDebut = originalDoc.dateDebut
    data.accordePar = idDe(originalDoc.accordePar) ?? null
    const finAvant = temps(originalDoc.dateFin)
    if (
      finAvant !== null &&
      finAvant <= maintenant.getTime() &&
      temps(data.dateFin) !== finAvant
    ) {
      throw refus('Un mandat retiré ne se rouvre pas : accordez un nouveau mandat.')
    }
  }
  const debut = temps(data.dateDebut)
  const fin = temps(data.dateFin)
  if (debut !== null && fin !== null && fin < debut) {
    throw refus('La date de fin précède la date de début.')
  }
  return data
}

async function libelle(req: PayloadRequest, doc: Record<string, unknown>) {
  const organisation = await req.payload.findByID({
    collection: 'organisations',
    id: idDe(doc.organisation)!,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const commune = await req.payload.findByID({
    collection: 'communes',
    id: idDe(doc.commune)!,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return { texte: `${organisation.nom} pour ${commune.nom}`, communeId: commune.id, communeNom: commune.nom }
}

/** I36 : tout mandat accordé ou retiré est journalisé (I12). */
export const journaliserMandat: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation,
}) => {
  const maintenant = Date.now()
  const finAvant = temps(previousDoc?.dateFin)
  const finApres = temps(doc.dateFin)
  const verbe =
    operation === 'create'
      ? 'Mandat accordé'
      : finApres !== null && finApres <= maintenant && (finAvant === null || finAvant > maintenant)
        ? 'Mandat retiré'
        : 'Mandat modifié'
  const { texte, communeId, communeNom } = await libelle(req, doc)
  await ecrire(req, 'mandat', `${verbe} — ${texte}`, communeId, communeNom)
  return doc
}

export const journaliserSuppressionMandat: CollectionAfterDeleteHook = async ({ req, doc }) => {
  const { texte, communeId, communeNom } = await libelle(req, doc)
  await ecrire(req, 'mandat', `Mandat supprimé — ${texte}`, communeId, communeNom)
  return doc
}
