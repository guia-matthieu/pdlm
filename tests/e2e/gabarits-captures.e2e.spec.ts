import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Captures des deux jeux de couleurs du plan, tâche 10 (l. 1129) : 2 gabarits ×
 * 2 jeux (`#2a7f9e/#f2b134/#d2462f` et `#9b3d57/#7fc4c9/#e08a2c`, principale /
 * accent / terre — l'ordre des défauts du plan l. 45, l'affectation tranchée
 * l. 199) × avec et sans photos, chacun en 1440 et 390 = 16 captures. La
 * commune de démonstration est composée comme la maquette de son gabarit (même
 * composition que village-captures / littoral-captures : frise, coordonnées,
 * quatre actualités, événements, photos), puis remise dans son état d'origine.
 * Sorties : `test-results/gabarits/t10/{gabarit}-{principale}-{photos,sans-photo}-{1440,390}.png`.
 * Si les photos d'une maquette manquent (hors dépôt), ses captures « avec
 * photos » passent leur tour, les sans-photo sont prises quand même.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const DOSSIER = path.join('test-results', 'gabarits', 't10')
/** Marque des contenus créés ici : un passage interrompu se nettoie au suivant. */
const MARQUE = 'capture-tache-10'
const J = 24 * 3600_000

const JEUX = [
  { principale: '#2a7f9e', accent: '#f2b134', terre: '#d2462f' },
  { principale: '#9b3d57', accent: '#7fc4c9', terre: '#e08a2c' },
] as const

type Config = {
  nom: 'village' | 'littoral'
  titre: string
  images: string
  police: string
  frise: Array<{ piece: string; taille: string; ecart?: number }>
  coordonnees: Record<string, string>
  horaires: string
  evenements: Array<{ titre: string; lieu: string; jours: number }>
  ajouts: Array<{ titre: string; resume: string; jours: number }>
  photoAccueil: string
  tuiles: Array<string | null>
  actus: string[]
}

