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
 * Les appels API partent du navigateur lui-même : le fetch de la page porte la
 * session (cookie) ET ses propres en-têtes, que la protection CSRF de Payload
 * accepte — un contexte de requête Playwright (page.request) n'envoie pas
 * d'Origin et essuie un 403 sur un cookie sans Origin.
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

/** Valeur exacte d'une variable CSS posée sur <body> (suffixe d'espacement retiré). */
async function variableDuCorps(page: Page, nom: string): Promise<string> {
  return page.evaluate((n) => getComputedStyle(document.body).getPropertyValue(n).trim(), nom)
}

/** Contraste WCAG 2.x entre deux couleurs calculées (« rgb(r, g, b) »). */
function contrasteWcag(a: string, b: string): number {
  const composants = (v: string) => (v.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)
  const lin = (c: number) => {
    const x = c / 255
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const lum = (v: string) => {
    const [r, g, b] = composants(v)
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  }
  const [claire, sombre] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (claire + 0.05) / (sombre + 0.05)
}

test.describe('Couleurs — le site public sert les variables dérivées', () => {
  test('sans couleur saisie : contrat par défaut sur <body>, l’alias colore les liens', async ({
    page,
  }) => {
    await page.goto('/')

    // I23 : les dérivées ne sont jamais stockées, recalculées à chaque rendu.
    // Sans saisie, la principale sûre vaut le défaut ardoise.
    expect(await variableDuCorps(page, '--principale-sure')).toBe('#264653')

    // Les quatre alias résolus aux valeurs dérivées par défaut (sortie du
    // prototype épinglée en tests unitaires : pale #e6f7fe, accent #e2a72e ;
    // erreur = fixe --alerte).
    expect(await variableDuCorps(page, '--couleur-principale')).toBe('#264653')
    expect(await variableDuCorps(page, '--couleur-accent')).toBe('#e2a72e')
    expect(await variableDuCorps(page, '--couleur-fond-alt')).toBe('#e6f7fe')
    expect(await variableDuCorps(page, '--couleur-erreur')).toBe('#b3261e')

    // L'alias --couleur-principale colore réellement les liens sur fond blanc
    // (#264653 = rgb(38, 70, 83)). Sonde : le titre d'une actualité dans la
    // liste des actualités, lien sans règle de couleur propre, dans une page
    // intérieure qu'aucun gabarit ne met en forme (le titre de l'en-tête, lui,
    // est coloré par le thème du gabarit — encre dans Village).
    await page.goto('/actualites')
    const couleurLien = await page.evaluate(() => {
      const a = document.querySelector('.carte-actu h2 a')
      return a ? getComputedStyle(a).color : ''
    })
    expect(couleurLien).toBe('rgb(38, 70, 83)')
  })

  test('une couleur saisie dans l’admin est servie dérivée sur le site', async ({ page }) => {
    await connecterAdmin(page, OPERATEUR)
    const communes = await apiCommunes(page, '/api/communes?where[slug][equals]=saint-ex&limit=1')
    expect(communes.ok, communes.corps).toBe(true)
    const commune = JSON.parse(communes.corps).docs[0]
    const avant = commune.apparence?.couleurPrincipale ?? null

    let corpsVerifie = false
    try {
      const patch = await apiCommunes(page, `/api/communes/${commune.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apparence: { couleurPrincipale: '#7fc8a0' } }),
      })
      expect(patch.ok, patch.corps).toBe(true)

      await page.goto('/')
      // #7fc8a0 (1,97:1 sur blanc) est assombrie jusqu'à 4,5:1 : #3c8460,
      // valeur du prototype couleurs.py épinglée en tests unitaires.
      expect(await variableDuCorps(page, '--principale-sure')).toBe('#3c8460')

      // Décision 17 : sur fond pâle (le pied de page), un lien est en encre,
      // pas en principale — #3c8460 tient 4,50:1 sur blanc mais ≈ 4,1 sur le
      // pâle. Le contraste est mesuré dans la page rendue.
      const pied = await page.evaluate(() => {
        const lien = document.querySelector('.pied-page__mentions a')
        const zone = document.querySelector('.pied-page')
        return {
          couleurLien: lien ? getComputedStyle(lien).color : '',
          fond: zone ? getComputedStyle(zone).backgroundColor : '',
        }
      })
      expect(pied.couleurLien, 'un lien du pied de page').not.toBe('')
      expect(contrasteWcag(pied.couleurLien, pied.fond)).toBeGreaterThanOrEqual(4.5)
      corpsVerifie = true
    } finally {
      // L'état du seed est remis tel qu'avant le test. Un échec ici ne doit pas
      // masquer l'erreur d'origine : il ne fait échouer le test que si le corps
      // est passé ; sinon il est signalé sans relancer l'assertion.
      const restaure = await apiCommunes(page, `/api/communes/${commune.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apparence: { couleurPrincipale: avant } }),
      })
      if (!restaure.ok) {
        const message = `état du seed non remis (${restaure.statut}) : ${restaure.corps}`
        if (corpsVerifie) throw new Error(message)
        console.error(message, '— signalé sans masquer l’erreur d’origine du test')
      }
    }
  })
})
