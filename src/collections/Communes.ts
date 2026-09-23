import type { CollectionConfig } from 'payload'

import { communesAvecRole, isOperateur } from '../access/roles'
import { idDe } from '../access/roles'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'
import { slugifier } from '../hooks/formatSlug'
import { ignorerMesureNulle, journaliserMesure, preparerMesure } from '../hooks/mesureAudience'
import { validerRelationsTenant } from '../hooks/validerRelationsTenant'
import { validerUrlEditoriale } from '../lib/url'

/** Domaines réservés à la plateforme — un hostname communal ne peut pas les prendre (I6). */
export function hostnamesReserves(): string[] {
  const plateforme = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase()
  const stockage = new URL(process.env.NEXT_PUBLIC_S3_PUBLIC_URL ?? 'http://localhost:9000')
  const admin = process.env.ADMIN_URL ? new URL(process.env.ADMIN_URL) : null
  const liste = new Set<string>()
  if (plateforme) {
    liste.add(plateforme)
    liste.add(`www.${plateforme}`)
    liste.add(`admin.${plateforme}`)
  }
  liste.add(stockage.hostname)
  if (admin) liste.add(admin.hostname)
  // I6 élargi : l'interface Umami (stats.<plateforme>) n'est pas un domaine communal.
  if (process.env.UMAMI_PUBLIC_URL) liste.add(new URL(process.env.UMAMI_PUBLIC_URL).hostname)
  return [...liste]
}

/**
 * I8 : lecture réservée aux authentifiés (le plugin filtre par commune pour les
 * non-opérateurs) ; création/suppression opérateur seul ; un admin communal ne
 * modifie que sa commune. Le front public passe par la projection minimale de
 * `lib/contenu` (lectures internes).
 */
