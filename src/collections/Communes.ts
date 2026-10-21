import { APIError, type CollectionBeforeChangeHook, type CollectionConfig } from 'payload'

import { ValidationError } from 'payload'

import { aRoleSur, communesAvecRole, idDe, isOperateur } from '../access/roles'
import { effacerHistoriqueMesure } from '../endpoints/effacerHistoriqueMesure'
import { journaliser, journaliserSuppression } from '../hooks/journaliser'
import { slugifier } from '../hooks/formatSlug'
import {
  ignorerMesureNulle,
  journaliserMesure,
  preparerMesure,
  supprimerSiteMesure,
} from '../hooks/mesureAudience'
import { validerRelationsTenant } from '../hooks/validerRelationsTenant'
import {
  DEMARCHES_DEFAUT,
  LIBELLES_PICTOS,
  LIBELLES_SCENES,
  MOSAIQUE_DEFAUT,
  PICTOS,
  SCENES,
} from '../lib/accueil-defauts'
import { creerEnFrancais, lectureAnonymeEnFrancais, requisEnFrancais } from '../lib/champs-langue'
import { FRANCAIS, LANGUES_REGIONALES, nomLangueMinuscule } from '../lib/langues'
import { validerUrlEditoriale } from '../lib/url'

/** I24 : la seule validation d'une couleur est sa forme — une couleur illisible passe. */
const validerCouleur = (v: string | null | undefined) =>
  !v || /^#[0-9a-fA-F]{6}$/.test(v) || 'Format attendu : #RRGGBB'

/**
 * RPNT § 1 : code INSEE du Code officiel géographique — 5 chiffres, ou 2A/2B
 * suivis de 3 chiffres pour la Corse. Facultatif : il n'entrave jamais l'activation.
 */
const validerCodeInsee = (v: string | null | undefined) =>
  !v ||
  /^(?:\d{5}|2[ABab]\d{3})$/.test(v) ||
  'Code INSEE attendu : 5 chiffres, ou 2A/2B suivis de 3 chiffres (Quimper : 29232, Ajaccio : 2A004)'

/**
 * Clés des lignes d'une liste de l'accueil (démarches, tuiles). Une ligne sans
 * identifiant est une ligne nouvelle. Modèle : `clesLignes` de `Menus`.
 */
function clesLignesAccueil(lignes: unknown): Array<string | null> {
  if (!Array.isArray(lignes)) return []
  return (lignes as Array<Record<string, unknown> | null>).map((l) =>
    typeof l?.['id'] === 'string' && l['id'] !== '' ? l['id'] : null,
  )
}

/**
 * R4 (décision 14) : les lignes de l'accueil (démarches, mosaïque) sont
 * communes à toutes les langues. Hors du français, on ne traduit que les
 * titres et libellés : ajouter, retirer ou déplacer une ligne changerait
 * l'accueil français, qui y garderait une ligne sans titre.
 */
