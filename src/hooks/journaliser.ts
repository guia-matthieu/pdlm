import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { idDe } from '../access/roles'

/**
 * Invariant I12 : journal minimal des changements sensibles (rôles,
 * affectations, domaines). Création interne uniquement (access create: false
 * sur la collection `journal`) — les hooks écrivent avec overrideAccess.
 * Un échec d'audit ne bloque jamais l'opération principale.
 */
export type TypeJournal = 'commune' | 'utilisateur' | 'domaine'

async function ecrire(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  type: TypeJournal,
  message: string,
  commune?: number,
) {
  try {
    await req.payload.create({
      collection: 'journal',
      data: {
        type,
        message,
        ...(commune !== undefined ? { commune } : {}),
        ...(req.user?.id ? { utilisateur: idDe(req.user.id) } : {}),
      },
      overrideAccess: true,
    })
  } catch (erreur) {
    req.payload.logger.error({
      msg: 'Écriture journal échouée',
      type,
      erreur: String(erreur),
    })
  }
}

function intitule(doc: Record<string, unknown>): string {
  return String(doc.nom ?? doc.hostname ?? doc.email ?? doc.id ?? '?')
}

/** Journalise les créations/modifications d'une collection (afterChange). */
export const journaliser =
  (type: TypeJournal): CollectionAfterChangeHook =>
  async ({ req, doc, operation }) => {
    const brut = doc as unknown as Record<string, unknown>
    const commune = type === 'domaine' ? idDe(brut.commune) : (idDe(brut.id) ?? undefined)
    await ecrire(
      req,
      type,
      `${operation === 'create' ? 'Création' : 'Modification'} — ${intitule(brut)}`,
      commune,
    )
    return doc
  }

/** Journalise les suppressions d'une collection (afterDelete). */
export const journaliserSuppression =
  (type: TypeJournal): CollectionAfterDeleteHook =>
  async ({ req, doc }) => {
    const brut = doc as unknown as Record<string, unknown>
    const commune = type === 'domaine' ? idDe(brut.commune) : (idDe(brut.id) ?? undefined)
    await ecrire(req, type, `Suppression — ${intitule(brut)}`, commune)
    return doc
  }
