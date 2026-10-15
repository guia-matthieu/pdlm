import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Aperçu d’apparence (spec gabarits-couleurs § 4, tâche 9) : /apercu/apparence
 * sert l’accueil composé par le gabarit avec les paramètres d’adresse validés —
 * à l’opérateur et à l’admin de la commune (I28), sous le domaine de la
 * plateforme seul (décision 13). Ses en-têtes doivent différer du reste du
 * site : cette page existe pour être encadrée par l’onglet Apparence de
 * l’admin (frame-ancestors 'self'), et ne doit être ni mise en cache ni
 * indexée — un aperçu de réglages non enregistrés qui fuirait dans un cache
 * ou un index serait une publication déguisée. Contre les données de
 * `npm run seed` — la commune saint-ex n’a ni couleur saisie ni gabarit posé
 * (défaut village).
 */
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

/** L’identifiant de la commune saint-ex, lu par l’admin de cette commune. */
async function idSaintEx(page: Page): Promise<string> {
  const communes = await apiCommunes(page, '/api/communes?where[slug][equals]=saint-ex&limit=1')
  expect(communes.ok, communes.corps).toBe(true)
  return JSON.parse(communes.corps).docs[0].id
}

test.describe('Aperçu d’apparence — accès et en-têtes', () => {
  test('anonyme : 404, même pour une commune qui existe (I28)', async ({ page }) => {
    await connecterAdmin(page, ADMIN_COMMUNE)
    const id = await idSaintEx(page)

    // Plus de session : la même adresse, l’identifiant réel d’une commune
    // existante — le refus vient de l’accès, pas d’un document absent.
    await page.context().clearCookies()
    const reponse = await page.goto(`/apercu/apparence?commune=${id}`)
    expect(reponse?.status()).toBe(404)
  })

  test('admin : l’accueil du gabarit servi, encadrable, ni en cache ni indexé', async ({
    page,
  }) => {
    await connecterAdmin(page, ADMIN_COMMUNE)
    const id = await idSaintEx(page)

    const reponse = await page.goto(`/apercu/apparence?commune=${id}&accent=%23ABCDEF`)
    expect(reponse?.status()).toBe(200)

    // En-têtes réellement servis, pas la matrice générale : l’aperçu est
    // encadrable par l’admin (même origine), jamais mis en cache, jamais
    // indexé.
    const entetes = (await reponse?.allHeaders()) ?? {}
    expect(entetes['content-security-policy']).toContain("frame-ancestors 'self'")
    // Le e2e tourne en dev, où Next pose toujours `no-cache, must-revalidate`
    // sur les réponses rendues (base-server.js:1107), écrasant le `no-store`
    // de next.config.ts. En production celui-ci s’applique, et une page
    // dynamique comme celle-ci y est de toute façon rendue avec
    // `private, no-cache, no-store, …` (lib/cache-control.js, revalidate 0).
    expect(['no-store', 'no-cache, must-revalidate']).toContain(entetes['cache-control'])
    expect(entetes['x-robots-tag']).toBe('noindex')

    // Le contenu suit : la feuille du gabarit par défaut du seed, et
    // l’accent validé (I29 : minuscules) posé en variable sur le canevas —
    // l’accent traverse deriver() tel quel, contrairement aux dérivées.
    const html = (await reponse?.text()) ?? ''
    expect(html).toContain('/gabarits/village/theme.css')
    expect(html).toContain('--accent:#abcdef')

    // I29 : rien de l’adresse ne passe tel quel dans le document servi.
    expect(html).not.toContain('javascript:')
  })

  test('le site public garde frame-ancestors none', async ({ page }) => {
    const reponse = await page.goto('/')
    const entetes = (await reponse?.allHeaders()) ?? {}
    expect(entetes['content-security-policy']).toContain("frame-ancestors 'none'")
  })
})
