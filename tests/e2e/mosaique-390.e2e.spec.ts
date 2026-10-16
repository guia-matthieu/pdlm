import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Régression « mosaïque 390 » (docs/qc/notes-mosaique-390.md) : sous 700px,
 * la mosaïque passe sur une colonne dans les deux gabarits — une tuile par
 * ligne, pleine largeur, sans décalage ni défilement horizontal. Littoral
 * cadre tout en 3/2, première tuile comprise (l'attribut height des img
 * écrase aspect-ratio, d'où le height auto du thème). Village : la 1re tuile
 * redevient grid-column auto, sinon span 2 crée une colonne implicite et la
 * page déborde. Juste au-dessus de la rupture (701px), les colonnes restent.
 *
 * Fichier séparé du spec de captures, sur le modèle de littoral-mairie-390 :
 * composition minimale (gabarit + tuiles avec photos), les deux jeux de
 * couleurs du plan, pour prouver le rouge avant / vert après en quelques
 * secondes sans rejouer les seize captures.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const MARQUE = 'mosaique-390'

const JEUX = [
  { principale: '#2a7f9e', accent: '#f2b134', terre: '#d2462f' },
  { principale: '#9b3d57', accent: '#7fc4c9', terre: '#e08a2c' },
] as const

const GABARITS = [
  {
    nom: 'village',
    images: path.join(process.cwd(), 'src/gabarits/village/maquette/images'),
    tuiles: ['pupillin-800', 'montagna-800', null, 'mairie-800'],
  },
  {
    nom: 'littoral',
    images: path.join(
      process.cwd(),
      'docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images',
    ),
    tuiles: ['sentier-800', 'abbaye-800', null, 'voiliers-800'],
  },
] as const

/* Appels API depuis le navigateur (cookie de session + CSRF), comme la suite de captures. */
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

/** Mesures de la mosaïque : pistes, contenu, tuiles (boîte, marge, visuel). */
async function mesurer(page: Page) {
  const r = await page.evaluate(() => {
    const m = document.querySelector('.mosaique')
    if (!m) return null
    const cs = getComputedStyle(m)
    const contenu =
      m.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    return {
      pistes: cs.gridTemplateColumns.trim().split(/\s+/),
      contenu,
      scrollWidth: document.documentElement.scrollWidth,
      tuiles: Array.from(m.children).map((li) => {
        const boite = li.getBoundingClientRect()
        const visuel = li.querySelector('img, .mosaique__scene')?.getBoundingClientRect()
        return {
          largeur: boite.width,
          margeHaut: parseFloat(getComputedStyle(li).marginTop),
          visuel: visuel ? { l: visuel.width, h: visuel.height } : null,
        }
      }),
    }
  })
  expect(r, 'la mosaïque est rendue').toBeTruthy()
  return r!
}

/** Prépare la page à une largeur donnée et attend le rendu, images chargées. */
async function ouvrir(page: Page, largeur: number) {
  await page.setViewportSize({ width: largeur, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    // Images différées hors écran : forcer le chargement avant decode
    // (sinon decode() pend indéfiniment), comme le spec de captures.
    await Promise.all(
      Array.from(document.images).map((img) => {
        img.loading = 'eager'
        return img.decode().catch(() => null)
      }),
    )
  })
}

for (const g of GABARITS) {
  const avecPhotos = existsSync(g.images)

  test.describe.serial(`${g.nom} : mosaïque sur une colonne sous 700 px`, () => {
    let page: Page
    let idCommune: number
    let origine: Record<string, unknown>
    let tuiles: Array<Record<string, unknown>>
    const idsMedia: number[] = []

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(120_000)
      page = await (await browser.newContext()).newPage()
      await connecterAdmin(page, OPERATEUR)

      const commune = (
        await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0')
      ).docs[0]
      idCommune = commune.id
      origine = commune
      tuiles = commune.accueil?.mosaique ?? []

      // Médias d'un run interrompu : les nôtres porteront la marque, purge d'abord.
      const { docs } = await api(
        page,
        `/api/media?where[alt][like]=${MARQUE}&limit=100&depth=0&draft=true`,
      )
      for (const d of docs as Array<{ id: number }>) {
        await api(page, `/api/media/${d.id}`, { method: 'DELETE' })
      }

      const photo: Record<string, number> = {}
      if (avecPhotos) {
        for (const nom of g.tuiles.filter((t) => t !== null)) {
          const base64 = (
            await readFile(path.join(g.images, `${nom}.jpg`))
          ).toString('base64')
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
            { base64, fichier: `${nom}.jpg`, commune: idCommune, alt: `${MARQUE} ${nom}.jpg` },
          )
          expect(r.ok, `téléversement ${nom}.jpg → ${r.statut}`).toBe(true)
          const id = JSON.parse(r.corps).doc.id
          idsMedia.push(id)
          photo[nom] = id
        }
      }
      await api(page, `/api/communes/${idCommune}`, json('PATCH', {
        apparence: { gabarit: g.nom },
        accueil: {
          mosaique: tuiles.map((tuile, i) => ({
            ...tuile,
            photo: avecPhotos ? (photo[g.tuiles[i] ?? ''] ?? null) : null,
          })),
        },
      }))
    })

    test.afterAll(async () => {
      if (!page) return
      try {
        const apparence = (origine.apparence ?? {}) as Record<string, unknown>
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          apparence: {
            gabarit: apparence.gabarit ?? null,
            couleurPrincipale: apparence.couleurPrincipale ?? null,
            couleurAccent: apparence.couleurAccent ?? null,
            couleurTerre: apparence.couleurTerre ?? null,
          },
          accueil: { mosaique: tuiles },
        }))
        for (const id of idsMedia) await api(page, `/api/media/${id}`, { method: 'DELETE' })
      } finally {
        await page.context().close()
      }
    })

    for (const jeu of JEUX) {
      test(`à 390 px, jeu #${jeu.principale.slice(1)} : une tuile par ligne, pleine largeur, sans décalage`, async () => {
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          apparence: {
            couleurPrincipale: jeu.principale,
            couleurAccent: jeu.accent,
            couleurTerre: jeu.terre,
          },
        }))
        await ouvrir(page, 390)

        const { pistes, contenu, scrollWidth, tuiles: boites } = await mesurer(page)
        expect(pistes.length, `une seule piste attendue, obtenues : ${pistes.join(' / ')}`).toBe(1)
        for (const [j, boite] of boites.entries()) {
          expect(
            boite.largeur,
            `tuile ${j + 1}/${boites.length} : ${boite.largeur}px sur ${contenu}px`,
          ).toBeGreaterThan(contenu - 2)
          expect(boite.largeur).toBeLessThan(contenu + 2)
          expect(boite.margeHaut, `tuile ${j + 1} : marge haute ${boite.margeHaut}px`).toBeLessThan(1)
        }
        expect(scrollWidth, 'la page ne déborde pas du viewport').toBeLessThanOrEqual(390)

        if (g.nom === 'littoral') {
          for (const [j, boite] of boites.entries()) {
            const rapport = boite.visuel!.h / boite.visuel!.l
            expect(
              Math.abs(rapport - 2 / 3),
              `tuile ${j + 1} : visuel ${boite.visuel!.l}x${boite.visuel!.h}, rapport ${rapport.toFixed(4)}`,
            ).toBeLessThanOrEqual((2 / 3) * 0.01)
          }
        }
      })
    }

    test('à 701 px, juste au-dessus de la rupture, les colonnes restent', async () => {
      await ouvrir(page, 701)
      const { pistes } = await mesurer(page)
      expect(
        pistes.length,
        `plus d'une piste de grille attendue, obtenues : ${pistes.join(' / ')}`,
      ).toBeGreaterThan(1)
    })
  })
}
