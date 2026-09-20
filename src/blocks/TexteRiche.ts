import type { Block } from 'payload'

export const TexteRiche: Block = {
  slug: 'texteRiche',
  labels: { singular: 'Texte riche', plural: 'Textes riches' },
  fields: [
    {
      name: 'contenu',
      type: 'richText',
      required: true,
      label: 'Contenu',
    },
  ],
}
