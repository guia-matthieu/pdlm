import type {
  CollectionBeforeChangeHook,
  CollectionBeforeOperationHook,
  CollectionBeforeValidateHook,
  SelectField,
} from 'payload'

import { ValidationError } from 'payload'

import { FRANCAIS } from './langues'

/**
 * Un champ localisé `required: true` devient une colonne NOT NULL de la table
 * `*_locales` (drizzle, traverseFields) : impossible alors de ne traduire qu'une
 * partie des petits textes (spec § 2, règle 3). On l'exige donc en français
 * seulement ; hors français, `exigerTraductionComplete` prend le relais.
 */
export function lexicalVide(valeur: unknown): boolean {
  const racine = (valeur as { root?: { children?: unknown[] } } | null | undefined)?.root
  if (!racine?.children?.length) return true
  const texte = (noeud: unknown): string => {
    const n = noeud as { text?: string; children?: unknown[] }
    return (n.text ?? '') + (n.children ?? []).map(texte).join('')
  }
  return racine.children.map(texte).join('').trim() === ''
}

function vide(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined || valeur === '') return true
  if (Array.isArray(valeur)) return valeur.length === 0
  if (typeof valeur === 'object' && 'root' in (valeur as object)) return lexicalVide(valeur)
  return false
}

export const requisEnFrancais = (valeur: unknown, { req }: { req: { locale?: string | null } }) =>
  (req.locale ?? FRANCAIS) !== FRANCAIS || !vide(valeur) || 'Ce champ est obligatoire en français.'

/**
 * R5 : un contenu se crée en français (la langue qui fait foi), puis se
 * traduit. Sans cette règle, un document créé dans une autre langue n'aurait
 * aucun des champs obligatoires en français (`requisEnFrancais` ne les exige
 * qu'en français). Placé en tête de `beforeValidate` : le refus arrive avant
 * toute autre vérification.
 */
export const creerEnFrancais: CollectionBeforeValidateHook = ({ data, operation, req }) => {
  if (operation === 'create' && (req.locale ?? FRANCAIS) !== FRANCAIS) {
    throw new ValidationError({
      errors: [{ path: 'id', message: 'Créez d’abord ce contenu en français, puis traduisez-le.' }],
    })
  }
  return data
}

/** État de traduction (spec § 2) — il décide seul de l'affichage public d'une langue. */
export const champTraduction: SelectField = {
  name: 'traduction',
  type: 'select',
  localized: true,
  defaultValue: 'non-traduite',
  label: 'État de la traduction',
  options: [
    { label: 'Non traduite', value: 'non-traduite' },
    { label: 'À relire', value: 'a-relire' },
    { label: 'Validée', value: 'validee' },
  ],
  admin: {
    position: 'sidebar',
    description: 'Seule une traduction validée est montrée au public dans cette langue.',
    // Masqué quand on édite le français (Payload ne passe pas la langue aux `condition`).
    components: { Field: '/components/admin/ChampTraduction#ChampTraduction' },
  },
}

const LIBELLES: Record<string, string> = {
  titre: 'le titre',
  blocs: 'le contenu de la page',
  resume: 'le résumé',
  contenu: 'le contenu',
  message: 'le message',
}

/** I17 : une langue ne passe à « validée » que si ses champs obligatoires sont remplis. */
export const exigerTraductionComplete =
  (champs: string[]): CollectionBeforeChangeHook =>
  ({ data, req }) => {
    if ((req.locale ?? FRANCAIS) === FRANCAIS || data?.traduction !== 'validee') return data
    const manquants = champs.filter((champ) => vide(data[champ]))
    if (manquants.length > 0) {
      throw new ValidationError({
        errors: manquants.map((champ) => ({
          path: champ,
          message: `Impossible de valider la traduction : ${LIBELLES[champ] ?? champ} manque dans cette langue.`,
        })),
      })
    }
    return data
  }

/** Opérations de lecture vues par `beforeOperation` (Payload 3.90, `operationToHookOperation`). */
const LECTURES = new Set(['read', 'readDistinct', 'count', 'countVersions'])

/**
 * R14 : une traduction « à relire » reste invisible au public, y compris sans
 * brouillon (spec § 2). Le site public lit par l'API locale et filtre lui-même
 * sur `traduction` ; l'API REST, elle, est joignable sans compte (le proxy
 * laisse passer `/api/*`). Une lecture non locale et anonyme est donc servie
 * en français seul, `locale=all` compris. Les opérations de Payload lisent
 * `req.locale` après ce hook (find, findByID, findVersions, findDistinct,
 * count) : le modifier ici suffit. `findVersionByID` le lit avant, mais
 * `readVersions` exige un compte (règle par défaut de Payload).
 */
export const lectureAnonymeEnFrancais: CollectionBeforeOperationHook = ({
  args,
  operation,
  req,
}) => {
  if (!LECTURES.has(operation) || req.payloadAPI === 'local' || req.user) return args
  req.locale = FRANCAIS
  req.fallbackLocale = FRANCAIS
  return args
}
