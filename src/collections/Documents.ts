import type { CollectionConfig } from 'payload'

import { creerAdmin, lirePublic, majAdmin, supprimerContenu } from '../access'
import { figerTenant, limiterTaille } from '../hooks'
import { champTraduction, exigerTraductionComplete, requisEnFrancais } from '../lib/champs-langue'

/** I5 : PDF uniquement, 20 Mo max, type vérifié sur le contenu réel. */
export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'categorie', 'dateDocument', 'updatedAt'],
  },
  access: {
    read: lirePublic,
    create: creerAdmin,
    update: majAdmin,
    delete: supprimerContenu,
  },
  hooks: {
    beforeValidate: [limiterTaille(20)],
    beforeChange: [figerTenant, exigerTraductionComplete(['titre'])],
  },
  upload: {
    mimeTypes: ['application/pdf'],
    disableLocalStorage: true,
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
      name: 'categorie',
      type: 'select',
      required: true,
      defaultValue: 'autres',
      label: 'Catégorie',
      options: [
        { label: 'Délibérations', value: 'deliberations' },
        { label: 'Arrêtés', value: 'arretes' },
        { label: 'Budget', value: 'budget' },
        { label: 'Urbanisme', value: 'urbanisme' },
        { label: 'Autres', value: 'autres' },
      ],
    },
    {
      name: 'dateDocument',
      type: 'date',
      label: 'Date du document',
      admin: { date: { pickerAppearance: 'dayOnly' } },
    },
    {
      name: 'dureeConservation',
      type: 'text',
      label: 'Durée de conservation (mention RGPD)',
      admin: {
        description:
          'Ex. : « 5 ans » — information reprise dans la politique de confidentialité de la commune.',
      },
    },
    champTraduction,
  ],
}
