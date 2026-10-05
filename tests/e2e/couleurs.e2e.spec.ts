import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Couleurs du site public (spec § 2, tâche 3 du plan gabarits-couleurs) : le
 * layout pose sur <body> les variables dérivées par deriver() (I23), les
 * anciens noms (--couleur-principale, …) deviennent des alias. Contre les
 * données de `npm run seed` — la commune saint-ex n'a aucune couleur saisie,
 * les défauts s'appliquent donc sur l'accueil.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

/*
 * Les appels API suivent la session posée par le formulaire (cookie), mais la
 * protection CSRF de Payload refuse un cookie sans en-tête Origin — et le
 * contexte de requête de Playwright n'en pose pas. D'où l'Origin explicite,
 * calculée comme dans playwright.config.ts.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const ORIGINE = `http://localhost:${PORT}`
const API = { headers: { Origin: ORIGINE } }

/** Valeur exacte d'une variable CSS posée sur <body> (suffixe d'espacement retiré). */
async function variableDuCorps(page: Page, nom: string): Promise<string> {
  return page.evaluate((n) => getComputedStyle(document.body).getPropertyValue(n).trim(), nom)
}

test.describe('Couleurs — le site public sert les variables dérivées', () => {
  test('sans couleur saisie : contrat par défaut sur <body>, l’alias colore les liens', async ({
    page,
  }) => {
    await page.goto('/')

    // I23 : les dérivées ne sont jamais stockées, recalculées à chaque rendu.
    // Sans saisie, la principale sûre vaut le défaut ardoise.
    expect(await variableDuCorps(page, '--principale-sure')).toBe('#264653')

    // Alias : --couleur-principale suit la dérivée, un lien en prend la couleur
    // (#264653 = rgb(38, 70, 83)). Le titre de l'en-tête est un lien sans
    // règle de couleur propre — pas le lien d'évitement, blanc par design.
    const couleurLien = await page.evaluate(() => {
      const a = document.querySelector('.entete-site__titre')
      return a ? getComputedStyle(a).color : ''
    })
    expect(couleurLien).toBe('rgb(38, 70, 83)')
  })

  test('une couleur saisie dans l’admin est servie dérivée sur le site', async ({ page }) => {
    await connecterAdmin(page, OPERATEUR)
    const communes = await page.request.get('/api/communes?where[slug][equals]=saint-ex&limit=1', API)
    expect(communes.ok(), await communes.text()).toBe(true)
    const commune = (await communes.json()).docs[0]
    const avant = commune.apparence?.couleurPrincipale ?? null

    try {
      const patch = await page.request.patch(`/api/communes/${commune.id}`, {
        ...API,
        data: { apparence: { couleurPrincipale: '#7fc8a0' } },
      })
      expect(patch.ok(), await patch.text()).toBe(true)

      await page.goto('/')
      // #7fc8a0 (1,97:1 sur blanc) est assombrie jusqu'à 4,5:1 : #3c8460,
      // valeur du prototype couleurs.py épinglée en tests unitaires.
      expect(await variableDuCorps(page, '--principale-sure')).toBe('#3c8460')
    } finally {
      // L'état du seed est remis tel qu'avant le test.
      const restaure = await page.request.patch(`/api/communes/${commune.id}`, {
        ...API,
        data: { apparence: { couleurPrincipale: avant } },
      })
      expect(restaure.ok(), await restaure.text()).toBe(true)
    }
  })
})