export const Communes: CollectionConfig = {
  slug: 'communes',
  labels: { singular: 'Commune', plural: 'Communes' },
  admin: {
    useAsTitle: 'nom',
    defaultColumns: ['nom', 'slug', 'actif'],
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) => {
      if (isOperateur(req.user)) return true
      const ids = communesAvecRole(req.user, 'admin')
      return ids.length > 0 ? { id: { in: ids } } : false
    },
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeOperation: [ignorerMesureNulle],
    beforeChange: [
      async ({ data, req, originalDoc }) => {
        // Slug toujours cohérent avec le nom (généré une fois, figé ensuite — I8)
        if (typeof data?.nom === 'string' && !data.slug) {
          data.slug = slugifier(data.nom)
        }
        // I6 : une commune active doit posséder un domaine canonique.
        // À la création, ni `originalDoc` ni `data.id` n'existent encore
        // (Postgres n'assigne l'id qu'après l'insert) — aucun domaine ne
        // peut de toute façon référencer une commune qui n'existe pas
        // encore, donc inutile d'interroger la base : 0 domaine canonique,
        // sans quoi la requête reçoit un id absent et Postgres répond une
        // erreur brute (« invalid input syntax for type integer: NaN »).
        if (data?.actif === true) {
          const communeId = originalDoc?.id ?? data.id
          const canoniques =
            communeId === undefined
              ? { totalDocs: 0 }
              : await req.payload.count({
                  collection: 'domaines',
                  where: {
                    and: [{ commune: { equals: communeId } }, { canonique: { equals: true } }],
                  },
                })
          if (canoniques.totalDocs === 0) {
            throw new Error(
              'Activation impossible : la commune doit posséder au moins un domaine canonique.',
            )
          }
        }
        return data
      },
      // I4 : le logo est un média de la commune elle-même. À la création, la
      // commune n'existe pas encore : aucun média ne peut lui appartenir.
      validerRelationsTenant(
        (data) => ({
          media: data['logo'] ? [data['logo'] as string | number] : [],
          champMedia: 'logo',
        }),
        ({ originalDoc }) => idDe(originalDoc) ?? null,
      ),
      preparerMesure,
    ],
    // Décision (f) : domaines.commune_id et users_tenants.tenant_id sont
    // NOT NULL avec une FK ON DELETE set null — supprimer une commune encore
    // rattachée fait donc échouer Postgres sur une violation NOT NULL brute.
    // Refus explicite, avant que la base n'ait à le faire.
    beforeDelete: [
      async ({ req, id }) => {
        const domaines = await req.payload.count({
          collection: 'domaines',
          where: { commune: { equals: id } },
          overrideAccess: true,
        })
        if (domaines.totalDocs > 0) {
          throw new Error(
            `Suppression impossible : ${domaines.totalDocs} domaine(s) sont encore rattaché(s) à cette commune. Retirez-les d’abord, ou désactivez la commune plutôt que de la supprimer.`,
          )
        }
        const comptes = await req.payload.count({
          collection: 'users',
          where: { 'tenants.tenant': { equals: id } },
          overrideAccess: true,
        })
        if (comptes.totalDocs > 0) {
          throw new Error(
            `Suppression impossible : ${comptes.totalDocs} compte(s) sont encore rattaché(s) à cette commune. Retirez-les d’abord, ou désactivez la commune plutôt que de la supprimer.`,
          )
        }
      },
    ],
    afterChange: [journaliser('commune'), journaliserMesure],
    afterDelete: [journaliserSuppression('commune')],
  },
  fields: [
    {
      name: 'nom',
      type: 'text',
      required: true,
      label: 'Nom de la commune',
      admin: { description: 'Ex. : Saint-Exupéry-les-Bains' },
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Slug',
      admin: {
        description:
          'Identifiant URL (sous-domaine de la plateforme = slug exact — choisir un slug court). Modifiable par l’opérateur uniquement.',
      },
      access: {
        // I8 : slug réservé à l'opérateur après création
        update: ({ req }) => isOperateur(req.user),
      },
    },
    {
      name: 'actif',
      type: 'checkbox',
      defaultValue: true,
      label: 'Commune active',
      admin: {
        description:
          'Désactiver met le site public en 404 sans supprimer les données (préféré à la suppression).',
      },
      access: {
        update: ({ req }) => isOperateur(req.user),
      },
    },
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo',
    },
    {
      name: 'coordonnees',
      type: 'group',
      label: 'Coordonnées',
      fields: [
        { name: 'adresse', type: 'textarea', label: 'Adresse' },
        { name: 'codePostal', type: 'text', label: 'Code postal' },
        { name: 'ville', type: 'text', label: 'Ville' },
        { name: 'telephone', type: 'text', label: 'Téléphone' },
        { name: 'email', type: 'email', label: 'Courriel' },
      ],
    },
    {
      name: 'horaires',
      type: 'textarea',
      label: 'Horaires d’ouverture',
      admin: { description: 'Horaires de la mairie (texte libre en v0.1).' },
    },
    {
      name: 'reseaux',
      type: 'group',
      label: 'Réseaux sociaux',
      // Ces valeurs partent telles quelles dans un `href` du pied de page :
      // sans validation, un `javascript:…` saisi ici s'exécuterait chez tous
      // les visiteurs du site communal (XSS stocké). Même règle que les liens
      // de menus et de boutons.
      fields: [
        { name: 'facebook', type: 'text', label: 'Facebook (URL)', validate: validerUrlEditoriale },
        {
          name: 'instagram',
          type: 'text',
          label: 'Instagram (URL)',
          validate: validerUrlEditoriale,
        },
        { name: 'youtube', type: 'text', label: 'YouTube (URL)', validate: validerUrlEditoriale },
      ],
    },
    {
      name: 'apparence',
      type: 'group',
      label: 'Apparence du site public',
      fields: [
        {
          name: 'couleurPrincipale',
          type: 'text',
          // Même défaut que styles.css (:root) — jamais le bleu France, réservé à l'État
          defaultValue: '#264653',
          label: 'Couleur principale (hex)',
          validate: (v: string | null | undefined) =>
            !v || /^#[0-9a-fA-F]{6}$/.test(v) || 'Format attendu : #RRGGBB',
          admin: {
            description:
              'Contraste RGAA : vérifier un rapport suffisant avec le texte blanc (voir README).',
          },
        },
        {
          name: 'couleurAccent',
          type: 'text',
          label: 'Couleur d’accent (hex)',
          validate: (v: string | null | undefined) =>
            !v || /^#[0-9a-fA-F]{6}$/.test(v) || 'Format attendu : #RRGGBB',
        },
      ],
    },
    {
      name: 'mesure',
      type: 'group',
      label: 'Mesure d’audience',
      admin: {
        description:
          'Sans cookie ni bandeau, dans l’exemption de la CNIL. Page d’information publique : /mesure-d-audience.',
      },
      fields: [
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: false,
          label: 'Mesurer l’audience du site public',
          admin: {
            // Lu au démarrage du serveur : sans UMAMI_URL, la fonction n'existe pas.
            readOnly: !process.env.UMAMI_URL,
            description: process.env.UMAMI_URL
              ? 'Couper n’efface rien : l’historique reste jusqu’à sa purge à 25 mois.'
              : 'Mesure d’audience non installée sur cette plateforme',
          },
        },
        {
          name: 'siteUmami',
          type: 'text',
          label: 'Identifiant du site de mesure',
          admin: { readOnly: true },
        },
        {
          name: 'lienPartage',
          type: 'text',
          label: 'Lien de partage',
          admin: {
            readOnly: true,
            description: 'À transmettre au maire : vue d’ensemble, sans le détail des visites',
          },
        },
      ],
    },
  ],
}
