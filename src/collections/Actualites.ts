import type { CollectionConfig } from 'payload'

import { creerContenu, lirePublieOuAuthentifie, majContenu, supprimerContenu } from '../access'
import { figerTenant, uniqueSlugParCommune, validerRelationsTenant } from '../hooks'
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

/** I4 : image + auteur (affectation vérifiée, pas égalité fictive — I2). */
const extraireRefsActualite = (data: Record<string, unknown>) => ({
  media: data['image'] ? [data['image'] as string | number] : [],
  champMedia: 'image',
  auteur: (data['auteur'] as string | number | null | undefined) ?? null,
})

export const Actualites: CollectionConfig = {
  slug: 'actualites',
  labels: { singular: 'Actualité', plural: 'Actualités' },
  admin: {
    useAsTitle: 'titre',
    defaultColumns: ['titre', 'slug', '_status', 'datePublication', 'updatedAt'],
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
    // Voir Pages.ts : `draft` n'est lisible que depuis `beforeOperation`.
    beforeOperation: [lectureAnonymeEnFrancais, memoriserModeBrouillon],
    beforeValidate: [creerEnFrancais, uniqueSlugParCommune('titre')],
    beforeChange: [
      verifierCommuneCreation(...ROLES_REDACTION),
      figerTenant,
      bloquerPublication,
      validerRelationsTenant(extraireRefsActualite),
      exigerTraductionComplete(['titre', 'resume', 'contenu']),
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
    },
    {
      name: 'resume',
      type: 'textarea',
      localized: true,
      validate: requisEnFrancais,
      label: 'Résumé',
      admin: { description: 'Obligatoire en français.' },
    },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Image à la une' },
    {
      name: 'contenu',
      type: 'richText',
      localized: true,
      validate: requisEnFrancais,
      label: 'Contenu',
      admin: { description: 'Obligatoire en français.' },
    },
    {
      name: 'datePublication',
      type: 'date',
      label: 'Date de publication',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'auteur', type: 'relationship', relationTo: 'users', label: 'Auteur' },
    champTraduction,
  ],
}
