import type { Block } from 'payload'

import { validerUrlEditoriale } from '../lib/url'

export const Hero: Block = {
  slug: 'hero',
  labels: { singular: 'Bannière (hero)', plural: 'Bannières (hero)' },
  fields: [
    { name: 'titre', type: 'text', required: true, label: 'Titre' },
    { name: 'sousTitre', type: 'textarea', label: 'Sous-titre' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Image de fond' },
    {
      name: 'cta',
      type: 'group',
      label: 'Bouton d’appel à l’action',
      fields: [
        { name: 'label', type: 'text', label: 'Libellé' },
        { name: 'url', type: 'text', label: 'Lien', validate: validerUrlEditoriale },
      ],
    },
  ],
}
