import type { Commune, Domaine, User } from '../payload-types'

import { FRANCAIS } from '../lib/langues'
import { getPayloadClient } from '../lib/payload'
import { seedContenuDemo } from './contenu-demo'
import { erreursEnvironnementDemo, estHostnameDemo, type EnvDemo } from './garde-fous-demo'

type Payload = Awaited<ReturnType<typeof getPayloadClient>>

/** Apparence choisie par la commune : gabarit et couleurs (src/collections/Communes.ts). */
interface ApparenceDemo {
  gabarit: 'village' | 'littoral'
  couleurPrincipale?: string
  couleurAccent?: string
  couleurTerre?: string
}

interface CommuneDemo {
  nom: string
  slug: string
  apparence: ApparenceDemo
}

/** Les deux communes fictives de la démo (brief 2026-10-25, partie A). */
const COMMUNES_DEMO: CommuneDemo[] = [
  {
    nom: 'Saint-Exupéry-les-Bains',
    slug: 'saint-ex',
    // Couleurs non saisies : le rendu applique les défauts de src/lib/couleurs.ts.
    apparence: { gabarit: 'village' },
  },
  {
    nom: 'Port-Lavanne',
    slug: 'port-lavanne',
    // Palette littoral éprouvée par les captures e2e
    // (tests/e2e/gabarits-captures.e2e.spec.ts, jeu #2a7f9e) : les deux gabarits
    // de la démo se distinguent aussi par la couleur.
    apparence: {
      gabarit: 'littoral',
      couleurPrincipale: '#2a7f9e',
      couleurAccent: '#f2b134',
      couleurTerre: '#d2462f',
    },
  },
]

/** Événements de l'agenda démo : dates recalculées à chaque exécution. */
const EVENEMENTS_DEMO = [
  { titre: 'Marché de printemps', dansJours: 5, dureeHeures: 6 },
  { titre: 'Conseil municipal (séance publique)', dansJours: 12, dureeHeures: 2 },
]

// Mêmes upserts idempotents que le seed de développement (src/seed/index.ts),
// réécrits ici : ce dernier ne peut pas être importé, il refuse NODE_ENV=production.
async function upsertCommune(payload: Payload, data: CommuneDemo): Promise<Commune> {
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
  data: {
    hostname: string
    commune: number
    canonique: boolean
    langue?: Domaine['langue']
  },
): Promise<Domaine> {
  const existants = await payload.find({
    collection: 'domaines',
    where: { hostname: { equals: data.hostname } },
    limit: 1,
    overrideAccess: true,
  })
  if (existants.docs.length > 0) return existants.docs[0]
  return payload.create({
    collection: 'domaines',
    data: { langue: FRANCAIS, ...data },
    overrideAccess: true,
  })
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

/** Commune, domaine canonique <slug>.<DEMO_DOMAIN>, activation (I6). */
async function assurerCommune(
  payload: Payload,
  commune: CommuneDemo,
  domaine: string,
): Promise<Commune> {
  const existante = await upsertCommune(payload, commune)
  const hostname = `${commune.slug}.${domaine}`
  // Garde-fou (brief, partie A) : tout hostname hors .<DEMO_DOMAIN> est refusé.
  if (!estHostnameDemo(hostname, domaine)) {
    throw new Error(`Hostname de démonstration hors du domaine « ${domaine} » : refusé.`)
  }
  await upsertDomaine(payload, {
    hostname,
    commune: existante.id,
    canonique: true,
  })
  // Activation seulement si nécessaire : une relance ne crée pas de version de fiche.
  if (!existante.actif) {
    await payload.update({
      collection: 'communes',
      id: existante.id,
      data: { actif: true },
      overrideAccess: true,
    })
  }
  return existante
}

/**
 * Re-date les événements démo depuis aujourd'hui : une démo qui vit des
 * semaines ne doit pas afficher un agenda vide (brief, partie A). contenu-demo
 * ne les crée que si l'agenda est vide — rien n'est dupliqué ici.
 */
async function redaterEvenements(payload: Payload, tenant: number) {
  for (const evenement of EVENEMENTS_DEMO) {
    const trouves = await payload.find({
      collection: 'evenements',
      where: { and: [{ tenant: { equals: tenant } }, { titre: { equals: evenement.titre } }] },
      limit: 1,
      overrideAccess: true,
    })
    const id = trouves.docs[0]?.id
    if (id === undefined) continue
    const debut = Date.now() + evenement.dansJours * 86_400_000
    await payload.update({
      collection: 'evenements',
      id,
      data: {
        dateDebut: new Date(debut).toISOString(),
        dateFin: new Date(debut + evenement.dureeHeures * 3_600_000).toISOString(),
      },
      overrideAccess: true,
    })
  }
}

async function seed() {
  const env: EnvDemo = {
    DEMO_DOMAIN: process.env.DEMO_DOMAIN,
    DEMO_MDP_OPERATEUR: process.env.DEMO_MDP_OPERATEUR,
    DEMO_MDP_ADMIN: process.env.DEMO_MDP_ADMIN,
    DEMO_MDP_REDACTEUR: process.env.DEMO_MDP_REDACTEUR,
  }
  const erreurs = erreursEnvironnementDemo(env)
  if (erreurs.length > 0) {
    console.error(`Seed de démo en ligne interrompu :\n${erreurs.join('\n')}`)
    process.exit(1)
  }
  // Garanti complet par erreursEnvironnementDemo ci-dessus.
  const { DEMO_DOMAIN, DEMO_MDP_OPERATEUR, DEMO_MDP_ADMIN, DEMO_MDP_REDACTEUR } =
    env as Required<EnvDemo>

  const payload = await getPayloadClient()

  const saintEx = await assurerCommune(payload, COMMUNES_DEMO[0], DEMO_DOMAIN)
  const portLavanne = await assurerCommune(payload, COMMUNES_DEMO[1], DEMO_DOMAIN)

  // Courriels en .invalid (RFC 2606) : jamais livrables, acceptés par la
  // validation Payload. Les mots de passe viennent de l'environnement, ne sont
  // jamais journalisés, et un compte existant garde le sien (création seule).
  await upsertUser(payload, {
    email: 'operateur@pdlm.invalid',
    name: 'Opérateur (démo)',
    password: DEMO_MDP_OPERATEUR,
    role: 'operateur',
  })
  const admin = await upsertUser(payload, {
    email: 'admin@pdlm.invalid',
    name: 'Admin Saint-Exupéry (démo)',
    password: DEMO_MDP_ADMIN,
    tenants: [{ tenant: saintEx.id, roles: ['admin'] }],
  })
  await upsertUser(payload, {
    email: 'redacteur@pdlm.invalid',
    name: 'Rédacteur Saint-Exupéry (démo)',
    password: DEMO_MDP_REDACTEUR,
    tenants: [{ tenant: saintEx.id, roles: ['redacteur'] }],
  })

  await seedContenuDemo(payload, saintEx.id, portLavanne.id, admin.id, {
    nomSecondaire: 'Port-Lavanne',
    traductionsCorses: false, // la démo en ligne n'est pas la démo multilingue
  })
  await redaterEvenements(payload, saintEx.id)

  payload.logger.info(
    `Démo en ligne prête — saint-ex (Village) et port-lavanne (Littoral) sur *.${DEMO_DOMAIN}, comptes operateur@pdlm.invalid, admin@pdlm.invalid, redacteur@pdlm.invalid.`,
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
