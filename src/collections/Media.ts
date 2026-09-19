import type { CollectionConfig } from 'payload'

import { creerAdmin, lirePublic, majAdmin, supprimerContenu } from '../access'
import { figerTenant } from '../hooks/figerTenant'

/**
 * I5 : médias = images uniquement (pas de SVG — risque XSS), limite 20 Mo,
 * fichiers publics dès téléversement (décision assumée v0.1, cf. README).
 * Écritures réservées admin/opérateur (I3 — pas de workflow).
 */
export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Média', plural: 'Médias' },
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'updatedAt'],
  },
  access: {
    read: lirePublic,
    create: creerAdmin,
    update: majAdmin,
    delete: supprimerContenu,
  },
  hooks: {
    beforeValidate: [
      // I5 : limite de taille (20 Mo) — vérifiée sur le fichier réel, pas le MIME déclaré
      ({ req }) => {
        const fichier = (req as { file?: { size?: number } }).file
        if (fichier?.size && fichier.size > 20 * 1024 * 1024) {
          throw new Error('Fichier trop volumineux : la limite est de 20 Mo.')
        }
      },
    ],
    beforeChange: [figerTenant],
  },
  upload: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    imageSizes: [
      { name: 'thumbnail', width: 400, height: 300, position: 'centre' },
      { name: 'card', width: 800, height: 1000, position: 'centre' },
      { name: 'hero', width: 1600, height: 900, position: 'centre' },
    ],
    adminThumbnail: 'thumbnail',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      label: 'Texte alternatif',
      admin: { description: 'Obligatoire pour l’accessibilité (RGAA).' },
    },
  ],
}
