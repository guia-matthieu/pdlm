import type { Commune, Domaine, User } from '../payload-types'

import { getPayloadClient } from '../lib/payload'

type Payload = Awaited<ReturnType<typeof getPayloadClient>>

/** Mot de passe des comptes de démonstration — développement uniquement. */
export const MOT_DE_PASSE_DEMO = 'demo1234'

if (process.env.NODE_ENV === 'production') {
  throw new Error('Le seed de démonstration est réservé au développement (NODE_ENV=production).')
}

async function upsertCommune(
  payload: Payload,
  data: { nom: string; slug: string },
): Promise<Commune> {
  const existantes = await payload.find({
    collection: 'communes',
    where: { slug: { equals: data.slug } },
    limit: 1,
    overrideAccess: true,
  })
  if (existantes.docs.length > 0) return existantes.docs[0]
  return payload.create({
    collection: 'communes',
    data: { ...data, actif: false }, // activée après création du domaine canonique (I6)
    overrideAccess: true,
  })
}

async function upsertDomaine(
  payload: Payload,
  data: { hostname: string; commune: number; canonique: boolean },
): Promise<Domaine> {
  const existants = await payload.find({
    collection: 'domaines',
    where: { hostname: { equals: data.hostname } },
    limit: 1,
    overrideAccess: true,
  })
  if (existants.docs.length > 0) return existants.docs[0]
  return payload.create({ collection: 'domaines', data, overrideAccess: true })
}

async function upsertUser(
  payload: Payload,
  data: {
    email: string
    name: string
    password: string
    role?: 'operateur'
    tenants?: Array<{ tenant: number; roles: ('admin' | 'redacteur')[] }>
  },
): Promise<User> {
  const existants = await payload.find({
    collection: 'users',
    where: { email: { equals: data.email } },
    limit: 1,
    overrideAccess: true,
  })
  if (existants.docs.length > 0) return existants.docs[0]
  return payload.create({ collection: 'users', data, overrideAccess: true })
}

async function seed() {
  const payload = await getPayloadClient()
  const { totalDocs: nbCommunes } = await payload.count({ collection: 'communes' })

  const saintEx = await upsertCommune(payload, { nom: 'Saint-Exupéry-les-Bains', slug: 'saint-ex' })
  const valvert = await upsertCommune(payload, { nom: 'Valvert', slug: 'valvert' })

  await upsertDomaine(payload, {
    hostname: 'saint-exupery-les-bains.fr',
    commune: saintEx.id,
    canonique: true,
  })
  await upsertDomaine(payload, {
    hostname: 'www.saint-exupery-les-bains.fr',
    commune: saintEx.id,
    canonique: false,
  })
  await upsertDomaine(payload, { hostname: 'valvert.fr', commune: valvert.id, canonique: true })
  await upsertDomaine(payload, {
    hostname: 'www.valvert.fr',
    commune: valvert.id,
    canonique: false,
  })

  // Activation après création des canoniques (I6)
  for (const commune of [saintEx, valvert]) {
    if (!commune.actif) {
      await payload.update({
        collection: 'communes',
        id: commune.id,
        data: { actif: true },
        overrideAccess: true,
      })
    }
  }

  await upsertUser(payload, {
    email: 'operateur@glm.dev',
    name: 'Opérateur (démo)',
    password: MOT_DE_PASSE_DEMO,
    role: 'operateur',
  })
  await upsertUser(payload, {
    email: 'admin@saint-ex.fr',
    name: 'Admin Saint-Exupéry (démo)',
    password: MOT_DE_PASSE_DEMO,
    tenants: [{ tenant: saintEx.id, roles: ['admin'] }],
  })
  await upsertUser(payload, {
    email: 'redacteur@saint-ex.fr',
    name: 'Rédacteur Saint-Exupéry (démo)',
    password: MOT_DE_PASSE_DEMO,
    tenants: [{ tenant: saintEx.id, roles: ['redacteur'] }],
  })

  payload.logger.info(
    nbCommunes > 0
      ? 'Seed : données de démonstration déjà présentes, complétées si besoin.'
      : 'Seed : communes Saint-Exupéry-les-Bains et Valvert créées avec leurs comptes de démonstration.',
  )
  payload.logger.info(
    `Comptes démo — operateur@glm.dev / admin@saint-ex.fr / redacteur@saint-ex.fr — mot de passe : ${MOT_DE_PASSE_DEMO}`,
  )
  process.exit(0)
}

// Top-level await : `payload run` attend la fin de l'évaluation du module —
// sans cela, le CLI sortirait avant la fin du seed.
try {
  await seed()
} catch (erreur) {
  console.error(erreur)
  process.exit(1)
}
