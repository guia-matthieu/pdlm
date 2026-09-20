import type { CollectionConfig } from 'payload'

import { lirePublieOuAuthentifie, creerContenu, majContenu, supprimerContenu } from '../access'
import { BlocsPages } from '../blocks'
import {
  figerTenant,
  refsMediaDesBlocs,
  uniqueSlugParCommune,
  validerRelationsTenant,
} from '../hooks'
import { bloquerPublication, memoriserModeBrouillon } from '../hooks/bloquerPublication'

/** I4 : références média exposées par les blocs d'une page. */
const extraireRefsPages = (data: Record<string, unknown>) => ({
  media: refsMediaDesBlocs(data['blocs']),
})

export const Pages: CollectionConfig = {
  slug: 'pages',
  labels: { singular: 'Page', plural: 'Pages' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'slug', '_status', 'updatedAt'],
  },
  access: {
    read: lirePublieOuAuthentifie,
    create: creerContenu,
    update: majContenu,
    delete: supprimerContenu,
  },
  versions: {
    drafts: {
      validate: true,
      autosave: true,
    },
  },
  hooks: {
    // `beforeOperation` est le seul point où l'argument `draft` est visible :
    // `bloquerPublication` en a besoin pour distinguer un brouillon d'une
    // écriture sur la version publique (I3).
    beforeOperation: [memoriserModeBrouillon],
    beforeValidate: [uniqueSlugParCommune('titre')],
    beforeChange: [figerTenant, bloquerPublication, validerRelationsTenant(extraireRefsPages)],
  },
  fields: [
    { name: 'titre', type: 'text', required: true, label: 'Titre' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug',
      admin: {
        description: 'Généré depuis le titre. Unicité garantie dans la commune.',
      },
    },
    {
      name: 'blocs',
      type: 'blocks',
      required: true,
      blocks: BlocsPages,
      label: 'Contenu de la page',
    },
    {
      name: 'metaTitle',
      type: 'text',
      label: 'Titre SEO',
      admin: { description: 'Facultatif — titre de la page dans les moteurs de recherche.' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      label: 'Description SEO',
    },
  ],
}
