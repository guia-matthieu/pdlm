import type { Block } from 'payload'

export const Accordeon: Block = {
  slug: 'accordeon',
  labels: { singular: 'Accordéon', plural: 'Accordéons' },
  fields: [
    {
      name: 'elements',
      type: 'array',
      required: true,
      label: 'Éléments',
      labels: { singular: 'Élément', plural: 'Éléments' },
      fields: [
        { name: 'titre', type: 'text', required: true, label: 'Titre' },
        { name: 'contenu', type: 'richText', required: true, label: 'Contenu' },
      ],
    },
  ],
}
