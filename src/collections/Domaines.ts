import type { CollectionConfig, PayloadRequest, Where } from 'payload'

import { idDe, isOperateur } from '../access/roles'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'
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

async function compterCanoniques(req: PayloadRequest, commune: number, exclureId?: number) {
  const conditions: Where[] = [{ commune: { equals: commune } }, { canonique: { equals: true } }]
  if (exclureId !== undefined) {
    conditions.push({ id: { not_equals: exclureId } })
  }
  const res = await req.payload.count({ collection: 'domaines', where: { and: conditions } })
  return res.totalDocs
}

/**
 * I6 : domaines en base, hostname unique (contrainte SQL via unique: true).
 * Accès collection complète opérateur seul — y compris suppression et
 * suppressions en masse (le field access ne protège pas la suppression).
 * Un seul domaine canonique par commune ; impossible de supprimer ou
 * dé-canonicaliser le dernier canonique d'une commune active.
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
        if (data?.canonique === true) {
          // Au plus un canonique par commune (validation — l'unicité concurrente
          // est garantie en base par index unique partiel, migration J4)
          const commune = idDe(data.commune ?? originalDoc?.commune)
          if (commune === undefined) throw new Error('Domaine sans commune.')
          const autres = await compterCanoniques(req, commune, originalDoc?.id)
          if (autres > 0) {
            throw new Error('Cette commune possède déjà un domaine canonique.')
          }
        }
        // Dé-canonicalisation du dernier canonique d'une commune active : interdit
        if (originalDoc?.canonique === true && data?.canonique === false) {
          const commune = idDe(originalDoc.commune)
          if (commune === undefined) throw new Error('Domaine sans commune.')
          const reste = await compterCanoniques(req, commune, originalDoc.id)
          const cible = await req.payload.findByID({
            collection: 'communes',
            id: commune,
            overrideAccess: true,
          })
          if ((cible as { actif?: boolean }).actif !== false && reste === 0) {
            throw new Error(
              'Impossible de retirer le dernier domaine canonique d’une commune active (remplacer ou désactiver la commune d’abord).',
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
        if (doc.canonique === true) {
          const commune = idDe(doc.commune)
          if (commune === undefined) throw new Error('Domaine sans commune.')
          const reste = await compterCanoniques(req, commune, doc.id)
          const cible = await req.payload.findByID({
            collection: 'communes',
            id: commune,
            overrideAccess: true,
          })
          if ((cible as { actif?: boolean }).actif !== false && reste === 0) {
            throw new Error(
              'Impossible de supprimer le dernier domaine canonique d’une commune active.',
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
          'Un seul par commune — utilisé pour les URLs canoniques et le sitemap. Requis pour activer une commune.',
      },
    },
  ],
}