const GABARITS: Array<Config> = [
  {
    nom: 'village',
    titre: 'Captures du gabarit Village — deux jeux de couleurs (tâche 10)',
    images: path.join(process.cwd(), 'src/gabarits/village/maquette/images'),
    police: '700 1rem Bricolage',
    // La silhouette de la maquette (village-captures.e2e.spec.ts) : 21 pièces.
    frise: [
      { piece: 'sapin', taille: 'grande' },
      { piece: 'sapin', taille: 'moyenne' },
      { piece: 'arbre', taille: 'moyenne' },
      { piece: 'maison', taille: 'moyenne' },
      { piece: 'maisonBasse', taille: 'moyenne' },
      { piece: 'maison', taille: 'petite' },
      { piece: 'eglise', taille: 'moyenne' },
      { piece: 'maison', taille: 'moyenne' },
      { piece: 'arbre', taille: 'petite' },
      { piece: 'maisonBasse', taille: 'grande' },
      { piece: 'mairie', taille: 'moyenne' },
      { piece: 'arbre', taille: 'moyenne' },
      { piece: 'maison', taille: 'moyenne' },
      { piece: 'maison', taille: 'petite' },
      { piece: 'arbre', taille: 'petite' },
      { piece: 'sapin', taille: 'grande' },
      { piece: 'sapin', taille: 'petite' },
      { piece: 'maisonBasse', taille: 'petite' },
      { piece: 'arbre', taille: 'moyenne' },
      { piece: 'sapin', taille: 'grande' },
      { piece: 'sapin', taille: 'moyenne' },
    ],
    coordonnees: {
      adresse: '1 place de la Mairie',
      codePostal: '01100',
      ville: 'Saint-Exupéry-les-Bains',
      telephone: '03 00 00 00 00',
      email: 'mairie@saint-exupery-les-bains.fr',
    },
    horaires: 'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.',
    evenements: [
      { titre: 'Repas des aînés', lieu: 'Salle des fêtes', jours: 18 },
      { titre: 'Vendanges à l’ancienne', lieu: 'Coteau des Chaumes', jours: 25 },
    ],
    ajouts: [
      {
        titre: 'La mairie fleurie primée au concours départemental',
        resume: 'Merci aux bénévoles du comité des fêtes.',
        jours: 10,
      },
      {
        titre: 'Nouveau sentier de la Combe balisé',
        resume: '7 km, départ derrière l’église.',
        jours: 17,
      },
    ],
    photoAccueil: 'montagna-1600',
    tuiles: ['pupillin-800', 'montagna-800', null, 'mairie-800'],
    actus: ['ecole-800', 'malange-800', 'mairie-800', 'rothonay-800'],
  },
  {
    nom: 'littoral',
    titre: 'Captures du gabarit Littoral — deux jeux de couleurs (tâche 10)',
    images: path.join(
      process.cwd(),
      'docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images',
    ),
    police: '400 1rem "Source Serif 4"',
    // La silhouette de la maquette J (littoral-captures.e2e.spec.ts), écarts adaptés.
    frise: [
      { piece: 'pin', taille: 'grande', ecart: 30 },
      { piece: 'cabane', taille: 'petite', ecart: 18 },
      { piece: 'cabane', taille: 'petite', ecart: 4 },
      { piece: 'cabane', taille: 'petite', ecart: 4 },
      { piece: 'maison', taille: 'moyenne', ecart: 70 },
      { piece: 'maison', taille: 'petite', ecart: 2 },
      { piece: 'eglise', taille: 'moyenne', ecart: 6 },
      { piece: 'maison', taille: 'moyenne', ecart: 6 },
      { piece: 'mairie', taille: 'moyenne', ecart: 40 },
      { piece: 'pin', taille: 'moyenne', ecart: 50 },
      { piece: 'goeland', taille: 'moyenne', ecart: 10 },
      { piece: 'barque', taille: 'petite', ecart: 60 },
      { piece: 'voilier', taille: 'moyenne', ecart: 30 },
      { piece: 'jetee', taille: 'moyenne', ecart: 70 },
      { piece: 'phare', taille: 'grande', ecart: 0 },
      { piece: 'voilier', taille: 'petite', ecart: 0 },
    ],
    coordonnees: {
      adresse: '1 quai de la Mairie',
      codePostal: '01100',
      ville: 'Saint-Exupéry-sur-Mer',
      telephone: '03 00 00 00 00',
      email: 'mairie@saint-exupery-sur-mer.fr',
    },
    horaires: 'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.',
    evenements: [
      { titre: 'Nettoyage de la grande plage', lieu: 'Grande plage', jours: 12 },
      { titre: 'Concert du quai', lieu: 'Quai des pêcheurs', jours: 19 },
      { titre: 'Fête de la mer', lieu: 'Port', jours: 26 },
      { titre: 'Marché des produits de la criée', lieu: 'Halle à marée', jours: 33 },
    ],
    ajouts: [
      {
        titre: 'Le phare rouvre pour les Journées du patrimoine',
        resume: 'Visites guidées samedi et dimanche après-midi.',
        jours: 10,
      },
      {
        titre: 'Nouveau sentier du littoral balisé',
        resume: '4 km entre la dune et la laisse de mer.',
        jours: 17,
      },
    ],
    photoAccueil: 'phare-pano-2000',
    tuiles: ['sentier-800', 'abbaye-800', null, 'voiliers-800'],
    actus: ['digue-800', 'abbaye-800', 'laisse-800', 'goeland-800'],
  },
]

const paragraphe = (texte: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'text',
            text: texte,
            format: 0,
            mode: 'normal',
            style: '',
            detail: 0,
            version: 1,
          },
        ],
      },
    ],
  },
})

/* Appels API depuis le navigateur (cookie de session + CSRF), comme la suite de conformité. */
async function api(page: Page, chemin: string, init?: RequestInit) {
  const r = await page.evaluate(
    async ({ chemin, init }) => {
      const reponse = await fetch(chemin, { credentials: 'include', ...init })
      return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
    },
    { chemin, init },
  )
  expect(r.ok, `${chemin} → ${r.statut} : ${r.corps.slice(0, 400)}`).toBe(true)
  return r.corps ? JSON.parse(r.corps) : null
}

const json = (methode: string, corps: unknown): RequestInit => ({
  method: methode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corps),
})

/** Téléverse une image de la maquette dans les médias de la commune ; rend son id. */
async function televerser(page: Page, commune: number, images: string, fichier: string) {
  const base64 = (await readFile(path.join(images, fichier))).toString('base64')
  const r = await page.evaluate(
    async ({ base64, fichier, commune, alt }) => {
      const octets = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
      const corps = new FormData()
      corps.append('file', new Blob([octets], { type: 'image/jpeg' }), fichier)
      corps.append('_payload', JSON.stringify({ alt, tenant: commune }))
      const reponse = await fetch('/api/media', {
        method: 'POST',
        credentials: 'include',
        body: corps,
      })
      return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
    },
    { base64, fichier, commune, alt: `${MARQUE} ${fichier}` },
  )
  expect(r.ok, `téléversement ${fichier} → ${r.statut} : ${r.corps.slice(0, 400)}`).toBe(true)
  return JSON.parse(r.corps).doc.id
}

