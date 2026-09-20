import type { CollectionBeforeChangeHook, CollectionBeforeOperationHook } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'

/**
 * Invariant I3 : l'état publié d'un contenu est du ressort de l'opérateur et
 * des admins de la commune. Un rédacteur propose des brouillons.
 *
 * Ce qu'il faut savoir du moteur Payload pour lire ces deux hooks :
 * une opération `update` n'écrit la table principale — c'est-à-dire la version
 * PUBLIQUE — que si elle ne demande pas l'enregistrement d'un brouillon
 * (`isSavingDraft` dans collections/operations/utilities/update.js). Et quand
 * l'appel ne porte pas `draft: true`, Payload force lui-même
 * `data._status = 'published'` avant les hooks de collection.
 *
 * Tester `data._status === 'published'` seul laissait donc passer la
 * DÉPUBLICATION : document complet + `_status: 'draft'` sans `draft: true`
 * retirait la page du site public sans être admin (prouvé par le test
 * « rédacteur : dépublication refusée »). D'où la mémorisation du mode
 * brouillon ci-dessous, seule information qui distingue « je propose une
 * version » de « j'écris dans la vitrine publique ».
 */

const clePourCollection = (slug: string) => `glmBrouillon:${slug}`

/**
 * Mémorise, pour la requête en cours, si l'opération demande l'enregistrement
 * d'un brouillon. C'est le seul endroit où l'argument `draft` est visible :
 * les hooks `beforeChange` ne le reçoivent pas.
 */
export const memoriserModeBrouillon: CollectionBeforeOperationHook = ({
  args,
  collection,
  operation,
  req,
}) => {
  if (operation === 'update') {
    const contexte = (req.context ?? {}) as Record<string, unknown>
    if (!req.context) {
      ;(req as { context?: Record<string, unknown> }).context = contexte
    }
    contexte[clePourCollection(collection.slug)] = Boolean((args as { draft?: boolean }).draft)
  }
  return args
}

/**
 * Refuse à un non-admin toute écriture qui touche la version publique d'un
 * document publié : publication, ré-écriture d'un publié, et dépublication.
 */
export const bloquerPublication: CollectionBeforeChangeHook = ({
  collection,
  req,
  originalDoc,
  data,
}) => {
  // Appels internes (seed, scripts, overrideAccess) : pas de req.user, l'access
  // control a déjà filtré toute requête externe avant d'atteindre ce hook.
  if (!req.user) return data

  const avant = (originalDoc as { _status?: string } | undefined)?._status
  const apres = (data as { _status?: string } | undefined)?._status ?? avant

  // Enregistrement d'un brouillon : la version publique n'est pas touchée,
  // c'est le travail normal d'un rédacteur. En l'absence d'information
  // (contexte absent), on considère que l'écriture est publique — le doute
  // profite à la vitrine.
  const contexte = req.context as Record<string, unknown> | undefined
  const enregistreUnBrouillon =
    contexte?.[clePourCollection(collection.slug)] === true && apres !== 'published'
  if (enregistreUnBrouillon) return data

  // Passé ce point, l'écriture vise la version publique.
  if (apres === 'published' || avant === 'published') {
    const commune =
      ((data as { tenant?: unknown }).tenant as string | number | undefined) ??
      ((originalDoc as { tenant?: unknown } | undefined)?.tenant as string | number | undefined)
    if (!isOperateur(req.user) && !aRoleSur(req.user, commune, 'admin')) {
      throw new Error(
        'Seul un administrateur de la commune ou un opérateur peut publier ou dépublier.',
      )
    }
  }
  return data
}
