import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Mesure d'audience, contre les données de `npm run seed` et le faux Umami
 * de global-setup.ts. La commune `saint-ex` est activée par l'API REST avec
 * le compte opérateur de démonstration, puis coupée à la fin.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', password: 'demo1234' }
const BALISE = 'script[src="/mesure/script.js"]'

let jeton = ''
let communeId = 0

async function basculer(request: APIRequestContext, active: boolean) {
  const r = await request.patch(`/api/communes/${communeId}`, {
    headers: { Authorization: `JWT ${jeton}` },
    data: { mesure: { active } },
  })
  expect(r.ok(), await r.text()).toBe(true)
}

test.describe('Mesure d’audience', () => {
  test.beforeAll(async ({ request }) => {
    const script = await request.get('/mesure/script.js')
    if (script.status() === 404) {
      // Serveur réutilisé sans UMAMI_URL : en CI, c'est une erreur ; en local, un signalement.
      expect(
        process.env.CI,
        'le serveur e2e doit recevoir UMAMI_URL (playwright.config.ts)',
      ).toBeFalsy()
      test.skip(
        true,
        'serveur de développement réutilisé sans UMAMI_URL — arrêter `next dev` et relancer',
      )
    }
    const connexion = await request.post('/api/users/login', { data: OPERATEUR })
    jeton = (await connexion.json()).token
    const communes = await request.get('/api/communes?where[slug][equals]=saint-ex&limit=1', {
      headers: { Authorization: `JWT ${jeton}` },
    })
    communeId = (await communes.json()).docs[0].id
    await basculer(request, true)
  })

  test.afterAll(async ({ request }) => {
    if (jeton) await basculer(request, false)
  })

  // Le faux Umami sert SCRIPT_FAUX, qui poste comme le vrai script : ce test prouve la chaîne
  // balise → relais ; le vrai script d'Umami est éprouvé à la recette (tâche 15).
  test('une commune mesurée porte la balise, qui poste au relais du domaine', async ({ page }) => {
    const envoi = page.waitForRequest(
      (r) => r.url().endsWith('/mesure/api/send') && r.method() === 'POST',
    )
    await page.goto('/')
    const balise = page.locator(BALISE)
    await expect(balise).toHaveCount(1)
    await expect(balise).toHaveAttribute('data-website-id', /^[0-9a-f-]{36}$/)
    await expect(balise).toHaveAttribute('data-host-url', '/mesure')
    await envoi
  })

  test('un formulaire d’un autre site ne lève pas l’opposition (navigateur réel)', async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto('/mesure-d-audience')
    await page.getByRole('button', { name: 'Refuser la mesure' }).click()
    // Scopé à <main> : le bandeau d'alertes du pied de page semé pour saint-ex
    // porte aussi role="status" (BandeauAlerte, niveau non-urgence).
    await expect(page.getByRole('main').getByRole('status')).toContainText('Vous vous êtes opposé')

    // Page hostile servie par interception, hors de la CSP de pdlm (sinon
    // `form-action 'self'` bloquerait l'envoi et le test passerait pour une
    // mauvaise raison). Elle soumet d'elle-même le formulaire vers pdlm.
    await page.route('http://hostile.test/', (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: `<form method="post" action="${baseURL}/mesure/opposition">
          <input name="choix" value="accepte"></form>
          <script>document.forms[0].submit()</script>`,
      }),
    )
    const reponse = page.waitForResponse((r) => r.url().endsWith('/mesure/opposition'))
    await page.goto('http://hostile.test/')
    expect((await reponse).status()).toBe(403)
    const cookies = await context.cookies(baseURL)
    expect(cookies.find((c) => c.name === 'pdlm_mesure')?.value).toBe('refus')

    // Remise dans l'état initial pour les autres tests
    await page.goto('/mesure-d-audience')
    await page.getByRole('button', { name: 'Accepter la mesure' }).click()
  })

  test.describe('sans JavaScript', () => {
    // L'opposition doit fonctionner sans JavaScript (spec, section 4).
    // `test.use` garde la baseURL de la configuration (un browser.newContext() nu la perdrait).
    test.use({ javaScriptEnabled: false })

    test('refuser par le formulaire retire la balise ; accepter la remet', async ({ page }) => {
      await page.goto('/mesure-d-audience')
      await page.getByRole('button', { name: 'Refuser la mesure' }).click()
      await expect(page).toHaveURL(/\/mesure-d-audience$/)
      // Scopé à <main> : voir la remarque ci-dessus sur le bandeau d'alertes.
      await expect(page.getByRole('main').getByRole('status')).toContainText(
        'Vous vous êtes opposé',
      )
      await page.goto('/')
      await expect(page.locator(BALISE)).toHaveCount(0)

      await page.goto('/mesure-d-audience')
      await page.getByRole('button', { name: 'Accepter la mesure' }).click()
      await page.goto('/')
      await expect(page.locator(BALISE)).toHaveCount(1)
    })
  })

  test('la page est atteinte depuis le pied de page et utilisable au clavier', async ({ page }) => {
    await page.goto('/')
    const lien = page.locator('footer').getByRole('link', { name: 'Mesure d’audience' })
    await lien.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/mesure-d-audience$/)
    await expect(page.locator('h1')).toHaveText('Mesure d’audience')

    const bouton = page.getByRole('button', { name: 'Refuser la mesure' })
    await bouton.focus()
    await expect(bouton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Accepter la mesure' })).toBeVisible()
    // Remise dans l'état initial pour les autres tests
    await page.getByRole('button', { name: 'Accepter la mesure' }).click()
  })
})
