import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { idDe } from '../access/roles'

/**
 * Invariant I12 : journal minimal des changements sensibles (rôles,
 * affectations, domaines). Création interne uniquement (access create: false
 * sur la collection `journal`) — les hooks écrivent avec overrideAccess.
 * L'opération interne reçoit `req` pour rejoindre la transaction en cours
 * (sinon la FK vers une ligne créée dans la même opération est invisible).
 *
 * Un échec d'écriture fait échouer l'opération principale, jamais l'inverse.
 * Dans une transaction Postgres, l'insert refusé avorte déjà toute la
 * transaction : avaler l'erreur ne sauvait pas l'opération, le COMMIT devenait
 * un ROLLBACK muet et l'API répondait « succès » sur une opération annulée.
 * Aucun changement sensible sans trace (I12).
 */
export type TypeJournal = 'commune' | 'utilisateur' | 'domaine'

async function ecrire(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  type: TypeJournal,
  message: string,
  commune?: number,
) {
  await req.payload.create({
    collection: 'journal',
    data: {
      type,
      message,
      ...(commune !== undefined ? { commune } : {}),
      ...(req.user?.id ? { utilisateur: idDe(req.user.id) } : {}),
    },
    overrideAccess: true,
    req, // rejoindre la transaction de l'opération parente
  })
}

function intitule(doc: Record<string, unknown>): string {
  return String(doc.nom ?? doc.hostname ?? doc.email ?? doc.id ?? '?')
}

/**
 * Commune associée à l'entrée de journal :
 * - domaine → la commune référencée ;
 * - commune → la commune elle-même ;
 * - utilisateur → aucune (un compte peut être multi-communes ; l'opérateur voit tout).
 */
function communeDe(type: TypeJournal, brut: Record<string, unknown>): number | undefined {
  if (type === 'domaine') return idDe(brut.commune)
  if (type === 'commune') return idDe(brut.id)
  return undefined
}

/** Journalise les créations/modifications d'une collection (afterChange). */
export const journaliser =
  (type: TypeJournal): CollectionAfterChangeHook =>
  async ({ req, doc, operation }) => {
    const brut = doc as unknown as Record<string, unknown>
    await ecrire(
      req,
      type,
      `${operation === 'create' ? 'Création' : 'Modification'} — ${intitule(brut)}`,
      communeDe(type, brut),
    )
    return doc
  }

/**
 * Journalise les suppressions d'une collection (afterDelete).
 * Une commune supprimée n'existe plus dans la transaction : l'entrée ne peut
 * pas la référencer (clé étrangère), le message porte donc son identifiant.
 */
export const journaliserSuppression =
  (type: TypeJournal): CollectionAfterDeleteHook =>
  async ({ req, doc }) => {
    const brut = doc as unknown as Record<string, unknown>
    await ecrire(
      req,
      type,
      `Suppression — ${intitule(brut)} (#${String(brut.id)})`,
      type === 'commune' ? undefined : communeDe(type, brut),
    )
    return doc
  }
