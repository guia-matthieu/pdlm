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
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

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

/*
 * Verrou documentaire de Payload (5 minutes par défaut) : posé à la première
 * modification du formulaire, il n’est libéré qu’à l’enregistrement, à la
 * navigation interne ou à son expiration — jamais par la fermeture brutale
 * du navigateur, qui est celle de Playwright en fin de test. Un test qui
 * touche un champ sans enregistrer laisse donc un verrou frais qui rend le
 * formulaire inerte pour le compte suivant sur la même commune. Mêmes
 * appels que le bouton du client admin (unlockDocument, DocumentInfo) :
 * lire le verrou de la commune, le supprimer.
 */
async function libererVerrou(page: Page, communeId: string) {
  const verrous = await apiCommunes(
    page,
    `/api/payload-locked-documents?where[document.relationTo][equals]=communes&where[document.value][equals]=${communeId}&limit=1`,
  )
  expect(verrous.ok, verrous.corps).toBe(true)
  const docs = JSON.parse(verrous.corps).docs
  if (docs.length > 0) {
    const suppression = await apiCommunes(page, `/api/payload-locked-documents/${docs[0].id}`, {
      method: 'DELETE',
    })
    expect(suppression.ok, suppression.corps).toBe(true)
  }
}

/*
 * Même aide que frise-admin.e2e.spec.ts : ouvrir la fiche de la commune sur
 * l’onglet Apparence, données chargées (le select Gabarit montre le défaut
 * du seed) et rafale de rendus serveur passée (networkidle — voir la
 * raison détaillée là-bas).
 */
async function ouvrirApparence(page: Page, communeId: string) {
  await page.goto(`/admin/collections/communes/${communeId}`)

  // Un verrou étranger pas encore expiré (run précédent tué avant ses 5
  // minutes) ouvre une modale lecture seule qui avale tous les clics. Elle
  // n’est pas dans le HTML servi : DocumentLocked l’ouvre par effet client
  // ~400 ms après le rendu (Edit/index.js:447 → useEffect), donc n’importe
  // quel clic qui suit le chargement peut la laisser passer. On l’attend
  // bornée avant d’y aller, puis on reprend la main comme le ferait
  // l’opérateur devant un collègue parti sans fermer sa session.
  const reprise = page.locator('#document-locked-take-over')
  try {
    await reprise.waitFor({ state: 'visible', timeout: 3_000 })
  } catch {
    // Aucun verrou frais sur la commune : rien à reprendre.
  }
  if (await reprise.isVisible()) {
    await reprise.click()
  }

  await page.getByRole('button', { name: 'Apparence', exact: true }).click()
  await expect(page.locator('#field-apparence__gabarit .react-select--single-value')).toHaveText(
    'Village',
  )
  await page.waitForLoadState('networkidle')
}

/*
 * Ce fichier lit l’état du seed : saint-ex au gabarit « Village », attendu au
 * select de la fiche et dans la feuille servie par l’aperçu. La base de dev
 * est partagée entre worktrees — une session interrompue avant sa remise en
 * état peut y laisser un autre gabarit et faire échouer quatre tests sur
 * l’état de départ, pas sur l’aperçu (docs/qc/bloque-integration.md). Le
 * fichier pose donc lui-même son état attendu avant les tests, et remet le
 * gabarit trouvé à la fin.
 */
let gabaritInitial: string | null | undefined

/*
 * PATCH du gabarit puis relecture, en opérateur : le gabarit lui est réservé
 * (Décision 15) — PATCHé par l’admin de la commune, le champ serait retiré en
 * silence et l’update répondrait quand même 200. Le corps relu, pas le code,
 * prouve donc la valeur réellement posée.
 */
