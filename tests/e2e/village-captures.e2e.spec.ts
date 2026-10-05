import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Captures du gabarit Village à comparer à sa maquette
 * (`src/gabarits/village/maquette/`). La commune de démonstration n'a ni
 * frise ni photo : ce test la compose le temps des captures comme la
 * maquette (frise, coordonnées, quatre actualités, quatre événements, photos
 * de `maquette/images/`), capture l'accueil avec photos puis sans aucune
 * photo (I30 : tout est illustré), et remet la commune dans son état
 * d'origine. Sorties : `test-results/gabarits/village-{photos,sans-photo}-{1440,390}.png`.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const IMAGES = path.join(process.cwd(), 'src/gabarits/village/maquette/images')
const DOSSIER = path.join('test-results', 'gabarits')
/** Marque des contenus créés ici : un passage interrompu se nettoie au suivant. */
const MARQUE = 'capture-village'
const J = 24 * 3600_000
/** Événements ajoutés le temps des captures, retrouvés par leur titre au nettoyage. */
const EVENEMENTS = [
  { titre: 'Repas des aînés', lieu: 'Salle des fêtes', jours: 18 },
  { titre: 'Vendanges à l’ancienne', lieu: 'Coteau des Chaumes', jours: 25 },
]

/**
 * La silhouette de la maquette, en lignes « pièce + taille » : 21 pièces, dont
 * les avances (48 / 70 / 95) couvrent la largeur 1440 sans écart.
 */
const FRISE = [
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
    await page.screenshot({ path: path.join(DOSSIER, `${nom}-${largeur}.png`), fullPage: true })
  }
  await page.setViewportSize({ width: 1280, height: 720 })
}

test.describe.serial('Captures du gabarit Village', () => {
  let page: Page
  let contexte: BrowserContext
  let idCommune: number
  let origine: Record<string, unknown>
  let actusDemo: Array<{ id: number; image?: number | null }>
  let tuiles: Array<Record<string, unknown>>
  const crees = { media: [] as number[], actualites: [] as number[], evenements: [] as number[] }

  const patchCommune = (corps: unknown) =>
    api(page, `/api/communes/${idCommune}`, json('PATCH', corps))

  /** Retire ce qu'un passage (celui-ci ou un précédent interrompu) a créé. */
  async function nettoyer() {
    const filtres = {
      actualites: `where[slug][like]=${MARQUE}`,
      evenements: EVENEMENTS.map(
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

    // Photos de la maquette : héros, quatre actualités, trois tuiles sur quatre.
    const photo: Record<string, number> = {}
    for (const nom of [
      'montagna-1600',
      'ecole-800',
      'malange-800',
      'mairie-800',
      'rothonay-800',
      'pupillin-800',
      'montagna-800',
    ]) {
      photo[nom] = await televerser(page, idCommune, `${nom}.jpg`)
      crees.media.push(photo[nom])
    }

    await patchCommune({
      apparence: { gabarit: 'village', frise: FRISE, photoAccueil: photo['montagna-1600'] },
      coordonnees: {
        adresse: '1 place de la Mairie',
        codePostal: '01100',
        ville: 'Saint-Exupéry-les-Bains',
        telephone: '03 00 00 00 00',
        email: 'mairie@saint-exupery-les-bains.fr',
      },
      horaires: 'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.',
      accueil: {
        // Comme sur la maquette : la troisième tuile reste sans photo, illustrée.
        mosaique: tuiles.map((tuile, i) => ({
          ...tuile,
          photo:
            [photo['pupillin-800'], photo['montagna-800'], null, photo['mairie-800']][i] ?? null,
        })),
      },
    })

    // Quatre actualités (une une et trois brèves) et quatre événements.
    const ajouts = [
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
      photo['ecole-800'],
      photo['malange-800'],
      photo['mairie-800'],
      photo['rothonay-800'],
    ]
    for (const [i, id] of [...actusDemo.map((a) => a.id), ...crees.actualites]
      .slice(0, 4)
      .entries()) {
      await api(page, `/api/actualites/${id}`, json('PATCH', { image: images[i] }))
    }
    for (const e of EVENEMENTS) {
      const debut = Date.now() + e.jours * J
      const { doc } = await api(
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
      crees.evenements.push(doc.id)
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

  test('avec photos : la commune composée comme la maquette', async () => {
    await capturer(page, 'village-photos')
    // Le thème du gabarit est bien celui qui s'applique : police de titrage chargée.
    expect(await page.evaluate(() => document.fonts.check('700 1rem Bricolage'))).toBe(true)
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
    await capturer(page, 'village-sans-photo')
    await page.goto('/')
    expect(await page.locator('main img').count()).toBe(0)
    await expect(page.locator('[data-section="heros"] svg[data-illustration]')).toBeVisible()
  })
})
