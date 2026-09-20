import type { Block } from 'payload'

import { validerUrlEditoriale } from '../lib/url'

export const Boutons: Block = {
  slug: 'boutons',
  labels: { singular: 'Boutons', plural: 'Boutons' },
  fields: [
    {
      name: 'boutons',
      type: 'array',
      required: true,
      label: 'Boutons',
      labels: { singular: 'Bouton', plural: 'Boutons' },
      fields: [
        { name: 'label', type: 'text', required: true, label: 'Libellé' },
        {
          name: 'url',
          type: 'text',
          required: true,
          label: 'Lien',
          validate: validerUrlEditoriale,
        },
        {
          name: 'variante',
          type: 'select',
          defaultValue: 'primaire',
          label: 'Variante',
          options: [
            { label: 'Primaire', value: 'primaire' },
            { label: 'Secondaire', value: 'secondaire' },
          ],
        },
      ],
    },
  ],
}