async function capturer(page: Page, nom: string) {
  for (const largeur of [1440, 390]) {
    await page.setViewportSize({ width: largeur, height: largeur === 1440 ? 900 : 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)
    // Les images sous la ligne de flottaison sont en chargement différé :
    // les forcer et attendre leur décodage avant la capture pleine page.
    await page.evaluate(async () => {
      await Promise.all(
        Array.from(document.images).map((img) => {
          img.loading = 'eager'
          return img.decode().catch(() => null)
        }),
      )
    })
    // L'indicateur du serveur de développement n'est pas le site.
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })
    // Rien ne déborde du viewport, surtout à 390 (relecture M2).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `à ${largeur} px, la page déborde du viewport`,
    ).toBeLessThanOrEqual(largeur)
    await page.screenshot({ path: path.join(DOSSIER, `${nom}-${largeur}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

for (const g of GABARITS) {
  const avecPhotos = existsSync(g.images)

  test.describe.serial(g.titre, () => {
    let page: Page
    let contexte: BrowserContext
    let idCommune: number
    let origine: Record<string, unknown>
    let actusDemo: Array<{ id: number; image?: number | null }>
    let tuiles: Array<Record<string, unknown>>
    const crees = { actualites: [] as number[] }
    /** Ids des photos téléversées, par nom de fichier de la maquette. */
    let photo: Record<string, number>

    const patchCommune = (corps: unknown) =>
      api(page, `/api/communes/${idCommune}`, json('PATCH', corps))

    /** Retire ce qu'un passage (celui-ci ou un précédent interrompu) a créé. */
    async function nettoyer() {
      const filtres = {
        actualites: `where[slug][like]=${MARQUE}`,
        evenements: g.evenements.map(
          (e, i) => `where[titre][in][${i}]=${encodeURIComponent(e.titre)}`,
        ).join('&'),
        media: `where[alt][like]=${MARQUE}`,
      }
      for (const [collection, filtre] of Object.entries(filtres)) {
        const { docs } = await api(page, `/api/${collection}?${filtre}&limit=100&depth=0&draft=true`)
        for (const doc of docs as Array<{ id: number }>) {
          await api(page, `/api/${collection}/${doc.id}`, { method: 'DELETE' })
        }
      }
    }

    /**
     * Pose l'état d'une capture : couleurs du jeu, photo d'accueil, photos de
     * mosaïque et d'actualités — ou rien de tout cela (I30 : tout est illustré).
     */
    async function habiller(jeu: (typeof JEUX)[number], avec: boolean) {
      await patchCommune({
        apparence: {
          couleurPrincipale: jeu.principale,
          couleurAccent: jeu.accent,
          couleurTerre: jeu.terre,
          photoAccueil: avec ? photo[g.photoAccueil] : null,
        },
        accueil: {
          mosaique: tuiles.map((tuile, i) => ({
            ...tuile,
            photo: avec ? (photo[g.tuiles[i] ?? ''] ?? null) : null,
          })),
        },
      })
      const images = avec ? g.actus.map((f) => photo[f]) : g.actus.map(() => null)
      for (const [i, id] of [...actusDemo.map((a) => a.id), ...crees.actualites]
        .slice(0, 4)
        .entries()) {
        await api(page, `/api/actualites/${id}`, json('PATCH', { image: images[i] ?? null }))
      }
    }

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(240_000)
      contexte = await browser.newContext()
      page = await contexte.newPage()
      await connecterAdmin(page, OPERATEUR)

      const commune = (await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0'))
        .docs[0]
      idCommune = commune.id
      origine = commune
      tuiles = commune.accueil?.mosaique ?? []
      await nettoyer()
      actusDemo = (
        await api(
          page,
          `/api/actualites?where[tenant][equals]=${idCommune}&sort=-datePublication&limit=10&depth=0`,
        )
      ).docs

      // Toutes les photos de la maquette utiles ici : héros, actualités, tuiles.
      photo = {}
      for (const nom of [
        ...new Set([g.photoAccueil, ...g.actus, ...g.tuiles.filter((t): t is string => t !== null)]),
      ]) {
        photo[nom] = await televerser(page, idCommune, g.images, `${nom}.jpg`)
      }

      await patchCommune({
        apparence: { gabarit: g.nom, frise: g.frise },
        coordonnees: g.coordonnees,
        horaires: g.horaires,
      })

      // Deux actualités de plus pour remplir la une et les brèves.
      for (const [i, a] of g.ajouts.entries()) {
        const { doc } = await api(
          page,
          '/api/actualites',
          json('POST', {
            tenant: idCommune,
            titre: a.titre,
            slug: `${MARQUE}-${g.nom}-${i}`,
            resume: a.resume,
            contenu: paragraphe(a.resume),
            datePublication: new Date(Date.now() - a.jours * J).toISOString(),
            _status: 'published',
          }),
        )
        crees.actualites.push(doc.id)
      }
      for (const e of g.evenements) {
        const debut = Date.now() + e.jours * J
        await api(
          page,
          '/api/evenements',
          json('POST', {
            tenant: idCommune,
            titre: e.titre,
            dateDebut: new Date(debut).toISOString(),
            dateFin: new Date(debut + 3 * 3600_000).toISOString(),
            lieu: e.lieu,
          }),
        )
      }
    })

    test.afterAll(async () => {
      if (!page) return
      try {
        const apparence = (origine.apparence ?? {}) as Record<string, unknown>
        const coordonnees = (origine.coordonnees ?? {}) as Record<string, unknown>
        await patchCommune({
          apparence: {
            gabarit: apparence.gabarit ?? null,
            frise: apparence.frise ?? [],
            photoAccueil: apparence.photoAccueil ?? null,
            couleurPrincipale: apparence.couleurPrincipale ?? null,
            couleurAccent: apparence.couleurAccent ?? null,
            couleurTerre: apparence.couleurTerre ?? null,
          },
          // Champ par champ : un groupe Payload n'accepte pas null (notes tâche 4).
          coordonnees: {
            adresse: coordonnees.adresse ?? null,
            codePostal: coordonnees.codePostal ?? null,
            ville: coordonnees.ville ?? null,
            telephone: coordonnees.telephone ?? null,
            email: coordonnees.email ?? null,
          },
          horaires: origine.horaires ?? null,
          accueil: { mosaique: tuiles },
        })
        for (const actu of actusDemo) {
          await api(page, `/api/actualites/${actu.id}`, json('PATCH', { image: actu.image ?? null }))
        }
        await nettoyer()
      } finally {
        await contexte.close()
      }
    })

    test('jeu #2a7f9e avec photos : gabarit composé, dérivation appliquée', async () => {
      test.skip(!avecPhotos, 'photos de la maquette absentes')
      await habiller(JEUX[0], true)
      await capturer(page, `${g.nom}-2a7f9e-photos`)
      // Le thème du gabarit est bien celui qui s'applique : police de titrage chargée.
      expect(await page.evaluate((police) => document.fonts.check(police), g.police)).toBe(true)
      await expect(page.locator('[data-section="heros"] img')).toBeVisible()
      await expect(page.locator('.pied-page__frise svg')).toBeVisible()
    })

    test('jeu #2a7f9e sans aucune photo : héros, actualités et mosaïque illustrés (I30)', async () => {
      await habiller(JEUX[0], false)
      await capturer(page, `${g.nom}-2a7f9e-sans-photo`)
      await page.goto('/')
      expect(await page.locator('main img').count()).toBe(0)
      await expect(page.locator('[data-section="heros"] svg[data-illustration]')).toBeVisible()
    })

    test('jeu #9b3d57 sans aucune photo : héros, actualités et mosaïque illustrés (I30)', async () => {
      await habiller(JEUX[1], false)
      await capturer(page, `${g.nom}-9b3d57-sans-photo`)
      await page.goto('/')
      expect(await page.locator('main img').count()).toBe(0)
      await expect(page.locator('[data-section="heros"] svg[data-illustration]')).toBeVisible()
    })

    test('jeu #9b3d57 avec photos : gabarit composé, dérivation appliquée', async () => {
      test.skip(!avecPhotos, 'photos de la maquette absentes')
      await habiller(JEUX[1], true)
      await capturer(page, `${g.nom}-9b3d57-photos`)
      expect(await page.evaluate((police) => document.fonts.check(police), g.police)).toBe(true)
      await expect(page.locator('[data-section="heros"] img')).toBeVisible()
      await expect(page.locator('.pied-page__frise svg')).toBeVisible()
    })
  })
}
