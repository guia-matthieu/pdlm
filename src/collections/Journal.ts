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
      'Journal d’audit des changements de rôles, d’affectations, de domaines et de mandats. Lecture seule.',
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
        { label: 'Mandat', value: 'mandat' },
      ],
    },
    { name: 'message', type: 'text', required: true },
    { name: 'commune', type: 'relationship', relationTo: 'communes', index: true },
    { name: 'utilisateur', type: 'relationship', relationTo: 'users' },
    {
      name: 'auteurEmail',
      type: 'text',
      label: 'Auteur (figé)',
      admin: {
        description:
          'Email de l’auteur au moment de l’action — figé ici pour survivre à la suppression du compte (FK `utilisateur` en SET NULL).',
      },
    },
    {
      name: 'communeNom',
      type: 'text',
      label: 'Commune (figée)',
      admin: {
        description:
          'Nom de la commune au moment de l’action — figé ici pour survivre à la suppression de la commune (FK `commune` en SET NULL).',
      },
    },
  ],
}
