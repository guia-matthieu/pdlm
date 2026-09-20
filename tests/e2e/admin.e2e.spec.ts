import { expect, test } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Compte opérateur créé par `npm run seed` (src/seed/index.ts). Mot de passe de
 * démonstration, base jetable — jamais un identifiant de production.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

test.describe('Admin Payload', () => {
  test.beforeEach(async ({ page }) => {
    await connecterAdmin(page, OPERATEUR)
  })

  test('la liste des communes montre les communes semées', async ({ page }) => {
    await page.goto('/admin/collections/communes')

    // Ciblé sur les liens du tableau : hors du tableau, le sélecteur de commune
    // du plugin multi-tenant répète ces noms, et la colonne « slug » contient
    // « valvert », que getByText('Valvert') matcherait aussi.
    const tableau = page.locator('table')
    await expect(tableau.getByRole('link', { name: 'Saint-Exupéry-les-Bains' })).toBeVisible()
    await expect(tableau.getByRole('link', { name: 'Valvert' })).toBeVisible()
  })

  test('la liste des utilisateurs est accessible à l’opérateur', async ({ page }) => {
    await page.goto('/admin/collections/users')

    // Payload ajoute ?depth=1&limit=10 après le montage : une ancre $ ne passerait
    // que si l'assertion devançait cet ajout — un test vert par hasard.
    await expect(page).toHaveURL(/\/admin\/collections\/users(\?|$)/)
    await expect(page.locator('table').getByText(OPERATEUR.email, { exact: true })).toBeVisible()
  })

  test("le formulaire de création d'actualité s'ouvre", async ({ page }) => {
    await page.goto('/admin/collections/actualites/create')

    await expect(page.locator('#field-titre')).toBeVisible()
  })
})

test.describe('Admin Payload — sans session', () => {
  test('une collection est inaccessible sans connexion', async ({ page }) => {
    await page.goto('/admin/collections/communes')

    // Payload renvoie vers la connexion, avec le retour demandé en paramètre.
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
