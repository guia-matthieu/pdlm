import { expect, test } from '@playwright/test'

/**
 * Fumigation du front public, contre les données de `npm run seed`.
 *
 * Le host local nu (localhost) est résolu en commune via DEFAULT_COMMUNE_SLUG
 * (src/lib/commune.ts, HOSTS_DEV) — ce chemin est désactivé en production, donc
 * ces tests supposent un serveur de développement.
 */
const COMMUNE = 'Saint-Exupéry-les-Bains'

test.describe('Front public', () => {
  test("l'accueil rend la page publiée de la commune résolue", async ({ page }) => {
    await page.goto('/')

    // Bloc « hero » de la page de slug « accueil » semée pour saint-ex.
    await expect(page.locator('h1')).toHaveText(`Bienvenue à ${COMMUNE}`)

    // L'en-tête porte le nom issu de la résolution host -> commune : c'est la
    // preuve que le câblage multi-host a bien eu lieu, et pas un rendu en dur.
    await expect(page.locator('.entete-site__titre')).toHaveText(COMMUNE)
  })

  test('les rubriques et les pages légales répondent 200', async ({ page }) => {
    const chemins = ['/actualites', '/agenda', '/documents', '/mentions-legales', '/accessibilite']

    for (const chemin of chemins) {
      const reponse = await page.goto(chemin)
      expect(reponse?.status(), `${chemin} doit répondre 200`).toBe(200)
    }
  })

  test("le lien d'évitement est la première cible au clavier (RGAA)", async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')

    const actif = page.locator(':focus')
    await expect(actif).toHaveAttribute('href', '#contenu')
  })
})
