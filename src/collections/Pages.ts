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
import { verifierCommuneCreation } from '../hooks/verifierCommuneCreation'
import { ROLES_REDACTION } from '../access/roles'
import {
  champTraduction,
  creerEnFrancais,
  exigerTraductionComplete,
  lectureAnonymeEnFrancais,
  requisEnFrancais,
} from '../lib/champs-langue'

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
    beforeOperation: [lectureAnonymeEnFrancais, memoriserModeBrouillon],
    beforeValidate: [creerEnFrancais, uniqueSlugParCommune('titre')],
    beforeChange: [
      verifierCommuneCreation(...ROLES_REDACTION),
      figerTenant,
      bloquerPublication,
      validerRelationsTenant(extraireRefsPages),
      exigerTraductionComplete(['titre', 'blocs']),
    ],
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
      // Localisé comme un champ entier (spec § 2) : jamais bloc par bloc.
      localized: true,
      validate: requisEnFrancais,
      blocks: BlocsPages,
      label: 'Contenu de la page',
      admin: { description: 'Obligatoire en français.' },
    },
    {
      name: 'metaTitle',
      type: 'text',
      localized: true,
      label: 'Titre SEO',
      admin: { description: 'Facultatif — titre de la page dans les moteurs de recherche.' },
    },
    {
      name: 'metaDescription',
      type: 'textarea',
      localized: true,
      label: 'Description SEO',
    },
    champTraduction,
  ],
}
