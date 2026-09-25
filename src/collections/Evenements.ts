import type { CollectionConfig } from 'payload'

import { creerAdmin, lirePublic, majAdmin, supprimerContenu } from '../access'
import { figerTenant, validerRelationsTenant } from '../hooks'
import {
  champTraduction,
  creerEnFrancais,
  exigerTraductionComplete,
  requisEnFrancais,
} from '../lib/champs-langue'
import { validerUrlEditoriale } from '../lib/url'

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

/** I3 : pas de workflow — écritures réservées admin/opérateur en v0.1. */
export const Evenements: CollectionConfig = {
  slug: 'evenements',
  labels: { singular: 'Événement', plural: 'Agenda' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'dateDebut', 'dateFin', 'lieu'],
  },
  access: {
    read: lirePublic,
    create: creerAdmin,
    update: majAdmin,
    delete: supprimerContenu,
  },
  hooks: {
    beforeValidate: [creerEnFrancais],
    // I4 : pas de champ relationnel, mais la description (texte riche) peut en porter
    beforeChange: [
      figerTenant,
      validerRelationsTenant(() => ({})),
      exigerTraductionComplete(['titre']),
    ],
  },
  fields: [
    {
      name: 'titre',
      type: 'text',
      localized: true,
      validate: requisEnFrancais,
      label: 'Titre',
      admin: { description: 'Obligatoire en français.' },
    },
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
    { name: 'lieu', type: 'text', localized: true, label: 'Lieu' },
    { name: 'description', type: 'richText', localized: true, label: 'Description' },
    {
      name: 'inscription',
      type: 'group',
      label: 'Inscription',
      fields: [
        { name: 'actif', type: 'checkbox', defaultValue: false, label: 'Inscription requise' },
        { name: 'lien', type: 'text', label: 'Lien d’inscription', validate: validerUrlEditoriale },
      ],
    },
    champTraduction,
  ],
}
