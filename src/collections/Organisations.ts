import { APIError, type CollectionConfig } from 'payload'

import { isOperateur } from '../access/roles'
import { normaliserSiret, validerSiret } from '../lib/siret'

/**
 * Spec RPNT section 8 — organisation qui agit pour le compte d'une ou de
 * plusieurs communes (services d'un EPCI, d'une ville, prestataire). Tenue par
 * l'opérateur ; lisible par tout compte authentifié, pour que l'admin d'une
 * commune choisisse à qui il accorde un mandat (nom et SIRET sont publics).
 */
export const Organisations: CollectionConfig = {
  slug: 'organisations',
  labels: { singular: 'Organisation', plural: 'Organisations' },
  admin: { useAsTitle: 'nom', defaultColumns: ['nom', 'nature', 'siret'] },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) => isOperateur(req.user),
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.siret === 'string') data.siret = normaliserSiret(data.siret)
        return data
      },
    ],
    // Même règle que la décision (f) : refuser avant que Postgres ne le fasse.
    beforeDelete: [
      async ({ req, id }) => {
        const comptes = await req.payload.count({
          collection: 'users',
          where: { organisation: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (comptes.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${comptes.totalDocs} compte(s) sont encore rattaché(s) à cette organisation.`,
            400,
            null,
            true,
          )
        }
        const mandats = await req.payload.count({
          collection: 'mandats',
          where: { organisation: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (mandats.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${mandats.totalDocs} mandat(s) sont encore rattaché(s) à cette organisation.`,
            400,
            null,
            true,
          )
        }
      },
    ],
  },
  fields: [
    { name: 'nom', type: 'text', required: true, label: 'Nom' },
    {
      name: 'nature',
      type: 'select',
      required: true,
      label: 'Nature',
      options: [
        { label: 'EPCI (intercommunalité)', value: 'epci' },
        { label: 'Commune', value: 'commune' },
        { label: 'Prestataire', value: 'prestataire' },
        { label: 'Opérateur public de services numériques (OPSN)', value: 'opsn' },
        { label: 'Autre', value: 'autre' },
      ],
    },
    {
      name: 'siret',
      type: 'text',
      required: true,
      unique: true,
      label: 'SIRET',
      validate: validerSiret,
    },
  ],
}
