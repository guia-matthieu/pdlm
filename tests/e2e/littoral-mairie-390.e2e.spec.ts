import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Régression « littoral 390 » (docs/qc/notes-littoral-390.md) : sous la seconde
 * rupture (43,75rem), la rive mairie passe sur une colonne — une casette par
 * ligne, pleine largeur, sans défilement horizontal. Avant la correction, la
 * grille `repeat(2, auto)` de la première rupture laissait ~107px aux horaires
 * et au courriel : un mot par ligne (notes-tache-10.md l. 111 et 115). Juste
 * au-dessus de la rupture (701px), les deux colonnes doivent rester.
 *
 * Fichier séparé du spec de captures : composition minimale (gabarit,
 * coordonnées, horaires — ni photos ni frise), pour prouver le rouge avant /
 * vert après en quelques secondes sans rejouer les seize captures.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

// Mêmes coordonnées et horaires que gabarits-captures.e2e.spec.ts (littoral) :
// le courriel long y repliait la rive, c'est lui qu'on doit tenir sur une ligne.
const COORDONNEES = {
  adresse: '1 quai de la Mairie',
  codePostal: '01100',
  ville: 'Saint-Exupéry-sur-Mer',
  telephone: '03 00 00 00 00',
  email: 'mairie@saint-exupery-sur-mer.fr',
}
const HORAIRES =
  'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.'

/* Appels API depuis le navigateur (cookie de session + CSRF), comme la suite de captures. */
async function api(page: Page, chemin: string, init?: RequestInit) {
  const r = await page.evaluate(
    async ({ chemin, init }) => {
      const reponse = await fetch(chemin, { credentials: 'include', ...init })
      return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
    },
    { chemin, init },
  )
  expect(r.ok, `${chemin} → ${r.statut} : ${r.corps.slice(0, 400)}`).toBe(true)
  return r.corps ? JSON.parse(r.corps) : null
}

const json = (methode: string, corps: unknown): RequestInit => ({
  method: methode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corps),
})

/** Largeur de la zone de contenu de la rive (entre gouttières) et largeur de chaque casette. */
async function mesurerRive(page: Page) {
  const r = await page.evaluate(() => {
    const rive = document.querySelector('.section-mairie')
    if (!rive) return null
    const cs = getComputedStyle(rive)
    const contenu =
      rive.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
    return {
      contenu,
      casettes: Array.from(rive.children).map((c) => c.getBoundingClientRect().width),
      pistes: cs.gridTemplateColumns.trim().split(/\s+/),
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
  expect(r, 'la section mairie est rendue').toBeTruthy()
  return r!
}

test.describe.serial('Littoral : rive mairie sous 43,75rem', () => {
  let page: Page
  let idCommune: number
  let origine: Record<string, unknown>

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000)
    const contexte = await browser.newContext()
    page = await contexte.newPage()
    await connecterAdmin(page, OPERATEUR)

    const commune = (
      await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0')
    ).docs[0]
    idCommune = commune.id
    origine = commune
    await api(page, `/api/communes/${idCommune}`, json('PATCH', {
      apparence: { gabarit: 'littoral' },
      coordonnees: COORDONNEES,
      horaires: HORAIRES,
    }))
  })

  test.afterAll(async () => {
    if (!page) return
    try {
      const apparence = (origine.apparence ?? {}) as Record<string, unknown>
      const coordonnees = (origine.coordonnees ?? {}) as Record<string, unknown>
      await api(page, `/api/communes/${idCommune}`, json('PATCH', {
        apparence: { gabarit: apparence.gabarit ?? null },
        // Champ par champ : un groupe Payload n'accepte pas null (notes tâche 4).
        coordonnees: {
          adresse: coordonnees.adresse ?? null,
          codePostal: coordonnees.codePostal ?? null,
          ville: coordonnees.ville ?? null,
          telephone: coordonnees.telephone ?? null,
          email: coordonnees.email ?? null,
        },
        horaires: origine.horaires ?? null,
      }))
    } finally {
      await page.context().close()
    }
  })

  test('à 390 px, chaque casette occupe toute la largeur de la rive, sans défilement', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const { contenu, casettes, scrollWidth } = await mesurerRive(page)
    // Tolérance 2px : la casette remplit la zone entre gouttières.
    for (const [i, largeur] of casettes.entries()) {
      expect(largeur, `casette ${i + 1}/${casettes.length} : ${largeur}px sur ${contenu}px`).toBeGreaterThan(contenu - 2)
      expect(largeur).toBeLessThan(contenu + 2)
    }
    expect(scrollWidth, 'la page ne déborde pas du viewport').toBeLessThanOrEqual(390)
  })

  test('à 600 px, pleine largeur aussi pour l’adresse et le courriel (limite 22rem levée)', async () => {
    await page.setViewportSize({ width: 600, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const { contenu, casettes, scrollWidth } = await mesurerRive(page)
    for (const [i, largeur] of casettes.entries()) {
      expect(largeur, `casette ${i + 1}/${casettes.length} : ${largeur}px sur ${contenu}px`).toBeGreaterThan(contenu - 2)
      expect(largeur).toBeLessThan(contenu + 2)
    }
    expect(scrollWidth, 'la page ne déborde pas du viewport').toBeLessThanOrEqual(600)
  })

  test('à 701 px, juste au-dessus de la rupture, les deux colonnes restent', async () => {
    await page.setViewportSize({ width: 701, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => document.fonts.ready)

    const { contenu, casettes, pistes } = await mesurerRive(page)
    expect(pistes.length, `deux pistes de grille attendues, obtenues : ${pistes.join(' / ')}`).toBe(2)
    // Deux colonnes : aucune casette ne s'étale sur toute la largeur.
    for (const [i, largeur] of casettes.entries()) {
      expect(largeur, `casette ${i + 1}/${casettes.length} : ${largeur}px sur ${contenu}px`).toBeLessThan(contenu - 2)
    }
  })
})
