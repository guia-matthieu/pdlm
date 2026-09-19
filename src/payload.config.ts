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
import { Media } from './collections/Media'
import { Users } from './collections/Users'

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
  collections: [Communes, Domaines, Journal, Users, Media],
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
        // J4 : pages, actualites, evenements, documents, alertes, menus (isGlobal)
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
            ],
          },
        ],
      },
    }),
    ...(process.env.S3_ENABLED === 'true'
      ? [
          s3Storage({
            bucket: process.env.S3_BUCKET ?? 'glm',
            collections: {
              media: { prefix: 'media' },
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
