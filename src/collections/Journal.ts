import type { CollectionConfig } from 'payload'

import { communesAvecRole, isOperateur } from '../access/roles'

/**
 * Invariant I12 : journal des changements sensibles (rôles, affectations,
 * domaines, communes). Création interne uniquement — aucun client ne peut
 * forger des entrées. Aucune modification ni suppression.
 */
export const Journal: CollectionConfig = {
  slug: 'journal',
  labels: { singular: 'Entrée de journal', plural: 'Journal' },
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['createdAt', 'type', 'message', 'commune'],
    description:
      'Journal d’audit des changements de rôles, d’affectations et de domaines. Lecture seule.',
  },
  access: {
    create: () => false,
    update: () => false,
    delete: () => false,
    read: ({ req }) => {
      if (isOperateur(req.user)) return true
      const ids = communesAvecRole(req.user, 'admin')
      return ids.length > 0 ? { commune: { in: ids } } : false
    },
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Commune', value: 'commune' },
        { label: 'Utilisateur', value: 'utilisateur' },
        { label: 'Domaine', value: 'domaine' },
      ],
    },
    { name: 'message', type: 'text', required: true },
    { name: 'commune', type: 'relationship', relationTo: 'communes', index: true },
    { name: 'utilisateur', type: 'relationship', relationTo: 'users' },
  ],
}
