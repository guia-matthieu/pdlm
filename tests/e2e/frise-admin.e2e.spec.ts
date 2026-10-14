import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Frise du territoire dans l'admin (spec § 3, tâche 7 du plan
 * gabarits-couleurs) : l'opérateur compose la frise pièce par pièce —
 * l'aperçu se dessine en direct depuis l'état du formulaire, sans
 * enregistrer. Une pièce hors kit est signalée par son nom et la ligne
 * reste en base après enregistrement (Review Focus 4 : changer de gabarit
 * ne perd rien). Pour l'admin de commune, la frise reste à l'opérateur
 * (décision 15) : champ en lecture seule. Contre les données de
 * `npm run seed` — la commune saint-ex n'a ni gabarit posé (défaut
 * village) ni pièce de frise.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const ADMIN_COMMUNE = { email: 'admin@saint-ex.fr', motDePasse: 'demo1234' }

/*
 * Même aide que couleurs.e2e.spec.ts : les appels API partent du navigateur
 * lui-même — le fetch de la page porte la session (cookie) ET ses propres
 * en-têtes, que la protection CSRF de Payload accepte.
 */
async function apiCommunes(page: Page, chemin: string, init?: RequestInit) {
  return page.evaluate(
    async ({ chemin, init }) => {
      const r = await fetch(chemin, { credentials: 'include', ...init })
      return { ok: r.ok, statut: r.status, corps: await r.text() }
    },
    { chemin, init },
  )
}

/** Ouvre la fiche de la commune donnée sur l'onglet Apparence. */
async function ouvrirApparence(page: Page, commune: { id: string }) {
  await page.goto(`/admin/collections/communes/${commune.id}`)
  await page.getByRole('button', { name: 'Apparence', exact: true }).click()

  // Les données de la fiche sont là : le select Gabarit montre le défaut du
  // seed (village), pas un champ vide en attente de chargement.
  await expect(page.locator('#field-apparence__gabarit .react-select--single-value')).toHaveText(
    'Village',
  )

  // Ouvrir l'onglet déclenche une rafale de rendus serveur de la page (RSC) :
  // chacun re-render la vue et réinitialise le formulaire (REPLACE_STATE sur
  // initialState, Form/index.js). Cliquer « Ajouter » dans la rafale fait
  // écraser la rangée à peine ajoutée. On attend que le réseau se calme
  // (500 ms sans requête) avant de rendre la main à l'appelant.
  await page.waitForLoadState('networkidle')
}

test.describe('Frise — composition par l’opérateur', () => {
  test('aperçu en direct, pièces hors kit signalées, ligne conservée en base', async ({ page }) => {
    await connecterAdmin(page, OPERATEUR)
    const communes = await apiCommunes(page, '/api/communes?where[slug][equals]=saint-ex&limit=1')
    expect(communes.ok, communes.corps).toBe(true)
    const commune = JSON.parse(communes.corps).docs[0]

    let apercuVerifie = false
    try {
      await ouvrirApparence(page, commune)

      // Le seed ne pose pas de frise : l'aperçu est là, vide.
      await expect(page.locator('#frise-apercu')).toBeVisible()
      await expect(page.locator('#frise-apercu svg')).toHaveCount(0)

      // « sans enregistrer » se prouve au réseau : aucune écriture vers
      // l'API des communes pendant que l'aperçu se dessine.
      let ecritures = 0
      page.on('request', (req) => {
        if (req.method() !== 'GET' && new URL(req.url()).pathname.startsWith('/api/communes')) {
          ecritures += 1
        }
      })

      await page.getByRole('button', { name: 'Ajouter Pièce de frise' }).click()
      await page.locator('#field-apparence__frise__0__piece').fill('eglise')
      await page.locator('#field-apparence__frise__0__taille .rs__control').click()
      await page.getByRole('option', { name: 'Grande' }).click()

      // Le SVG apparaît sans quitter le formulaire ni enregistrer.
      await expect(page.locator('#frise-apercu svg')).toBeVisible()
      expect(ecritures, 'aucune écriture API pendant l’aperçu').toBe(0)
      apercuVerifie = true

      // Pièce hors kit, puis bascule sur Littoral — aucun kit Littoral au
      // registre avant la tâche 8 (décision 18) : la pièce est ignorée, la
      // frise disparaît, l'avertissement la nomme (Review Focus 4).
      await page.locator('#field-apparence__frise__0__piece').fill('sapin')
      await page.locator('#field-apparence__gabarit .rs__control').click()
      await page.getByRole('option', { name: 'Littoral' }).click()

      await expect(page.locator('#frise-apercu svg')).toHaveCount(0)
      await expect(
        page
          .locator('#frise-apercu')
          .getByText('Pièces absentes du gabarit Littoral, ignorées : sapin'),
      ).toBeVisible()

      // La ligne saisie reste en base après enregistrement : l'admin ne
      // purge jamais une pièce hors kit (I30, « changer de gabarit ne perd
      // rien »).
      const enregistre = page.waitForResponse(
        (res) =>
          res.request().method() === 'PATCH' &&
          new URL(res.url()).pathname === `/api/communes/${commune.id}` &&
          res.ok(),
      )
      await page.locator('#action-save').click()
      await enregistre

      const apres = await apiCommunes(page, `/api/communes/${commune.id}?depth=0`)
      expect(apres.ok, apres.corps).toBe(true)
      const communeApres = JSON.parse(apres.corps)
      expect(communeApres.apparence.gabarit).toBe('littoral')
      expect(communeApres.apparence.frise).toHaveLength(1)
      expect(communeApres.apparence.frise[0].piece).toBe('sapin')
      expect(communeApres.apparence.frise[0].taille).toBe('grande')
    } finally {
      // L'état du seed est remis tel qu'avant le test (gabarit village,
      // frise vide). Même précaution que couleurs.e2e.spec.ts : un échec
      // ici ne masque pas l'erreur d'origine.
      const restaure = await apiCommunes(page, `/api/communes/${commune.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apparence: { gabarit: 'village', frise: [] } }),
      })
      if (!restaure.ok) {
        const message = `état du seed non remis (${restaure.statut}) : ${restaure.corps}`
        if (apercuVerifie) throw new Error(message)
        console.error(message, '— signalé sans masquer l’erreur d’origine du test')
      }
    }
  })
})

test.describe('Frise — lecture seule pour l’admin de commune', () => {
  test('le bouton d’ajout de pièce n’est pas rendu', async ({ page }) => {
    await connecterAdmin(page, ADMIN_COMMUNE)
    const communes = await apiCommunes(page, '/api/communes?where[slug][equals]=saint-ex&limit=1')
    expect(communes.ok, communes.corps).toBe(true)
    const commune = JSON.parse(communes.corps).docs[0]

    await ouvrirApparence(page, commune)

    // Décision 15 : la frise reste à l'opérateur. `access.update: false` sur
    // le champ → Payload rend le champ en lecture seule, sans bouton d'ajout
    // (fields/Array/index.js : `!hasMaxRows && !readOnly && <Button …>`).
    await expect(page.locator('#field-apparence__frise')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ajouter Pièce de frise' })).toHaveCount(0)
  })
})
