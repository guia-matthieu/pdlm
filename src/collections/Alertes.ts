import type { CollectionConfig } from 'payload'

import { creerPublication, lirePublic, majPublication, supprimerContenu } from '../access'
import { figerTenant } from '../hooks'

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
    create: creerPublication,
    update: majPublication,
    delete: supprimerContenu,
  },
  hooks: {
    beforeChange: [figerTenant],
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
    { name: 'message', type: 'textarea', required: true, label: 'Message' },
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
  ],
}
