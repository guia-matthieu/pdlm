import type { Block } from 'payload'

export const Contact: Block = {
  slug: 'contact',
  labels: { singular: 'Bloc contact', plural: 'Blocs contact' },
  fields: [
    { name: 'titre', type: 'text', label: 'Titre' },
    { name: 'texte', type: 'textarea', label: 'Texte' },
  ],
}
