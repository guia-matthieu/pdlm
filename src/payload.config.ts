import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'path'
import type { Access, Plugin } from 'payload'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { communesAvecRole, isOperateur } from './access/roles'
import { Communes } from './collections/Communes'
import { Domaines } from './collections/Domaines'
import { Journal } from './collections/Journal'
import { Users } from './collections/Users'
import { Organisations } from './collections/Organisations'
import { Mandats } from './collections/Mandats'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Actualites } from './collections/Actualites'
import { Evenements } from './collections/Evenements'
import { Documents } from './collections/Documents'
import { Alertes } from './collections/Alertes'
import { Menus } from './collections/Menus'
import { FRANCAIS, LANGUES } from './lib/langues'
import { languesDisponiblesAdmin } from './lib/langues-admin'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

/**
 * Décision 16 : historique des communes, posé APRÈS multiTenantPlugin. Le plugin
 * enveloppe `readVersions` de la collection tenants avec la contrainte
 * `version.id in [communes de l'utilisateur]`, qui sur `_communes_v` désigne
 * l'id de ligne de version et non la commune parente : un admin lisait 0 version
 * de sa propre commune (mesure : docs/qc/bloque-tache-02.md), et poser la règle
 * dans la collection ne suffit pas — le plugin la combine par ET avec sa
 * contrainte fautive. On remplace donc l'accès enveloppé. Même grain que
 * `update` : rédacteur et mandataire (D2) ne lisent pas l'historique.
 */
const lireVersionsCommune: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  return ids.length > 0 ? { parent: { in: ids } } : false
}

const historiqueCommunes: Plugin = (config) => {
  const communes = config.collections.find((c) => c.slug === 'communes')
  if (communes) {
    communes.access = { ...communes.access, readVersions: lireVersionsCommune }
  }
  return config
}

/** I7 : CORS/CSRF limités à l'origine admin (+ localhost en dev seulement). */
const DEV = process.env.NODE_ENV !== 'production'
const originesAutorisees = [
  process.env.ADMIN_URL,
  ...(DEV ? ['http://localhost:3000'] : []),
].filter((origine): origine is string => Boolean(origine))

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    Communes,
    Domaines,
    Journal,
    Users,
    Organisations,
    Mandats,
    Media,
    Pages,
    Actualites,
    Evenements,
    Documents,
    Alertes,
    Menus,
  ],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  // Admin entièrement en français
  i18n: {
    supportedLanguages: { fr },
    fallbackLanguage: 'fr',
  },
  // Langues du CONTENU (spec multilingue § 1). L'admin, elle, reste en français (i18n ci-dessus).
  localization: {
    locales: LANGUES.map((l) => ({ code: l.code, label: l.nom })),
    defaultLocale: FRANCAIS,
    fallback: true,
    filterAvailableLocales: languesDisponiblesAdmin,
  },
  // I13 : GraphQL désactivé en v0.1 (non utilisé — sinon : tester ses mutations au même titre que REST)
  graphQL: {
    disable: true,
  },
  cors: originesAutorisees,
  csrf: originesAutorisees,
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI || '',
    },
  }),
  sharp,
  plugins: [
    multiTenantPlugin({
      tenantsSlug: 'communes',
      // Users.access.read (src/collections/Users.ts) applique déjà D3 ; le filtre du
      // plugin masquerait le propre compte d'un mandataire (sa ligne est calculée,
      // non stockée, donc absente de `tenants.tenant` en base).
      useUsersTenantFilter: false,
      userHasAccessToAllTenants: (user) => user?.role === 'operateur',
      collections: {
        media: { tenantFieldOverrides: { label: 'Commune' } },
        pages: { tenantFieldOverrides: { label: 'Commune' } },
        actualites: { tenantFieldOverrides: { label: 'Commune' } },
        evenements: { tenantFieldOverrides: { label: 'Commune' } },
        documents: { tenantFieldOverrides: { label: 'Commune' } },
        alertes: { tenantFieldOverrides: { label: 'Commune' } },
        menus: { isGlobal: true },
      },
      tenantsArrayField: {
        rowFields: [
          {
            name: 'roles',
            type: 'select',
            hasMany: true,
            defaultValue: ['redacteur'],
            admin: {
              description:
                'Les lignes « Mandataire » sont calculées depuis la collection Mandats : elles ne sont jamais enregistrées, les modifier ou les retirer ici n’a aucun effet.',
            },
            options: [
              { label: 'Administrateur', value: 'admin' },
              { label: 'Rédacteur', value: 'redacteur' },
              {
                // Jamais enregistré : calculé depuis les mandats actifs (hooks/lignesMandat.ts).
                label: 'Mandataire (par mandat)',
                value: 'mandataire',
              },
            ],
          },
        ],
      },
    }),
    // Décision 16 : APRÈS multiTenantPlugin, pour remplacer son readVersions dégénéré.
    historiqueCommunes,
    ...(process.env.S3_ENABLED === 'true'
      ? [
          s3Storage({
            bucket: process.env.S3_BUCKET ?? 'pdlm',
            collections: {
              media: { prefix: 'media' },
              documents: { prefix: 'documents' },
            },
            config: {
              region: process.env.S3_REGION ?? 'fr-1',
              endpoint: process.env.S3_ENDPOINT,
              forcePathStyle: true,
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
              },
            },
          }),
        ]
      : []),
  ],
})
