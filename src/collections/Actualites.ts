import type { CollectionConfig } from 'payload'

import { creerContenu, lirePublieOuAuthentifie, majContenu, supprimerContenu } from '../access'
import { figerTenant, uniqueSlugParCommune, validerRelationsTenant } from '../hooks'
import { bloquerPublication, memoriserModeBrouillon } from '../hooks/bloquerPublication'

/** I4 : image + auteur (affectation vérifiée, pas égalité fictive — I2). */
const extraireRefsActualite = (data: Record<string, unknown>) => ({
  media: data['image'] ? [data['image'] as string | number] : [],
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
    beforeOperation: [memoriserModeBrouillon],
    beforeValidate: [uniqueSlugParCommune('titre')],
    beforeChange: [figerTenant, bloquerPublication, validerRelationsTenant(extraireRefsActualite)],
  },
  fields: [
    { name: 'titre', type: 'text', required: true, label: 'Titre' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      index: true,
      label: 'Slug',
    },
    { name: 'resume', type: 'textarea', required: true, label: 'Résumé' },
    { name: 'image', type: 'upload', relationTo: 'media', label: 'Image à la une' },
    { name: 'contenu', type: 'richText', required: true, label: 'Contenu' },
    {
      name: 'datePublication',
      type: 'date',
      label: 'Date de publication',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    { name: 'auteur', type: 'relationship', relationTo: 'users', label: 'Auteur' },
  ],
}
