import type { CollectionConfig } from 'payload'

import { creerPublication, lirePublic, majPublication, supprimerContenu } from '../access'
import { figerTenant, validerRelationsTenant } from '../hooks'
import { validerUrlEditoriale } from '../lib/url'
import { verifierCommuneCreation } from '../hooks/verifierCommuneCreation'
import { ROLES_PUBLICATION } from '../access/roles'

/** Validation : la fin doit suivre le début. */
const dateFinApresDebut = (
  valeur: string | Date | null | undefined,
  siblingData?: Record<string, unknown>,
): true | string => {
  if (!valeur || !siblingData?.['dateDebut']) return true
  return (
    new Date(valeur).getTime() >= new Date(siblingData['dateDebut'] as string).getTime() ||
    'La date de fin doit être postérieure ou égale à la date de début.'
  )
}

/** I3 : pas de workflow — écritures réservées à l'admin, au mandataire et à l'opérateur en v0.1 (I36). */
export const Evenements: CollectionConfig = {
  slug: 'evenements',
  labels: { singular: 'Événement', plural: 'Agenda' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'dateDebut', 'dateFin', 'lieu'],
  },
  access: {
    read: lirePublic,
    create: creerPublication,
    update: majPublication,
    delete: supprimerContenu,
  },
  hooks: {
    // I4 : pas de champ relationnel, mais la description (texte riche) peut en porter
    beforeChange: [
      verifierCommuneCreation(...ROLES_PUBLICATION),
      figerTenant,
      validerRelationsTenant(() => ({})),
    ],
  },
  fields: [
    { name: 'titre', type: 'text', required: true, label: 'Titre' },
    {
      name: 'dateDebut',
      type: 'date',
      required: true,
      label: 'Début',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'dateFin',
      type: 'date',
      required: true,
      label: 'Fin',
      validate: (valeur, { siblingData }) =>
        dateFinApresDebut(valeur, siblingData as Record<string, unknown> | undefined),
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'lieu', type: 'text', label: 'Lieu' },
    { name: 'description', type: 'richText', label: 'Description' },
    {
      name: 'inscription',
      type: 'group',
      label: 'Inscription',
      fields: [
        { name: 'actif', type: 'checkbox', defaultValue: false, label: 'Inscription requise' },
        { name: 'lien', type: 'text', label: 'Lien d’inscription', validate: validerUrlEditoriale },
      ],
    },
  ],
}
