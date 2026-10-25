import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Le titre d'une page de contenu (route [slug]) se rend en `h1` visible —
 * sauf si la page porte déjà un bloc `hero`, qui émet le sien (RenduBlocs).
 * Mesuré sur les deux gabarits en composant la commune de démonstration,
 * puis sur Valvert (`valvert.localhost`) pour la page à bloc hero (`marche`,
 * semée avec un hero en premier bloc).
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const GABARITS = ['village', 'littoral'] as const
const SLUGS = ['mentions-legales', 'vie-municipale'] as const
const PORT = Number(process.env.E2E_PORT ?? 3000)
const VALVERT = `http://valvert.localhost:${PORT}`

/* Appel API depuis le navigateur (cookie de session + CSRF), comme suites-1440. */
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

test.describe.serial('Pages de contenu : un h1 tiré du titre', () => {
  let page: Page
  let idCommune: number
  let origine: Record<string, unknown>

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000)
    page = await (await browser.newContext()).newPage()
    await connecterAdmin(page, OPERATEUR)
    const commune = (
      await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0')
    ).docs[0]
    idCommune = commune.id
    origine = commune
  })

  for (const gabarit of GABARITS) {
    test.describe.serial(gabarit, () => {
      test.beforeAll(async () => {
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          apparence: { gabarit },
        }))
      })

      for (const slug of SLUGS) {
        test(`${slug} : un seul h1, égal au titre`, async () => {
          const { docs } = await api(
            page,
            `/api/pages?where[slug][equals]=${slug}&where[tenant][equals]=${idCommune}&limit=1&depth=0`,
          )
          expect(docs[0], `page « ${slug} » introuvable par l'API`).toBeTruthy()
          await page.goto(`/${slug}`)
          await expect(page.locator('h1')).toHaveCount(1)
          await expect(page.locator('h1')).toHaveText(docs[0].titre)
        })
      }
    })
  }

  test.afterAll(async () => {
    if (!page) return
    try {
      const apparence = (origine.apparence ?? {}) as Record<string, unknown>
      await api(page, `/api/communes/${idCommune}`, json('PATCH', {
        apparence: { gabarit: apparence.gabarit ?? null },
      }))
      const relue = await api(page, `/api/communes/${idCommune}?depth=0`)
      expect(
        (relue.apparence ?? {}).gabarit ?? null,
        'gabarit restauré',
      ).toBe(apparence.gabarit ?? null)
    } finally {
      await page.close()
    }
  })
})

test.describe('Page à bloc hero : le hero garde le seul h1', () => {
  test('marche de Valvert : un seul h1, celui du hero', async ({ page }) => {
    await page.goto(`${VALVERT}/marche`)
    await expect(page.locator('h1')).toHaveCount(1)
    await expect(page.locator('h1')).toHaveText('Marché du samedi')
  })
})
