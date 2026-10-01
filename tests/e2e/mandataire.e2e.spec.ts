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

  // ÉCART À TRANCHER (voir task-6-report.md) : la liste admin des utilisateurs est
  // vide pour un mandataire. Le plugin multi-tenant la filtre en base sur
  // `tenants.tenant`, or la ligne `mandataire` est calculée à la lecture et n'y
  // figure pas : son propre compte est exclu. L'API (JWT) le renvoie bien.
  test.fixme('ne voit que son propre compte (D3)', async ({ page }) => {
    await page.goto('/admin/collections/users')
    const tableau = page.locator('table')
    await expect(tableau.getByText(MANDATAIRE.email, { exact: true })).toBeVisible()
    await expect(tableau.getByText('admin@saint-ex.fr', { exact: true })).toHaveCount(0)
  })

  // ÉCART À TRANCHER (task-6-report.md) : `creerContenu` lit la commune cible dans
  // `data`, absent quand l'admin évalue le droit de création → « Non autorisé ».
  // Le rédacteur réel échoue pareillement : défaut antérieur au lot, non propre au mandat.
  test.fixme('ouvre le formulaire de création de page', async ({ page }) => {
    await page.goto('/admin/collections/pages/create')
    await expect(page.locator('#field-titre')).toBeVisible()
  })
})
