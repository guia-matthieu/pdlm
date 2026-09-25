import { expect, test } from '@playwright/test'

/**
 * Multilingue, contre `npm run seed` (Valvert : corse activé, valvert.corsica
 * en corse ; `marche` traduite et validée, `demarches` non traduite).
 * valvert.localhost = sous-domaine de la plateforme (français à la racine).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const FR = `http://valvert.localhost:${PORT}`
const CO = `http://valvert.corsica:${PORT}`

test.describe('Multilingue', () => {
  test('page traduite sous /co/ : tout en corse', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('main')).toContainText('Mercatu di u sabbatu')
    await expect(page.locator('.mention-non-traduit')).toHaveCount(0)
  })

  test('page non traduite sous /co/ : html en corse, contenu français marqué, mention en corse', async ({
    page,
  }) => {
    await page.goto(`${FR}/co/demarches`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('.mention-non-traduit')).toHaveAttribute('lang', 'co')
    const contenu = page.locator('main [lang="fr"]')
    await expect(contenu).toContainText('adressez-vous à la mairie')
  })

  test('libellé de menu non traduit : repli marqué lang="fr"', async ({ page }) => {
    await page.goto(`${FR}/co`)
    await expect(page.locator('#menu-principal a', { hasText: 'Mercatu' })).not.toHaveAttribute('lang', /.+/)
    await expect(page.locator('#menu-principal a', { hasText: 'Démarches' })).toHaveAttribute('lang', 'fr')
  })

  test('domaine propre : le corse à la racine, liens sans préfixe', async ({ page }) => {
    await page.goto(`${CO}/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('main')).toContainText('Mercatu di u sabbatu')
    await expect(page.locator('#menu-principal a', { hasText: 'Mercatu' })).toHaveAttribute('href', '/marche')
  })

  test('sélecteur de langue : liens simples, lang, hreflang, aria-current', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    const nav = page.getByRole('navigation', { name: 'Lingua di u situ' })
    await expect(nav.locator('a[hreflang="fr"]')).toHaveAttribute('href', '/marche')
    await expect(nav.locator('a[hreflang="co"]')).toHaveAttribute('aria-current', 'true')
    await expect(nav.locator('a[hreflang="co"]')).toHaveAttribute('lang', 'co')
    await nav.locator('a[hreflang="fr"]').click()
    await expect(page).toHaveURL(`${FR}/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('hreflang et canonique dans le <head>', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://valvert.corsica/marche')
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute(
      'href',
      'https://valvert.fr/marche',
    )
    await page.goto(`${FR}/co/demarches`)
    await expect(page.locator('link[rel="alternate"][hreflang="co"]')).toHaveCount(0)
  })

  test('I14 : langue non activée → 404, jamais 500', async ({ request }) => {
    // Saint-Exupéry n'a pas activé le corse (hôte nu : DEFAULT_COMMUNE_SLUG)
    const reponse = await request.get('/co/actualites')
    expect(reponse.status()).toBe(404)
  })

  test('préfixe égal à la langue du domaine → 308 sans préfixe, requête gardée', async ({ request }) => {
    // `request` de Playwright ne passe pas par le résolveur de Chromium :
    // valvert.corsica n'y est pas résolu. On pose l'en-tête Host à la place,
    // contre la boucle locale (même mécanisme que le proxy en production, I7).
    const reponse = await request.get(`http://127.0.0.1:${PORT}/co/actualites?page=2`, {
      headers: { host: `valvert.corsica:${PORT}` },
      maxRedirects: 0,
    })
    expect(reponse.status()).toBe(308)
    expect(reponse.headers()['location']).toMatch(/^(http:\/\/valvert\.corsica:\d+)?\/actualites\?page=2$/)
    const fr = await request.get(`${FR}/fr`, { maxRedirects: 0 })
    expect(fr.status()).toBe(308)
  })

  test('/co sans barre finale : l’accueil corse', async ({ page }) => {
    const reponse = await page.goto(`${FR}/co`)
    expect(reponse?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Benvenuti à Valverde')
  })

  test('aucun JavaScript ajouté pour le multilingue', async ({ page }) => {
    const scripts = async (url: string) => {
      await page.goto(url)
      return page
        .locator('script[src]')
        .evaluateAll((s) => s.map((e) => (e as HTMLScriptElement).src).filter((src) => !src.includes('/_next/')))
    }
    expect(await scripts(`${FR}/co/marche`)).toEqual(await scripts(`${FR}/marche`))
  })
})
