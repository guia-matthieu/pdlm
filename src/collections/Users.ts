import type { CollectionConfig } from 'payload'

import { isOperateur } from '../access/roles'
import { figerPrivileges } from '../hooks/figerPrivileges'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'

/**
 * Invariant I2 : en v0.1, seul l'opérateur crée/supprime des comptes et gère
 * les rôles/affectations. Un utilisateur ne modifie que ses champs personnels
 * (nom, mot de passe). Pas d'inscription publique. Verrouillage après échecs
 * (I13). Le tableau `tenants` avec les rôles par commune est injecté par le
 * plugin multi-tenant.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Utilisateur', plural: 'Utilisateurs' },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'role'],
  },
  auth: {
    maxLoginAttempts: 5,
    lockTime: 15 * 60 * 1000, // 15 minutes
    useAPIKey: false,
  },
  access: {
    read: ({ req }) => Boolean(req.user), // le plugin filtre par commune pour les non-opérateurs
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) =>
      isOperateur(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeChange: [figerPrivileges],
    afterChange: [journaliser('utilisateur')],
    beforeDelete: [
      async ({ req, id }) => {
        // Décision (h) : l'entrée « Suppression » journalisée référence
        // l'acteur (`utilisateur`) — s'il supprime son propre compte, cette
        // FK pointerait vers une ligne absente dans la même transaction
        // (violation brute). Accessoirement, évite aussi un auto-verrouillage.
        if (req.user && String(req.user.id) === String(id)) {
          throw new Error(
            'Suppression impossible : vous ne pouvez pas supprimer votre propre compte. Demandez à un autre opérateur de le faire.',
          )
        }
      },
    ],
    afterDelete: [journaliserSuppression('utilisateur')],
  },
  fields: [
    { name: 'name', type: 'text', label: 'Nom complet' },
    {
      name: 'role',
      type: 'select',
      label: 'Rôle plateforme',
      admin: {
        description:
          '« Opérateur » : staff de l’organisation hébergeuse (accès à toutes les communes). Les rôles par commune se règlent dans le tableau « Communes » ci-dessous.',
      },
      options: [{ label: 'Opérateur', value: 'operateur' }],
      access: {
        create: ({ req }) => isOperateur(req.user),
        update: ({ req }) => isOperateur(req.user),
      },
    },
    {
      name: 'organisation',
      type: 'relationship',
      relationTo: 'organisations',
      label: 'Organisation mandataire',
      admin: {
        description:
          'Le compte agit pour les communes qui ont mandaté cette organisation (collection « Mandats »). Réglé par l’opérateur.',
      },
      access: {
        create: ({ req }) => isOperateur(req.user),
        update: ({ req }) => isOperateur(req.user),
      },
    },
  ],
}
