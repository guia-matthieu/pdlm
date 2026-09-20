import type { Block } from 'payload'

export const Image: Block = {
  slug: 'image',
  labels: { singular: 'Image', plural: 'Images' },
  fields: [
    { name: 'media', type: 'upload', relationTo: 'media', required: true, label: 'Image' },
    { name: 'legende', type: 'text', label: 'Légende' },
    {
      name: 'largeur',
      type: 'select',
      defaultValue: 'large',
      label: 'Largeur d’affichage',
      options: [
        { label: 'Pleine largeur', value: 'pleine' },
        { label: 'Large', value: 'large' },
      ],
    },
  ],
}
