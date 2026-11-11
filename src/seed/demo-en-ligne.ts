import type { Commune, Domaine, User } from '../payload-types'

import { FRANCAIS } from '../lib/langues'
import { getPayloadClient } from '../lib/payload'
import { seedContenuDemo } from './contenu-demo'
import {
  domainesMalRattaches,
  erreursEnvironnementDemo,
  messageComptesEtrangers,
  slugsEtrangers,
  type DomaineAttendu,
  type EnvDemo,
} from './garde-fous-demo'

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

/** Courriels des comptes de démo (retouche O) : les seuls admis en base. */
const COURRIELS_DEMO = [
  'operateur@pdlm.invalid',
  'admin@pdlm.invalid',
  'redacteur@pdlm.invalid',
]

// Mêmes upserts idempotents que le seed de développement (src/seed/index.ts),
// réécrits ici : ce dernier ne peut pas être importé, il refuse NODE_ENV=production.
// La lecture préalable vit dans seed() : TOUS les contrôles passent avant la
// première écriture (retouche N), l'existante déjà lue est passée ici.
async function upsertCommune(
  payload: Payload,
  data: CommuneDemo,
  existante?: Commune,
): Promise<Commune> {
  if (existante) return existante
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
  existant?: User, // déjà lu par le contrôle O (retouche N) : création seule ici
): Promise<User> {
  if (existant) return existant
  return payload.create({ collection: 'users', data, overrideAccess: true })
}

/**
 * Domaine canonique <slug>.<DEMO_DOMAIN> puis activation (I6). Le hostname est
 * construit ici à partir du seul `domaine` validé par erreursEnvironnementDemo
 * — les garde-fous réels sont ceux de G (base et domaines), pas une vérification
 * tautologique du hostname par lui-même (retouche L).
 */