const structureAccueilEnFrancais: CollectionBeforeChangeHook = ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || (req.locale ?? FRANCAIS) === FRANCAIS) return data
  if (!data || !('accueil' in data)) return data
  const envoye = data['accueil'] as Record<string, unknown>
  const existant = (originalDoc?.['accueil'] as Record<string, unknown> | undefined) ?? {}
  for (const liste of ['demarches', 'mosaique'] as const) {
    if (!(liste in envoye)) continue
    // Liste ordonnée : l'ordre des lignes est lui aussi partagé par les langues.
    const avant = clesLignesAccueil(existant[liste])
    const apres = clesLignesAccueil(envoye[liste])
    const identique =
      avant.length === apres.length && apres.every((cle, i) => cle !== null && cle === avant[i])
    if (!identique) {
      throw new ValidationError({
        errors: [
          {
            path: `accueil.${liste}`,
            message:
              'Les lignes de l’accueil (ajout, retrait ou changement d’ordre) se modifient en français. Dans cette langue, traduisez seulement les titres.',
          },
        ],
      })
    }
  }
  return data
}

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
  endpoints: [effacerHistoriqueMesure],
  // Versions sans brouillons (spec § 1) : l'historique couvre toute la fiche,
  // y compris l'apparence et l'accueil — restaurable depuis l'admin.
  versions: { maxPerDoc: 20 },
  hooks: {
    beforeOperation: [lectureAnonymeEnFrancais, ignorerMesureNulle],
    beforeValidate: [creerEnFrancais],
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
                    and: [
                      { commune: { equals: communeId } },
                      { canonique: { equals: true } },
                      { langue: { equals: FRANCAIS } },
                    ],
                  },
                })
          if (canoniques.totalDocs === 0) {
            throw new ValidationError({
              errors: [
                {
                  path: 'actif',
                  message:
                    'Activation impossible : la commune doit posséder un domaine canonique en français.',
                },
              ],
            })
          }
        }

        // I15 : pas de désactivation d'une langue qu'un domaine sert à sa racine.
        if (originalDoc?.id && Array.isArray(data?.langues)) {
          const retirees = ((originalDoc.langues as string[] | null) ?? []).filter(
            (l) => !(data.langues as string[]).includes(l),
          )
          if (retirees.length > 0) {
            const servis = await req.payload.find({
              collection: 'domaines',
              where: {
                and: [{ commune: { equals: originalDoc.id } }, { langue: { in: retirees } }],
              },
              limit: 1,
              overrideAccess: true,
              req,
            })
            const d = servis.docs[0]
            if (d) {
              throw new ValidationError({
                errors: [
                  {
                    path: 'langues',
                    message: `Le ${nomLangueMinuscule(d.langue)} est servi à la racine de ${d.hostname}. Changez d’abord la langue de ce domaine.`,
                  },
                ],
              })
            }
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
      structureAccueilEnFrancais,
      // I4 : la photo d'accueil et les photos de la mosaïque sont des médias de
      // la commune elle-même (même règle que le logo).
      validerRelationsTenant(
        (data) => {
          const photo = (data['apparence'] as Record<string, unknown> | undefined)?.['photoAccueil']
          return {
            media: photo ? [photo as string | number] : [],
            champMedia: 'apparence.photoAccueil',
          }
        },
        ({ originalDoc }) => idDe(originalDoc) ?? null,
      ),
      validerRelationsTenant(
        (data) => {
          const lignes = ((data['accueil'] as Record<string, unknown> | undefined)?.['mosaique'] ??
            []) as Array<Record<string, unknown>>
          return {
            media: lignes.flatMap((l) => (l?.['photo'] ? [l['photo'] as string | number] : [])),
            champMedia: 'accueil.mosaique',
          }
        },
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
          req,
        })
        if (domaines.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${domaines.totalDocs} domaine(s) sont encore rattaché(s) à cette commune. Retirez-les d’abord, ou désactivez la commune plutôt que de la supprimer.`,
            400,
            null,
            true,
          )
        }
        const comptes = await req.payload.count({
          collection: 'users',
          where: { 'tenants.tenant': { equals: id } },
          overrideAccess: true,
          req,
        })
        if (comptes.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${comptes.totalDocs} compte(s) sont encore rattaché(s) à cette commune. Retirez-les d’abord, ou désactivez la commune plutôt que de la supprimer.`,
            400,
            null,
            true,
          )
        }
        const mandats = await req.payload.count({
          collection: 'mandats',
          where: { commune: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (mandats.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${mandats.totalDocs} mandat(s) sont encore rattaché(s) à cette commune. Demandez à l’opérateur de les supprimer, ou désactivez la commune plutôt que de la supprimer.`,
            400,
            null,
            true,
          )
        }
      },
    ],
    afterChange: [journaliser('commune'), journaliserMesure],
    // Umami en dernier : s'il refuse, tout est annulé, journal compris ; si le
    // journal échoue, Umami n'est jamais appelé.
    afterDelete: [journaliserSuppression('commune'), supprimerSiteMesure],
  },
  fields: [
    {
      name: 'nom',
      type: 'text',
      localized: true,
      validate: requisEnFrancais,
      label: 'Nom de la commune',
      admin: { description: 'Obligatoire en français. Ex. : Saint-Exupéry-les-Bains' },
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
      name: 'langues',
      type: 'select',
      hasMany: true,
      label: 'Langues du site',
      options: LANGUES_REGIONALES.map((l) => ({ label: l.nom, value: l.code })),
      admin: {
        description:
          'Le français est toujours actif. Une langue cochée ici apparaît dans le sélecteur du site ; ses pages ne sont montrées que traduites et validées.',
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
      // RPNT § 1 : facultatif, unique quand il est rempli. L'accès `update` de
      // la collection (opérateur + admin de la commune) suffit à écarter
      // rédacteur et mandataire : pas d'access au niveau du champ.
      name: 'codeInsee',
      type: 'text',
      label: 'Code INSEE',
      unique: true,
      index: true,
      validate: validerCodeInsee,
      admin: {
        description:
          'Code INSEE du Code officiel géographique, pas le code postal (Quimper : 29232, pas 29000). À chercher sur l’API Découpage administratif : https://geo.api.gouv.fr/communes?nom=<nom>&fields=nom,code,codesPostaux (champ « code »). pdlm ne fait aucun appel ni téléchargement pour ce champ.',
      },
    },
    {
      name: 'horaires',
      type: 'textarea',
      localized: true,
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
      type: 'tabs',
      tabs: [
        {
          // Onglet sans `name` (décision 11) : `apparence` et `accueil`
          // restent des clés de premier niveau de la fiche commune.
          label: 'Apparence',
          fields: [
            {
              name: 'apparence',
              type: 'group',
              label: 'Apparence du site public',
              fields: [
                {
                  name: 'gabarit',
                  type: 'select',
                  defaultValue: 'village',
                  label: 'Gabarit',
                  options: [
                    { label: 'Village', value: 'village' },
                    { label: 'Littoral', value: 'littoral' },
                  ],
                  access: {
                    // Décision 15 : le gabarit reste à l'opérateur seul.
                    update: ({ req }) => isOperateur(req.user),
                  },
                  admin: { description: 'Composition de l’accueil du site public.' },
                },
                {
                  // Aperçu en direct de la frise, au-dessus des pièces.
                  // Champ `ui` : aucune donnée, aucune migration (tâche 7).
                  name: 'friseApercu',
                  type: 'ui',
                  admin: {
                    components: { Field: '/components/admin/FriseApercu#FriseApercu' },
                  },
                },
                {
                  name: 'frise',
                  type: 'array',
                  label: 'Frise du territoire',
                  labels: { singular: 'Pièce de frise', plural: 'Pièces de frise' },
                  access: {
                    // Décision 15 : la frise reste à l'opérateur seul.
                    update: ({ req }) => isOperateur(req.user),
                  },
                  admin: {
                    description:
                      'L’ordre des lignes est l’ordre de gauche à droite. Frise vide = pas de frise.',
                  },
                  fields: [
                    // `piece` en texte libre (pas un select) : un select Postgres
                    // imposerait une migration par kit, contraire à I26.
                    // L'appartenance au kit se vérifie au rendu.
                    { name: 'piece', type: 'text', required: true, label: 'Pièce' },
                    {
                      name: 'taille',
                      type: 'select',
                      defaultValue: 'moyenne',
                      label: 'Taille',
                      options: [
                        { label: 'Petite', value: 'petite' },
                        { label: 'Moyenne', value: 'moyenne' },
                        { label: 'Grande', value: 'grande' },
                      ],
                    },
                    { name: 'ecart', type: 'number', min: 0, label: 'Écart (px)' },
                  ],
                },
                {
                  // Aperçu en direct du site public, au-dessus des couleurs
                  // choisies. Champ `ui` : aucune donnée, aucune migration.
                  name: 'apercuApparence',
                  type: 'ui',
                  admin: {
                    components: { Field: '/components/admin/ApparenceApercu#ApparenceApercu' },
                  },
                },
                {
                  name: 'couleurPrincipale',
                  type: 'text',
                  label: 'Couleur principale (hex)',
                  validate: validerCouleur,
                },
                {
                  name: 'couleurAccent',
                  type: 'text',
                  label: 'Couleur d’accent (hex)',
                  validate: validerCouleur,
                },
                {
                  name: 'couleurTerre',
                  type: 'text',
                  label: 'Couleur de terre (hex)',
                  validate: validerCouleur,
                },
                {
                  type: 'collapsible',
                  label: 'Réglages avancés',
                  admin: { initCollapsed: true },
                  fields: [
                    {
                      name: 'couleursForcees',
                      type: 'group',
                      label: 'Couleurs forcées',
                      admin: {
                        description:
                          'Vide = couleur dérivée des trois choisies. Une couleur forcée est utilisée telle quelle (I24) : le contraste est sous votre responsabilité.',
                      },
                      fields: [
                        { name: 'texte', type: 'text', label: 'Texte', validate: validerCouleur },
                        {
                          name: 'pale',
                          type: 'text',
                          label: 'Fond pâle',
                          validate: validerCouleur,
                        },
                        {
                          name: 'profond',
                          type: 'text',
                          label: 'Fond profond',
                          validate: validerCouleur,
                        },
                        ...([1, 2, 3, 4, 5, 6] as const).map((n) => ({
                          name: `picto${n}`,
                          type: 'text' as const,
                          label: `Pictogramme ${n}`,
                          validate: validerCouleur,
                        })),
                      ],
                    },
                  ],
                },
                {
                  name: 'photoAccueil',
                  type: 'upload',
                  relationTo: 'media',
                  label: 'Photo d’accueil',
                  admin: {
                    description:
                      'Photo du héros du site public ; le texte alternatif est celui du média.',
                  },
                },
              ],
            },
            {
              name: 'accueil',
              type: 'group',
              label: 'Accueil',
              fields: [
                {
                  name: 'demarches',
                  type: 'array',
                  maxRows: 8,
                  defaultValue: DEMARCHES_DEFAUT,
                  label: 'Démarches',
                  labels: { singular: 'Démarche', plural: 'Démarches' },
                  admin: {
                    description:
                      'Préremplies à la création (spec § 1). Sans lien, une démarche n’est pas cliquable.',
                  },
                  fields: [
                    {
                      name: 'picto',
                      type: 'select',
                      label: 'Pictogramme',
                      options: PICTOS.map((picto) => ({
                        value: picto,
                        label: LIBELLES_PICTOS[picto],
                      })),
                    },
                    // Seul le titre change d'une langue à l'autre : les lignes du
                    // tableau (picto, lien) ne se modifient qu'en français (R4).
                    {
                      name: 'titre',
                      type: 'text',
                      localized: true,
                      validate: requisEnFrancais,
                      label: 'Titre',
                      admin: { description: 'Obligatoire en français.' },
                    },
                    // Traduisible, facultatif dans toutes les langues
                    // (décision 14) — pas de `requisEnFrancais`.
                    { name: 'precision', type: 'text', localized: true, label: 'Précision' },
                    {
                      name: 'lien',
                      type: 'text',
                      label: 'Lien',
                      validate: validerUrlEditoriale,
                    },
                  ],
                },
                {
                  name: 'mosaique',
                  type: 'array',
                  maxRows: 4,
                  defaultValue: MOSAIQUE_DEFAUT,
                  label: 'Mosaïque',
                  labels: { singular: 'Tuile', plural: 'Tuiles' },
                  admin: {
                    description:
                      'Sans photo, la tuile affiche l’illustration du kit (I30). Sans lien, elle n’est pas cliquable.',
                  },
                  fields: [
                    // Seul le libellé change d'une langue à l'autre (R4).
                    {
                      name: 'libelle',
                      type: 'text',
                      localized: true,
                      validate: requisEnFrancais,
                      label: 'Libellé',
                      admin: { description: 'Obligatoire en français.' },
                    },
                    {
                      name: 'lien',
                      type: 'text',
                      label: 'Lien',
                      validate: validerUrlEditoriale,
                    },
                    {
                      name: 'photo',
                      type: 'upload',
                      relationTo: 'media',
                      label: 'Photo',
                    },
                    {
                      name: 'illustration',
                      type: 'select',
                      required: true,
                      label: 'Illustration',
                      options: SCENES.map((scene) => ({
                        value: scene,
                        label: LIBELLES_SCENES[scene],
                      })),
                    },
                  ],
                },
              ],
            },
          ],
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
        {
          name: 'effacerHistorique',
          type: 'ui',
          admin: {
            // Montré seulement à qui peut effacer (le point d'accès revérifie).
            condition: (data, siblingData, { user }) =>
              Boolean(siblingData?.siteUmami) &&
              (isOperateur(user) || aRoleSur(user, data?.id, 'admin')),
            components: { Field: '/components/admin/EffacerHistorique#EffacerHistorique' },
          },
        },
      ],
    },
  ],
}
