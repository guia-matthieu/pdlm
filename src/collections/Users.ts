import type { CollectionConfig, Where } from 'payload'

import { communesAvecRole, isOperateur } from '../access/roles'
import { figerPrivileges } from '../hooks/figerPrivileges'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'
import { ajouterLignesMandat, retirerLignesMandat } from '../hooks/lignesMandat'

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
    // D3 : un compte ne lit que lui-même et les comptes des communes où il a
    // un rôle réel. Les lignes `mandataire` n'en ouvrent aucun : un EPCI ne
    // voit pas les agents des mairies qu'il sert (données personnelles).
    // Le plugin y ajoute son propre filtre par commune (ET logique).
    read: ({ req }) => {
      if (isOperateur(req.user)) return true
      if (!req.user) return false
      const ids = communesAvecRole(req.user, 'admin', 'redacteur')
      const soi: Where = { id: { equals: req.user.id } }
      return ids.length > 0 ? { or: [soi, { 'tenants.tenant': { in: ids } }] } : soi
    },
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) =>
      isOperateur(req.user) || (req.user ? { id: { equals: req.user.id } } : false),
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeChange: [figerPrivileges, retirerLignesMandat],
    afterRead: [ajouterLignesMandat],
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
