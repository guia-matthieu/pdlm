import type { CollectionConfig } from 'payload'

import { creerPublication, lirePublic, majPublication, supprimerContenu } from '../access'
import { figerTenant } from '../hooks/figerTenant'
import { limiterTaille } from '../hooks/limiterTaille'

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
    create: creerPublication,
    update: majPublication,
    delete: supprimerContenu,
  },
  hooks: {
    // I5 : limite de taille (20 Mo) — vérifiée sur le fichier réel, pas le MIME déclaré
    beforeValidate: [limiterTaille(20)],
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
