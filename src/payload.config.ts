import { postgresAdapter } from '@payloadcms/db-postgres'
import { multiTenantPlugin } from '@payloadcms/plugin-multi-tenant'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { fr } from '@payloadcms/translations/languages/fr'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Communes } from './collections/Communes'
import { Domaines } from './collections/Domaines'
import { Journal } from './collections/Journal'
import { Users } from './collections/Users'
import { Organisations } from './collections/Organisations'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Actualites } from './collections/Actualites'
import { Evenements } from './collections/Evenements'
import { Documents } from './collections/Documents'
import { Alertes } from './collections/Alertes'
import { Menus } from './collections/Menus'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

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
