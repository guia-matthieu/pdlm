import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'

import { idDe } from '../access/roles'
import { FRANCAIS } from '../lib/langues'

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

/** Écrit une entrée de journal dans la transaction de `req` (I12). Exportée pour les messages propres à la mesure d'audience. */
export async function ecrire(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  type: TypeJournal,
  message: string,
  commune?: number,
  communeNom?: string,
) {
  await req.payload.create({
    collection: 'journal',
    data: {
      type,
      message,
      ...(commune !== undefined ? { commune } : {}),
      ...(communeNom !== undefined ? { communeNom } : {}),
      ...(req.user?.id ? { utilisateur: idDe(req.user.id), auteurEmail: req.user.email } : {}),
    },
    overrideAccess: true,
    req, // rejoindre la transaction de l'opération parente
  })
}

function intitule(doc: Record<string, unknown>, nomFrancais?: string): string {
  return String(nomFrancais ?? doc.nom ?? doc.hostname ?? doc.email ?? doc.id ?? '?')
}

/**
 * Nom de référence d'une commune : toujours le français, même quand l'admin
 * édite dans une autre langue (le journal et la mesure d'audience ne changent
 * pas de nom selon la langue d'édition). `nomLu` est le nom tel que lu dans la
 * langue de la requête ; si la commune n'est plus lisible (suppression), on le
 * garde faute de mieux.
 */
export async function nomFrancaisCommune(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  communeId: number | undefined,
  nomLu: unknown,
): Promise<string | undefined> {
  const lu = typeof nomLu === 'string' ? nomLu : undefined
  if ((req.locale ?? FRANCAIS) === FRANCAIS || communeId === undefined) return lu
  const commune = await req.payload
    .findByID({
      collection: 'communes',
      id: communeId,
      locale: FRANCAIS,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
    .catch(() => null)
  return typeof commune?.nom === 'string' ? commune.nom : lu
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

/**
 * Nom de la commune à figer dans l'entrée (décision g) :
 * - type commune → lu directement sur `doc`, qui EST la commune (y compris à
 *   sa suppression, où `doc` porte encore le dernier état connu) ;
 * - type domaine → la commune référencée n'est pas garantie peuplée sur
 *   `doc.commune` (dépend de la profondeur de la requête d'origine), donc
 *   recherchée explicitement ;
 * - type utilisateur → aucune commune associée à l'entrée.
 */
async function nomCommune(
  req: Parameters<CollectionAfterChangeHook>[0]['req'],
  type: TypeJournal,
  brut: Record<string, unknown>,
  communeId: number | undefined,
): Promise<string | undefined> {
  if (type === 'commune') return nomFrancaisCommune(req, idDe(brut.id), brut.nom)
  if (type !== 'domaine' || communeId === undefined) return undefined
  const commune = await req.payload.findByID({
    collection: 'communes',
    id: communeId,
    locale: FRANCAIS,
    overrideAccess: true,
    req,
  })
  return typeof (commune as { nom?: unknown })?.nom === 'string'
    ? (commune as { nom: string }).nom
    : undefined
}

/** Journalise les créations/modifications d'une collection (afterChange). */
export const journaliser =
  (type: TypeJournal): CollectionAfterChangeHook =>
  async ({ req, doc, operation }) => {
    const brut = doc as unknown as Record<string, unknown>
    const commune = communeDe(type, brut)
    const nom = await nomCommune(req, type, brut, commune)
    const titre = intitule(brut, type === 'commune' ? nom : undefined)
    await ecrire(
      req,
      type,
      `${operation === 'create' ? 'Création' : 'Modification'} — ${titre}`,
      commune,
      nom,
    )
    return doc
  }

/**
 * Journalise les suppressions d'une collection (afterDelete).
 * Une commune supprimée n'existe plus dans la transaction : l'entrée ne peut
 * pas la référencer (clé étrangère), le message porte donc son identifiant —
 * mais `communeNom` (décision g) reste renseigné, lu sur `doc` avant sa
 * disparition.
 */
export const journaliserSuppression =
  (type: TypeJournal): CollectionAfterDeleteHook =>
  async ({ req, doc }) => {
    const brut = doc as unknown as Record<string, unknown>
    const commune = type === 'commune' ? undefined : communeDe(type, brut)
    const nom = await nomCommune(req, type, brut, commune)
    const titre = intitule(brut, type === 'commune' ? nom : undefined)
    await ecrire(req, type, `Suppression — ${titre} (#${String(brut.id)})`, commune, nom)
    return doc
  }
