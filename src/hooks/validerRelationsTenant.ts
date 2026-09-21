import type { CollectionBeforeChangeHook, CollectionSlug, PayloadRequest } from 'payload'

import { ValidationError } from 'payload'

import { idDe } from '../access/roles'

/** Références à valider, extraites des données du document (I4). */
export interface RefsAValider {
  media?: Array<string | number>
  pages?: Array<string | number>
  auteur?: string | number | null
  /** Champ signalé quand un média est refusé (défaut : `blocs`). */
  champMedia?: string
}

export type ExtracteurRefs = (data: Record<string, unknown>) => RefsAValider

/**
 * Commune à laquelle les références doivent appartenir. `undefined` : rien à
 * valider ; `null` : aucune référence ne peut convenir (commune pas encore créée).
 */
export type ResolveurTenant = (args: {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown>
}) => number | null | undefined

const tenantDuDocument: ResolveurTenant = ({ data, originalDoc }) =>
  idDe(data['tenant'] ?? originalDoc?.['tenant'])

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

/** Référence d'un texte riche : document visé et chemin du champ qui la porte. */
export interface RefTexteRiche {
  collection: string
  id: unknown
  chemin: string
}

/**
 * Collecte les documents référencés par les textes riches Lexical présents
 * dans `valeur`, à toute profondeur (blocs, tableaux) : nœuds upload et
 * relationship, liens internes. Le chemin est celui du champ texte riche
 * (ex. `blocs.0.contenu`).
 */
export function refsDesTextesRiches(valeur: unknown, chemin = ''): RefTexteRiche[] {
  const sousChemin = (cle: string | number) => (chemin ? `${chemin}.${cle}` : String(cle))
  if (Array.isArray(valeur)) {
    return valeur.flatMap((v, i) => refsDesTextesRiches(v, sousChemin(i)))
  }
  if (!valeur || typeof valeur !== 'object') return []
  const racine = (valeur as Record<string, unknown>)['root'] as Record<string, unknown> | undefined
  if (racine?.['type'] === 'root') {
    const refs: RefTexteRiche[] = []
    collecterNoeuds(racine, chemin, refs)
    return refs
  }
  return Object.entries(valeur).flatMap(([cle, v]) => refsDesTextesRiches(v, sousChemin(cle)))
}

function collecterNoeuds(noeud: Record<string, unknown>, chemin: string, refs: RefTexteRiche[]) {
  const type = noeud['type']
  if ((type === 'upload' || type === 'relationship') && typeof noeud['relationTo'] === 'string') {
    refs.push({ collection: noeud['relationTo'], id: noeud['value'], chemin })
  }
  const champs = noeud['fields'] as Record<string, unknown> | null | undefined
  const doc = champs?.['doc'] as Record<string, unknown> | null | undefined
  if ((type === 'link' || type === 'autolink') && champs?.['linkType'] === 'internal' && doc) {
    refs.push({ collection: String(doc['relationTo']), id: doc['value'], chemin })
  }
  const enfants = noeud['children']
  if (Array.isArray(enfants)) {
    for (const enfant of enfants) {
      if (enfant && typeof enfant === 'object') {
        collecterNoeuds(enfant as Record<string, unknown>, chemin, refs)
      }
    }
  }
}

/** Collections rattachées à une commune : seules cibles admises dans un texte riche. */
const COLLECTIONS_COMMUNALES: readonly string[] = [
  'media',
  'documents',
  'pages',
  'actualites',
  'evenements',
]

interface Reference extends RefTexteRiche {
  message: string
}

/** ID brut (nombre ou chaîne numérique) ou objet peuplé. */
function idReference(ref: unknown): number | undefined {
  if (typeof ref === 'string' && /^\d+$/.test(ref)) return Number(ref)
  return idDe(ref)
}

/**
 * Une requête par collection (et non par référence) ; refuse la première
 * référence introuvable, hors commune ou vers une collection non communale.
 */
async function verifierReferences(
  req: PayloadRequest,
  references: Reference[],
  tenant: number | null,
) {
  const parCollection = new Map<string, Set<number>>()
  for (const ref of references) {
    const id = idReference(ref.id)
    if (id === undefined || !COLLECTIONS_COMMUNALES.includes(ref.collection)) continue
    parCollection.set(ref.collection, (parCollection.get(ref.collection) ?? new Set()).add(id))
  }

  const valides = new Set<string>()
  for (const [collection, ids] of parCollection) {
    const trouves = await req.payload
      .find({
        collection: collection as CollectionSlug,
        where: { id: { in: [...ids] } },
        overrideAccess: true,
        depth: 0,
        pagination: false,
      })
      .catch(() => null)
    for (const doc of trouves?.docs ?? []) {
      if (
        tenant !== null &&
        idDe((doc as unknown as Record<string, unknown>)['tenant']) === tenant
      ) {
        valides.add(`${collection}:${doc.id}`)
      }
    }
  }

  for (const ref of references) {
    if (!COLLECTIONS_COMMUNALES.includes(ref.collection)) {
      throw new ValidationError({
        errors: [
          {
            message: 'Seuls les contenus de la commune peuvent être référencés dans le texte.',
            path: ref.chemin,
          },
        ],
      })
    }
    if (!valides.has(`${ref.collection}:${idReference(ref.id)}`)) {
      throw new ValidationError({ errors: [{ message: ref.message, path: ref.chemin }] })
    }
  }
}

/**
 * Invariant I4 : validation serveur de l'appartenance des relations au même
 * tenant — liste exhaustive des champs relationnels exposés (communes.logo,
 * actualites.image, actualites.auteur via affectation, blocs des pages,
 * menus.items.page) et, pour toute collection qui pose ce hook, les
 * références des textes riches. filterOptions admin ne suffit pas.
 */
export const validerRelationsTenant =
  (
    extraire: ExtracteurRefs,
    tenantDe: ResolveurTenant = tenantDuDocument,
  ): CollectionBeforeChangeHook =>
  async ({ data, originalDoc, req }) => {
    const brut = (data ?? {}) as Record<string, unknown>
    const tenant = tenantDe({
      data: brut,
      originalDoc: originalDoc as Record<string, unknown> | undefined,
    })
    if (tenant === undefined) return data

    const refs = extraire(brut)

    await verifierReferences(
      req,
      [
        ...(refs.media ?? []).map((id) => ({
          collection: 'media',
          id,
          chemin: refs.champMedia ?? 'blocs',
          message: 'Un média référencé n’appartient pas à cette commune.',
        })),
        ...(refs.pages ?? []).map((id) => ({
          collection: 'pages',
          id,
          chemin: 'items',
          message: 'Une page référencée n’appartient pas à cette commune.',
        })),
        ...refsDesTextesRiches(brut).map((ref) => ({
          ...ref,
          message: 'Un contenu référencé dans le texte n’appartient pas à cette commune.',
        })),
      ],
      tenant,
    )

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
