import type { CollectionConfig, PayloadRequest, Where } from 'payload'

import { ValidationError } from 'payload'

import { idDe, isOperateur } from '../access/roles'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'
import { FRANCAIS, LANGUES, nomLangueMinuscule } from '../lib/langues'
import { hostnamesReserves } from './Communes'

/** Normalisation d'un hostname : minuscules, IDNA-ASCII, sans port ni point final (I6). */
export function normaliserHostname(brut: string): string {
  let h = brut.trim().toLowerCase().replace(/\.+$/, '')
  h = h.replace(/^[a-z][a-z0-9+.-]*:\/\//, '') // tolérer un schéma collé
  h = h.split('/')[0] // tolérer un chemin collé
  h = h.split(':')[0] // retirer le port
  try {
    // Le parseur URL applique l'IDNA (unicode → punycode ASCII)
    h = new URL(`https://${h}`).hostname
  } catch {
    throw new Error(`Hostname invalide : « ${brut} »`)
  }
  if (!/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(h) || h === '') {
    throw new Error(`Hostname invalide : « ${brut} »`)
  }
  return h
}

async function compterCanoniques(
  req: PayloadRequest,
  commune: number,
  langue: string,
  exclureId?: number,
) {
  const conditions: Where[] = [
    { commune: { equals: commune } },
    { canonique: { equals: true } },
    { langue: { equals: langue } },
  ]
  if (exclureId !== undefined) {
    conditions.push({ id: { not_equals: exclureId } })
  }
  const res = await req.payload.count({ collection: 'domaines', where: { and: conditions } })
  return res.totalDocs
}

const erreur = (path: string, message: string) => new ValidationError({ errors: [{ path, message }] })

/**
 * I6 : domaines en base, hostname unique (contrainte SQL via unique: true).
 * Accès collection complète opérateur seul — y compris suppression et
 * suppressions en masse (le field access ne protège pas la suppression).
 * Un seul domaine canonique par commune et par langue ; impossible de
 * supprimer ou dé-canonicaliser le dernier canonique français d'une commune
 * active.
 */
export const Domaines: CollectionConfig = {
  slug: 'domaines',
  labels: { singular: 'Domaine', plural: 'Domaines' },
  admin: {
    useAsTitle: 'hostname',
    defaultColumns: ['hostname', 'commune', 'canonique'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) => isOperateur(req.user),
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.hostname === 'string' && data.hostname !== '') {
          data.hostname = normaliserHostname(data.hostname)
          if (hostnamesReserves().includes(data.hostname)) {
            throw new Error(`Hostname réservé à la plateforme : « ${data.hostname} »`)
          }
        }
        return data
      },
    ],
    beforeChange: [
      async ({ req, data, originalDoc }) => {
        const commune = idDe(data?.commune ?? originalDoc?.commune)
        if (commune === undefined) throw erreur('commune', 'Domaine sans commune.')
        const langue: string = data?.langue ?? originalDoc?.langue ?? FRANCAIS
        const canonique: boolean = data?.canonique ?? originalDoc?.canonique ?? false
        const cible = await req.payload.findByID({
          collection: 'communes',
          id: commune,
          overrideAccess: true,
          req,
        })

        // La langue servie à la racine doit être activée pour la commune.
        if (langue !== FRANCAIS && !((cible.langues as string[] | null) ?? []).includes(langue)) {
          throw erreur('langue', `La commune n’a pas activé le ${nomLangueMinuscule(langue)}. Activez-le d’abord dans sa fiche (Langues du site).`)
        }

        // I6 élargi : au plus un canonique par commune et par langue (l'index
        // unique partiel de la migration multilingue le garantit en base).
        if (canonique && (await compterCanoniques(req, commune, langue, originalDoc?.id)) > 0) {
          throw erreur('canonique', `Cette commune possède déjà un domaine canonique en ${nomLangueMinuscule(langue)}.`)
        }

        // Le canonique français reste requis pour une commune active : on ne
        // peut ni le dé-canonicaliser ni le faire passer à une autre langue
        // s'il est le dernier.
        const etaitCanoniqueFr = originalDoc?.canonique === true && (originalDoc?.langue ?? FRANCAIS) === FRANCAIS
        const resteCanoniqueFr = canonique && langue === FRANCAIS
        if (etaitCanoniqueFr && !resteCanoniqueFr && cible.actif !== false) {
          if ((await compterCanoniques(req, commune, FRANCAIS, originalDoc.id)) === 0) {
            throw erreur(
              'canonique',
              'Impossible de retirer le dernier domaine canonique en français d’une commune active (en créer un autre ou désactiver la commune d’abord).',
            )
          }
        }
        return data
      },
    ],
    beforeDelete: [
      async ({ req, id }) => {
        const doc = await req.payload.findByID({
          collection: 'domaines',
          id,
          overrideAccess: true,
        })
        if (doc.canonique === true && (doc.langue ?? FRANCAIS) === FRANCAIS) {
          const commune = idDe(doc.commune)
          if (commune === undefined) throw erreur('id', 'Domaine sans commune.')
          const reste = await compterCanoniques(req, commune, FRANCAIS, doc.id)
          const cible = await req.payload.findByID({
            collection: 'communes',
            id: commune,
            overrideAccess: true,
          })
          if ((cible as { actif?: boolean }).actif !== false && reste === 0) {
            throw erreur(
              'id',
              'Impossible de supprimer le dernier domaine canonique en français d’une commune active.',
            )
          }
        }
      },
    ],
    afterChange: [journaliser('domaine')],
    afterDelete: [journaliserSuppression('domaine')],
  },
  fields: [
    {
      name: 'hostname',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Hostname',
      admin: {
        description:
          'Domaine exact, sans https:// ni www (le www est un alias explicite à ajouter séparément). Ex. : mairie-saintx.fr',
      },
    },
    {
      // RPNT § 2 et I35 : formes recommandées pour la commune choisie et
      // signalement (jamais bloquant) du hostname saisi. Champ `ui` : rien
      // en base, aucune migration.
      type: 'ui',
      name: 'nomenclature',
      label: 'Nomenclature',
      admin: {
        components: {
          Field: '/components/admin/NomenclatureDomaines#NomenclatureDomaines',
        },
      },
    },
    {
      name: 'commune',
      type: 'relationship',
      relationTo: 'communes',
      required: true,
      index: true,
      label: 'Commune',
    },
    {
      name: 'canonique',
      type: 'checkbox',
      defaultValue: false,
      label: 'Domaine canonique',
      admin: {
        description:
          'Un seul par commune et par langue — utilisé pour les URLs canoniques et le sitemap. Le canonique français est requis pour activer une commune.',
      },
    },
    {
      name: 'langue',
      type: 'select',
      required: true,
      defaultValue: FRANCAIS,
      label: 'Langue servie à la racine',
      options: LANGUES.map((l) => ({ label: l.nom, value: l.code })),
      admin: {
        description:
          'Langue affichée à l’adresse nue de ce domaine (ex. pigna.corsica → corse). Les autres langues y sont servies sous /fr, /co…',
      },
    },
  ],
}
