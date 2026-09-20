import type { CollectionBeforeChangeHook } from 'payload'

import { ValidationError } from 'payload'

import { idDe } from '../access/roles'

/** Références à valider, extraites des données du document (I4). */
export interface RefsAValider {
  media?: Array<string | number>
  pages?: Array<string | number>
  auteur?: string | number | null
}

export type ExtracteurRefs = (data: Record<string, unknown>) => RefsAValider

/** Parcourt un tableau de blocs et collecte les uploads média référencés. */
export function refsMediaDesBlocs(blocs: unknown): Array<string | number> {
  const ids: Array<string | number> = []
  if (!Array.isArray(blocs)) return ids
  for (const bloc of blocs as Array<Record<string, unknown>>) {
    for (const cle of ['image', 'media']) {
      const v = bloc?.[cle]
      if (v !== undefined && v !== null && v !== '') ids.push(v as string | number)
    }
    const images = bloc?.['images']
    if (Array.isArray(images)) {
      for (const ligne of images as Array<Record<string, unknown>>) {
        const m = ligne?.['media']
        if (m !== undefined && m !== null && m !== '') ids.push(m as string | number)
      }
    }
  }
  return ids
}

/**
 * Invariant I4 : validation serveur de l'appartenance des relations au même
 * tenant — liste exhaustive des champs relationnels exposés (communes.logo,
 * actualites.image, actualites.auteur via affectation, blocs des pages,
 * menus.items.page). filterOptions admin ne suffit pas.
 */
export const validerRelationsTenant =
  (extraire: ExtracteurRefs): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const brut = (data ?? {}) as Record<string, unknown>
    const tenant = idDe(
      brut['tenant'] ?? (originalDoc as Record<string, unknown> | undefined)?.['tenant'],
    )
    if (tenant === undefined) return data

    const refs = extraire(brut)

    for (const idMedia of refs.media ?? []) {
      const cible = await req.payload
        .findByID({ collection: 'media', id: idMedia, overrideAccess: true, depth: 0 })
        .catch(() => null)
      if (!cible || idDe((cible as unknown as Record<string, unknown>)['tenant']) !== tenant) {
        throw new ValidationError({
          errors: [
            {
              message: 'Un média référencé n’appartient pas à cette commune.',
              path: 'blocs',
            },
          ],
        })
      }
    }

    for (const idPage of refs.pages ?? []) {
      const cible = await req.payload
        .findByID({ collection: 'pages', id: idPage, overrideAccess: true, depth: 0 })
        .catch(() => null)
      if (!cible || idDe((cible as unknown as Record<string, unknown>)['tenant']) !== tenant) {
        throw new ValidationError({
          errors: [
            {
              message: 'Une page référencée n’appartient pas à cette commune.',
              path: 'items',
            },
          ],
        })
      }
    }

    if (refs.auteur !== undefined && refs.auteur !== null && refs.auteur !== '') {
      const auteur = (await req.payload
        .findByID({ collection: 'users', id: refs.auteur, overrideAccess: true, depth: 0 })
        .catch(() => null)) as Record<string, unknown> | null
      const affecte =
        auteur !== null &&
        (auteur['role'] === 'operateur' ||
          (Array.isArray(auteur['tenants']) &&
            (auteur['tenants'] as Array<Record<string, unknown>>).some(
              (ligne) => idDe(ligne?.['tenant']) === tenant,
            )))
      if (!affecte) {
        throw new ValidationError({
          errors: [
            {
              message: 'L’auteur sélectionné n’est pas membre de cette commune.',
              path: 'auteur',
            },
          ],
        })
      }
    }

    return data
  }
