import type { CollectionConfig, Where } from 'payload'

import { communesAvecRole, idDe, isOperateur } from '../access/roles'
import { journaliserMandat, journaliserSuppressionMandat, preparerMandat } from '../hooks/mandats'

/**
 * Spec RPNT section 8, I36 — une organisation agit pour le compte d'une
 * commune. Accorder et retirer relèvent de l'admin de la commune ou de
 * l'opérateur ; l'organisation voit les mandats qu'elle détient. D7 : hors du
 * plugin multi-tenant, la lecture suit ces deux règles à la fois.
 */
export const Mandats: CollectionConfig = {
  slug: 'mandats',
  labels: { singular: 'Mandat', plural: 'Mandats' },
  admin: {
    defaultColumns: ['organisation', 'commune', 'dateDebut', 'dateFin'],
    description:
      'Organisations qui agissent pour le compte d’une commune : elles rédigent, publient et suivent la conformité ; la commune garde ses utilisateurs, son domaine et ses réglages.',
  },
  access: {
    read: ({ req }) => {
      if (isOperateur(req.user)) return true
      if (!req.user) return false
      const conditions: Where[] = []
      const administrees = communesAvecRole(req.user, 'admin')
      if (administrees.length > 0) conditions.push({ commune: { in: administrees } })
      const organisation = idDe((req.user as { organisation?: unknown }).organisation)
      if (organisation !== undefined) conditions.push({ organisation: { equals: organisation } })
      return conditions.length > 0 ? { or: conditions } : false
    },
    create: ({ req, data }) => {
      if (isOperateur(req.user)) return true
      const cible = idDe((data as { commune?: unknown } | undefined)?.commune)
      return cible !== undefined && communesAvecRole(req.user, 'admin').includes(String(cible))
    },
    update: ({ req }) => {
      if (isOperateur(req.user)) return true
      const administrees = communesAvecRole(req.user, 'admin')
      return administrees.length > 0 ? { commune: { in: administrees } } : false
    },
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeChange: [preparerMandat],
    afterChange: [journaliserMandat],
    afterDelete: [journaliserSuppressionMandat],
  },
  fields: [
    {
      name: 'organisation',
      type: 'relationship',
      relationTo: 'organisations',
      required: true,
      index: true,
      label: 'Organisation mandataire',
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
      name: 'dateDebut',
      type: 'date',
      label: 'Début',
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Par défaut : maintenant.' },
    },
    {
      name: 'dateFin',
      type: 'date',
      label: 'Fin',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Pour retirer le mandat tout de suite, choisir maintenant. Un mandat retiré ne se rouvre pas : en accorder un nouveau.',
      },
    },
    {
      name: 'accordePar',
      type: 'relationship',
      relationTo: 'users',
      label: 'Accordé par',
      admin: { readOnly: true },
    },
  ],
}