async function activerAvecDomaine(
  payload: Payload,
  commune: Commune,
  domaine: string,
): Promise<void> {
  const hostname = `${commune.slug}.${domaine}`
  await upsertDomaine(payload, {
    hostname,
    commune: commune.id,
    canonique: true,
  })
  // Activation seulement si nécessaire : une relance ne crée pas de version de fiche.
  if (!commune.actif) {
    await payload.update({
      collection: 'communes',
      id: commune.id,
      data: { actif: true },
      overrideAccess: true,
    })
  }
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
    PLATFORM_DOMAIN: process.env.PLATFORM_DOMAIN,
    DEMO_MDP_OPERATEUR: process.env.DEMO_MDP_OPERATEUR,
    DEMO_MDP_ADMIN: process.env.DEMO_MDP_ADMIN,
    DEMO_MDP_REDACTEUR: process.env.DEMO_MDP_REDACTEUR,
  }
  const erreurs = erreursEnvironnementDemo(env)
  if (erreurs.length > 0) {
    console.error(`Seed de démo en ligne interrompu :\n${erreurs.join('\n')}`)
    process.exit(1)
  }
  // Les quatre variables ci-dessous sont garanties présentes ; PLATFORM_DOMAIN,
  // facultative, n'est plus utile après la comparaison de erreursEnvironnementDemo.
  const { DEMO_DOMAIN, DEMO_MDP_OPERATEUR, DEMO_MDP_ADMIN, DEMO_MDP_REDACTEUR } =
    env as Required<EnvDemo>

  const payload = await getPayloadClient()

  // ——— Lectures de contrôle : TOUTES avant la première écriture (retouche N).
  // Un garde-fou qui écrirait d'abord (« on crée, on contrôle ensuite »)
  // laisserait une base partiellement seedée derrière un refus.

  // Garde-fou (retouche G) : une base qui contient une commune hors démo n'est
  // pas une base de démonstration.
  const toutesCommunes = await payload.find({
    collection: 'communes',
    limit: 0,
    overrideAccess: true,
  })
  const parSlug = new Map(toutesCommunes.docs.map((commune) => [commune.slug, commune]))
  const etrangeres = slugsEtrangers(
    [...parSlug.keys()],
    COMMUNES_DEMO.map((commune) => commune.slug),
  )
  if (etrangeres.length > 0) {
    console.error(
      `Seed de démo interrompu : la base contient ${etrangeres.length} commune(s) hors démo ` +
        `(${etrangeres.join(', ')}) — le seed de démo refuse toute base qui n'est pas la sienne.`,
    )
    process.exit(1)
  }

  // Garde-fou (retouche G) : un hostname de démo déjà rattaché à une autre
  // commune — DEMO_DOMAIN recouvrirait un site existant. Recherche par
  // hostname ATTENDU (retouche N) : les communes de démo n'ont pas besoin
  // d'exister en base pour que le contrôle s'applique — à la première
  // exécution, un hostname déjà pris est forcément mal rattaché.
  const attendus: DomaineAttendu[] = COMMUNES_DEMO.map((commune) => ({
    hostname: `${commune.slug}.${DEMO_DOMAIN}`,
    commune: parSlug.get(commune.slug)?.id,
  }))
  const domaines = await payload.find({
    collection: 'domaines',
    where: { hostname: { in: attendus.map((attendu) => attendu.hostname) } },
    overrideAccess: true,
  })
  const malRattaches = domainesMalRattaches(
    domaines.docs.map((domaine) => ({
      hostname: domaine.hostname,
      commune: typeof domaine.commune === 'number' ? domaine.commune : domaine.commune.id,
    })),
    attendus,
  )
  if (malRattaches.length > 0) {
    console.error(
      `Seed de démo interrompu : ${malRattaches.join(', ')} est déjà rattaché à une autre commune — changer DEMO_DOMAIN, ou retirer le domaine.`,
    )
    process.exit(1)
  }

  // Garde-fou (retouche O) : un utilisateur hors comptes de démo — la base
  // d'une production réelle ne doit jamais être re-seedée, ses comptes jamais
  // touchés. Le message ne cite aucun courriel lu en base.
  const tousUtilisateurs = await payload.find({
    collection: 'users',
    limit: 0,
    overrideAccess: true,
  })
  const messageComptes = messageComptesEtrangers(
    tousUtilisateurs.docs.map((utilisateur) => utilisateur.email),
    COURRIELS_DEMO,
  )
  if (messageComptes !== null) {
    console.error(messageComptes)
    process.exit(1)
  }

  // ——— Écritures (aucun contrôle au-delà de cette ligne) ———
  const saintEx = await upsertCommune(payload, COMMUNES_DEMO[0], parSlug.get('saint-ex'))
  const portLavanne = await upsertCommune(payload, COMMUNES_DEMO[1], parSlug.get('port-lavanne'))

  await activerAvecDomaine(payload, saintEx, DEMO_DOMAIN)
  await activerAvecDomaine(payload, portLavanne, DEMO_DOMAIN)

  // Courriels en .invalid (RFC 2606) : jamais livrables, acceptés par la
  // validation Payload. Les mots de passe viennent de l'environnement, ne sont
  // jamais journalisés, et un compte existant garde le sien (création seule).
  const parCourriel = new Map(
    tousUtilisateurs.docs.map((utilisateur) => [utilisateur.email, utilisateur]),
  )
  await upsertUser(
    payload,
    {
      email: 'operateur@pdlm.invalid',
      name: 'Opérateur (démo)',
      password: DEMO_MDP_OPERATEUR,
      role: 'operateur',
    },
    parCourriel.get('operateur@pdlm.invalid'),
  )
  const admin = await upsertUser(
    payload,
    {
      email: 'admin@pdlm.invalid',
      name: 'Admin Saint-Exupéry (démo)',
      password: DEMO_MDP_ADMIN,
      tenants: [{ tenant: saintEx.id, roles: ['admin'] }],
    },
    parCourriel.get('admin@pdlm.invalid'),
  )
  await upsertUser(
    payload,
    {
      email: 'redacteur@pdlm.invalid',
      name: 'Rédacteur Saint-Exupéry (démo)',
      password: DEMO_MDP_REDACTEUR,
      tenants: [{ tenant: saintEx.id, roles: ['redacteur'] }],
    },
    parCourriel.get('redacteur@pdlm.invalid'),
  )

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
