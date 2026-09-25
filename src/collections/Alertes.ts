import type { CollectionConfig } from 'payload'

import { creerAdmin, lirePublic, majAdmin, supprimerContenu } from '../access'
import { figerTenant } from '../hooks'
import {
  champTraduction,
  creerEnFrancais,
  exigerTraductionComplete,
  lectureAnonymeEnFrancais,
  requisEnFrancais,
} from '../lib/champs-langue'

/** I3/D9 : sans workflow — écritures admin/opérateur ; fenêtre d'activité filtrée à l'affichage. */
export const Alertes: CollectionConfig = {
  slug: 'alertes',
  labels: { singular: 'Alerte', plural: 'Alertes' },
  admin: {
    useAsTitle: 'message',
    defaultColumns: ['niveau', 'dateDebut', 'dateFin', 'updatedAt'],
  },
  access: {
    read: lirePublic,
    create: creerAdmin,
    update: majAdmin,
    delete: supprimerContenu,
  },
  hooks: {
    beforeOperation: [lectureAnonymeEnFrancais],
    beforeValidate: [creerEnFrancais],
    beforeChange: [figerTenant, exigerTraductionComplete(['message'])],
  },
  fields: [
    {
      name: 'niveau',
      type: 'select',
      required: true,
      label: 'Niveau',
      options: [
        { label: 'Information', value: 'info' },
        { label: 'Vigilance', value: 'vigilance' },
        { label: 'Urgence', value: 'urgence' },
      ],
    },
    {
      name: 'message',
      type: 'textarea',
      localized: true,
      validate: requisEnFrancais,
      label: 'Message',
      admin: { description: 'Obligatoire en français.' },
    },
    {
      name: 'dateDebut',
      type: 'date',
      required: true,
      label: 'Début d’affichage',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'dateFin',
      type: 'date',
      required: true,
      label: 'Fin d’affichage (dépublication automatique)',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    champTraduction,
  ],
}