async function poserGabarit(page: Page, communeId: string, gabarit: string | null) {
  const pose = await apiCommunes(page, `/api/communes/${communeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apparence: { gabarit } }),
  })
  expect(pose.ok, pose.corps).toBe(true)
  const relecture = await apiCommunes(page, `/api/communes/${communeId}?depth=0`)
  expect(relecture.ok, relecture.corps).toBe(true)
  expect(JSON.parse(relecture.corps).apparence?.gabarit ?? null).toBe(gabarit)
  await libererVerrou(page, communeId)
}

test.beforeAll(async ({ browser }) => {
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  try {
    await connecterAdmin(page, OPERATEUR)
    const communeId = await idSaintEx(page)
    const lecture = await apiCommunes(page, `/api/communes/${communeId}?depth=0`)
    expect(lecture.ok, lecture.corps).toBe(true)
    gabaritInitial = JSON.parse(lecture.corps).apparence?.gabarit ?? null

    await poserGabarit(page, communeId, 'village')
  } finally {
    await contexte.close()
  }
})

test.afterAll(async ({ browser }) => {
  // beforeAll tombé avant la lecture : rien n’a été posé, rien à remettre.
  if (gabaritInitial === undefined) return
  const contexte = await browser.newContext()
  const page = await contexte.newPage()
  try {
    await connecterAdmin(page, OPERATEUR)
    const communeId = await idSaintEx(page)
    await poserGabarit(page, communeId, gabaritInitial)
  } finally {
    await contexte.close()
  }
})

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

test.describe('Aperçu d’apparence — onglet de l’admin', () => {
  test('admin : aperçu en direct, sans écriture tant qu’on n’enregistre pas', async ({ page }) => {
    await connecterAdmin(page, ADMIN_COMMUNE)
    const communeId = await idSaintEx(page)
    await ouvrirApparence(page, communeId)

    try {
      // Le viseur est là, l’iframe charge l’aperçu de cette commune avec les
      // valeurs du formulaire : la principale de la base (#264653, défaut SQL
      // posé à la création par le seed, avant que la migration gabarits ne le
      // retire) et le gabarit par défaut.
      await expect(page.locator('#apercu-apparence')).toBeVisible()
      const iframe = page.locator('#apercu-apparence iframe')
      await expect(iframe).toBeVisible()
      await expect(iframe).toHaveAttribute('src', new RegExp(`commune=${communeId}`))
      await expect(page.frameLocator('#apercu-apparence iframe').locator('.canevas-apercu')).toBeVisible()

      // « en direct, sans enregistrer » se prouve au réseau : aucune écriture
      // vers l’API des communes pendant tout l’ajustement qui suit.
      let ecritures = 0
      page.on('request', (req) => {
        if (req.method() !== 'GET' && new URL(req.url()).pathname.startsWith('/api/communes')) {
          ecritures += 1
        }
      })

      // Une frappe dans le champ accent suit dans l’adresse de l’iframe,
      // après l’anti-rebond (l’assertion réessaie jusqu’à l’arrivée).
      await page.locator('#field-apparence__couleurAccent').fill('#ABCDEF')
      await expect(iframe).toHaveAttribute('src', /accent=%23abcdef/)
      // … et l’aperçu rendu dans l’iframe suit (I29 : minuscules).
      await expect(
        page.frameLocator('#apercu-apparence iframe').locator('.canevas-apercu'),
      ).toBeVisible()

      // Une pastille d’accord remplace l’accent du formulaire d’un clic.
      const pastille = page.locator('#apercu-apparence [data-accord]').first()
      const couleurPastille = (await pastille.getAttribute('data-accord')) ?? ''
      expect(couleurPastille).toMatch(/^#[0-9a-fA-F]{6}$/)
      await pastille.click()
      await expect(page.locator('#field-apparence__couleurAccent')).toHaveValue(couleurPastille)
      await expect(iframe).toHaveAttribute(
        'src',
        new RegExp(`accent=%23${couleurPastille.slice(1).toLowerCase()}`),
      )

      // La bascule de largeur change le viseur, sans recharger l’aperçu.
      await page.getByRole('button', { name: 'Mobile 390 px' }).click()
      await expect(page.locator('#apercu-apparence [data-largeur]')).toHaveAttribute(
        'data-largeur',
        '390',
      )
      await page.getByRole('button', { name: 'Ordinateur 1440 px' }).click()
      await expect(page.locator('#apercu-apparence [data-largeur]')).toHaveAttribute(
        'data-largeur',
        '1440',
      )

      // La bande de contrôle des contrastes rend la dérivation lisible, et la
      // mention prévient que photo d’accueil et contenus ne sont pas dans
      // l’aperçu tant que rien n’est enregistré.
      await expect(page.locator('#apercu-apparence .contrastes')).toBeVisible()
      await expect(page.locator('#apercu-apparence .contrastes [data-role]')).toHaveCount(11)
      await expect(page.getByText('visibles après enregistrement')).toBeVisible()

      expect(ecritures, 'aucune écriture API pendant l’aperçu').toBe(0)
    } finally {
      // Les frappes de ce test ont posé un verrou documentaire qu’aucun
      // enregistrement ne viendra libérer (c’est le point du test) : sans
      // ce ménage, la modale lecture seule bloquerait le test suivant.
      await libererVerrou(page, communeId)
    }
  })

  test('admin : une couleur forcée est marquée et alertée dans la bande des contrastes', async ({
    page,
  }) => {
    await connecterAdmin(page, ADMIN_COMMUNE)
    const communeId = await idSaintEx(page)
    await ouvrirApparence(page, communeId)

    try {
      // Avant toute force, la ligne du texte courant ne porte pas la mention.
      const ligneTexte = page.locator(
        '#apercu-apparence .contrastes [data-role="texte et liens sur blanc"]',
      )
      await expect(ligneTexte).toBeVisible()
      await expect(ligneTexte).not.toContainText('forcée, sous votre responsabilité')

      // Forcer la couleur du texte. Le panneau est replié à l’ouverture de
      // l’onglet (initCollapsed, Communes.ts) et son bouton ne porte que le
      // nom générique « Bloc bascule » : c’est le collapsible entier
      // qui porte le libellé. Vu en dev : le clic atterrit sans toujours ouvrir — le
      // re-rendu qui suit peut replanter le panneau replié, d’où l’ouverture vérifiée avant la frappe.
      const basculeAvances = page
        .locator('.collapsible', { hasText: 'Réglages avancés' })
        .locator('.collapsible__toggle')
      const champTexteForce = page.locator('#field-apparence__couleursForcees__texte')
      await basculeAvances.click()
      try {
        await champTexteForce.waitFor({ state: 'visible', timeout: 3_000 })
      } catch {
        await basculeAvances.click()
        await champTexteForce.waitFor({ state: 'visible' })
      }
      await champTexteForce.fill('#aaaaaa')

      // La ligne bascule : la valeur forcée est servie telle quelle (gris
      // clair sur blanc, sous le seuil), marquée « forcée », et l’alerte
      // l’annonce avec le ratio réellement obtenu.
      await expect(ligneTexte).toContainText('2,32:1 (seuil 4,50:1)')
      await expect(ligneTexte).toContainText('forcée, sous votre responsabilité')
      const alerte = page.locator('#apercu-apparence [role="alert"]', {
        hasText: 'Texte et liens sur blanc',
      })
      await expect(alerte).toHaveText('Texte et liens sur blanc : 2,32:1, illisible')
    } finally {
      await libererVerrou(page, communeId)
    }
  })

  test('opérateur : le gabarit basculé est servi dans l’aperçu', async ({ page }) => {
    await connecterAdmin(page, OPERATEUR)
    const communeId = await idSaintEx(page)

    let apercuVerifie = false
    try {
      await ouvrirApparence(page, communeId)
      const iframe = page.locator('#apercu-apparence iframe')
      await expect(iframe).toBeVisible()

      // Bascule du select Gabarit sur Littoral : l’adresse de l’iframe suit,
      // et c’est la feuille du gabarit Littoral qui habille l’accueil rendu.
      await page.locator('#field-apparence__gabarit .rs__control').click()
      await page.getByRole('option', { name: 'Littoral' }).click()
      await expect(iframe).toHaveAttribute('src', /gabarit=littoral/)
      await expect(
        page.frameLocator('#apercu-apparence iframe').locator('link[href="/gabarits/littoral/theme.css"]'),
      ).toHaveCount(1)

      apercuVerifie = true
    } finally {
      // L’état du seed est remis tel qu’avant le test (gabarit village).
      // Même précaution que frise-admin.e2e.spec.ts : un échec ici ne masque
      // pas l’erreur d’origine.
      const restaure = await apiCommunes(page, `/api/communes/${communeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apparence: { gabarit: 'village' } }),
      })
      if (!restaure.ok) {
        const message = `état du seed non remis (${restaure.statut}) : ${restaure.corps}`
        if (apercuVerifie) throw new Error(message)
        console.error(message, '— signalé sans masquer l’erreur d’origine du test')
      }

      // La bascule du gabarit a posé un verrou. Le PATCH de restauration le
      // libère déjà (l’update supprime les verrous du document en base,
      // checkDocumentLockStatus) ; ce ménage n’agit que s’il a échoué.
      await libererVerrou(page, communeId)
    }
  })
})
