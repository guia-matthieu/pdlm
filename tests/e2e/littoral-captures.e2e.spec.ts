import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { creerEvenements, supprimerEvenements } from '../helpers/evenements'
import { connecterAdmin } from '../helpers/login'

/**
 * Captures du gabarit Littoral à comparer à sa maquette validée
 * (`docs/recherche/2026-09-25_front-beau/J-maquette-littoral/`, hors dépôt).
 * La commune de démonstration n'a ni frise ni photo : ce test la compose le
 * temps des captures comme la maquette J (frise de son `frise_littoral.py`,
 * coordonnées, quatre actualités, quatre événements pour la courbe de marées,
 * photos de `J-maquette-littoral/images/`), capture l'accueil avec photos
 * puis sans aucune photo (I30 : tout est illustré), et remet la commune dans
 * son état d'origine. Sorties :
 * `test-results/gabarits/littoral-{photos,sans-photo}-{1440,390}.png`.
 *
 * Les photos vivent hors dépôt (sources de recherche ignorées par git) :
 * sans elles, la suite passe son tour plutôt que d'échouer.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const IMAGES = path.join(
  process.cwd(),
  'docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images',
)
const DOSSIER = path.join('test-results', 'gabarits')
/** Marque des contenus créés ici : un passage interrompu se nettoie au suivant. */
const MARQUE = 'capture-littoral'
const J = 24 * 3600_000
/** Événements ajoutés le temps des captures, retrouvés par leur titre au nettoyage. */
const EVENEMENTS = [
  { titre: 'Nettoyage de la grande plage', lieu: 'Grande plage', jours: 12 },
  { titre: 'Concert du quai', lieu: 'Quai des pêcheurs', jours: 19 },
  { titre: 'Fête de la mer', lieu: 'Port', jours: 26 },
  { titre: 'Marché des produits de la criée', lieu: 'Halle à marée', jours: 33 },
]

/**
 * La silhouette de la maquette J (`COMPOSITION` de son `frise_littoral.py`),
 * en lignes « pièce + taille + écart », l'ordre des pièces est celui de J.
 * Deux écarts adaptés : le champ est `min: 0` dans `Communes.ts` (l. 449), le
 * `-40` qui chevauchait le phare sur la jetée devient 0 ; sans ce
 * chevauchement la frise dépasse, le dernier écart passe de 30 à 0. Total
 * 1438 px, dans les 1440 du viewBox.
 */
const FRISE = [
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
async function televerser(page: Page, commune: number, fichier: string): Promise<number> {
  const base64 = (await readFile(path.join(IMAGES, fichier))).toString('base64')
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
    // La une déborde jusqu'au bord de l'écran, jamais au-delà (relecture M2).
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `à ${largeur} px, la page déborde du viewport`,
    ).toBeLessThanOrEqual(largeur)
    await page.screenshot({ path: path.join(DOSSIER, `${nom}-${largeur}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

test.describe.serial('Captures du gabarit Littoral', () => {
  test.skip(!existsSync(IMAGES), 'photos de la maquette J absentes (hors dépôt, docs/recherche)')

  let page: Page
  let contexte: BrowserContext
  let idCommune: number
  let origine: Record<string, unknown>
  let actusDemo: Array<{ id: number; image?: number | null }>
  let tuiles: Array<Record<string, unknown>>
  const crees = { media: [] as number[], actualites: [] as number[] }

  const patchCommune = (corps: unknown) =>
    api(page, `/api/communes/${idCommune}`, json('PATCH', corps))

  /** Retire ce qu'un passage (celui-ci ou un précédent interrompu) a créé. */
  async function nettoyer() {
    const filtres = {
      actualites: `where[slug][like]=${MARQUE}`,
      media: `where[alt][like]=${MARQUE}`,
    }
    for (const [collection, filtre] of Object.entries(filtres)) {
      const { docs } = await api(page, `/api/${collection}?${filtre}&limit=100&depth=0&draft=true`)
      for (const doc of docs as Array<{ id: number }>) {
        await api(page, `/api/${collection}/${doc.id}`, { method: 'DELETE' })
      }
    }
    await supprimerEvenements(page, EVENEMENTS.map((e) => e.titre))
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

    // Photos de la maquette J : héros en panorama, quatre actualités, trois tuiles sur quatre.
    const photo: Record<string, number> = {}
    for (const nom of [
      'phare-pano-2000',
      'digue-800',
      'abbaye-800',
      'laisse-800',
      'goeland-800',
      'sentier-800',
      'voiliers-800',
    ]) {
      photo[nom] = await televerser(page, idCommune, `${nom}.jpg`)
      crees.media.push(photo[nom])
    }

    await patchCommune({
      apparence: { gabarit: 'littoral', frise: FRISE, photoAccueil: photo['phare-pano-2000'] },
      coordonnees: {
        adresse: '1 quai de la Mairie',
        codePostal: '01100',
        ville: 'Saint-Exupéry-sur-Mer',
        telephone: '03 00 00 00 00',
        email: 'mairie@saint-exupery-sur-mer.fr',
      },
      horaires: 'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.',
      accueil: {
        // Comme sur la maquette : la troisième tuile reste sans photo, illustrée.
        mosaique: tuiles.map((tuile, i) => ({
          ...tuile,
          photo:
            [photo['sentier-800'], photo['abbaye-800'], null, photo['voiliers-800']][i] ?? null,
        })),
      },
    })

    // Deux actualités de plus (une une et trois brèves) et quatre événements pour la courbe.
    const ajouts = [
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
    ]
    for (const [i, a] of ajouts.entries()) {
      const { doc } = await api(
        page,
        '/api/actualites',
        json('POST', {
          tenant: idCommune,
          titre: a.titre,
          slug: `${MARQUE}-${i}`,
          resume: a.resume,
          contenu: paragraphe(a.resume),
          datePublication: new Date(Date.now() - a.jours * J).toISOString(),
          _status: 'published',
        }),
      )
      crees.actualites.push(doc.id)
    }
    const images = [
      photo['digue-800'],
      photo['abbaye-800'],
      photo['laisse-800'],
      photo['goeland-800'],
    ]
    for (const [i, id] of [...actusDemo.map((a) => a.id), ...crees.actualites]
      .slice(0, 4)
      .entries()) {
      await api(page, `/api/actualites/${id}`, json('PATCH', { image: images[i] }))
    }
    await creerEvenements(page, idCommune, EVENEMENTS)
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

  test('avec photos : la commune composée comme la maquette J', async () => {
    await capturer(page, 'littoral-photos')
    // Le thème du gabarit est bien celui qui s'applique : police de titrage chargée.
    expect(await page.evaluate(() => document.fonts.check('400 1rem "Source Serif 4"'))).toBe(true)
    await expect(page.locator('[data-section="heros"] img')).toBeVisible()
    await expect(page.locator('.pied-page__frise svg')).toBeVisible()
  })

  test('sans aucune photo : héros, actualités et mosaïque illustrés (I30)', async () => {
    await patchCommune({
      apparence: { photoAccueil: null },
      accueil: { mosaique: tuiles.map((tuile) => ({ ...tuile, photo: null })) },
    })
    for (const id of [...actusDemo.map((a) => a.id), ...crees.actualites]) {
      await api(page, `/api/actualites/${id}`, json('PATCH', { image: null }))
    }
    await capturer(page, 'littoral-sans-photo')
    await page.goto('/')
    expect(await page.locator('main img').count()).toBe(0)
    await expect(page.locator('[data-section="heros"] svg[data-illustration]')).toBeVisible()
  })
})
