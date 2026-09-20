import type { Block } from 'payload'

export const Galerie: Block = {
  slug: 'galerie',
  labels: { singular: 'Galerie', plural: 'Galeries' },
  fields: [
    {
      name: 'images',
      type: 'array',
      required: true,
      label: 'Images',
      labels: { singular: 'Image', plural: 'Images' },
      fields: [
        { name: 'media', type: 'upload', relationTo: 'media', required: true, label: 'Image' },
        { name: 'legende', type: 'text', label: 'Légende' },
      ],
    },
  ],
}
