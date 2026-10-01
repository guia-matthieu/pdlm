import { expect, test } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Connexion réelle d'un mandataire (compte semé par `npm run seed`) : prouve
 * que la stratégie d'authentification charge bien les lignes calculées
 * (hooks/lignesMandat.ts) et que le plugin les applique.
 */
const MANDATAIRE = { email: 'mandataire@cc-val.fr', motDePasse: 'demo1234' }

test.describe('Admin Payload — mandataire', () => {
  test.beforeEach(async ({ page }) => {
    await connecterAdmin(page, MANDATAIRE)
  })

  test('voit la commune mandante et pas les autres', async ({ page }) => {
    await page.goto('/admin/collections/communes')
    const tableau = page.locator('table')
    await expect(tableau.getByRole('link', { name: 'Saint-Exupéry-les-Bains' })).toBeVisible()
    await expect(tableau.getByRole('link', { name: 'Valvert' })).toHaveCount(0)
  })

  test('ne voit que son propre compte (D3)', async ({ page }) => {
    await page.goto('/admin/collections/users')
    const tableau = page.locator('table')
    await expect(tableau.getByText(MANDATAIRE.email, { exact: true })).toBeVisible()
    await expect(tableau.getByText('admin@saint-ex.fr', { exact: true })).toHaveCount(0)
  })

  test('ouvre le formulaire de création de page', async ({ page }) => {
    await page.goto('/admin/collections/pages/create')
    await expect(page.locator('#field-titre')).toBeVisible()
  })
})

test.describe('Admin Payload — rédacteur', () => {
  test('ouvre le formulaire de création de page', async ({ page }) => {
    await connecterAdmin(page, { email: 'redacteur@saint-ex.fr', motDePasse: 'demo1234' })
    await page.goto('/admin/collections/pages/create')
    await expect(page.locator('#field-titre')).toBeVisible()
  })
})

test.describe('Admin Payload — admin de commune', () => {
  test('ouvre le formulaire de création de mandat', async ({ page }) => {
    await connecterAdmin(page, { email: 'admin@saint-ex.fr', motDePasse: 'demo1234' })
    await page.goto('/admin/collections/mandats/create')
    await expect(page.locator('#field-organisation')).toBeVisible()
  })
})
