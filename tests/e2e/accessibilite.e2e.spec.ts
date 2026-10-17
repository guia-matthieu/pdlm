import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { GABARITS } from '../../src/gabarits/registre'
import { connecterAdmin } from '../helpers/login'

/**
 * Accessibilité du site public entier (brief 2026-10-17) : axe doit ne rien
 * relever, sur chaque page publique, chaque gabarit du registre, deux largeurs
 * (390 et 1440 px) et trois palettes (démonstration + les deux jeux des
 * captures). L'audit d'origine (notes-accessibilite.md) n'a trouvé aucune
 * violation : cette suite est un garde-fou, elle doit rester verte.
 *
 * Contre la commune de démonstration saint-ex (localhost =
 * DEFAULT_COMMUNE_SLUG). Les slugs sont lus dans la base de dev par l'API ; la
 * page documents exige un document, créé ici si la collection est vide puis
 * supprimé et vérifié 404.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
const LARGEURS = [390, 1440] as const
/** Les deux jeux de gabarits-captures (plan, tâche 10) : principale/accent/terre. */
const JEUX = [
  { nom: '#2a7f9e', principale: '#2a7f9e', accent: '#f2b134', terre: '#d2462f' },
  { nom: '#9b3d57', principale: '#9b3d57', accent: '#7fc4c9', terre: '#e08a2c' },
] as const
const RESERVEES = ['actualites', 'agenda', 'documents', 'mesure-d-audience']

/*
 * Les appels API partent du navigateur (cookie de session + en-têtes propres,
 * acceptés par la protection CSRF) — même raison que gabarits-conformite.
 */
async function api(page: Page, chemin: string, init?: RequestInit) {
  const r = await page.evaluate(
    async ({ chemin, init }) => {
      const reponse = await fetch(chemin, { credentials: 'include', ...init })
      return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
    },
    { chemin, init },
  )
  expect(r.ok, `${chemin} → ${r.statut} : ${r.corps.slice(0, 300)}`).toBe(true)
  return JSON.parse(r.corps)
}

const json = (methode: string, corps: unknown): RequestInit => ({
  method: methode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(corps),
})

/** Passe la validation PDF de Payload : tête %PDF-, xref et %%EOF en fin. */
const PDF = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj
xref
trailer<</Root 1 0 R>>
%%EOF`

/** Audit d'une page : rendue (200, main#contenu, thème du gabarit) puis axe. */
async function auditer(page: Page, nom: string, chemin: string, largeur: number, gabarit: string) {
  await page.setViewportSize({ width: largeur, height: 800 })
  const reponse = await page.goto(chemin)
  expect(reponse?.status(), `${chemin} doit répondre 200`).toBe(200)
  await page.waitForLoadState('networkidle')
  // Prendre le bon gabarit pour acquis : le lien vers son theme.css est rendu.
  expect(
    await page.locator(`link[href*="/gabarits/${gabarit}/theme.css"]`).count(),
    `le thème ${gabarit} est bien posé`,
  ).toBeGreaterThan(0)
  await expect(page.locator('#contenu'), `${nom} rend son contenu`).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  expect(
    violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `${nom} à ${largeur} px, zéro violation WCAG`,
  ).toEqual([])
}

test('le harnais relève une image sans alt — preuve qu’un vert n’est pas vide', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => {
    document.querySelector('main')?.insertAdjacentHTML('afterbegin', '<img src="/favicon.ico">')
  })
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  // withTags inconnu → axe ne charge aucune règle et reste vert sans rien
  // tester : cette sonde est ce qui l’exclude.
  expect(violations.map((v) => v.id)).toContain('image-alt')
})

for (const [nom] of Object.entries(GABARITS)) {
  test.describe.serial(`${nom} — axe sur tout le site public`, () => {
    let page: Page
    let contexte: BrowserContext
    let idCommune: number
    let origine: { gabarit?: string | null; couleurPrincipale?: string | null; couleurAccent?: string | null; couleurTerre?: string | null }
    let cheminActu: string
    let cheminPage: string
    let idDocumentCree: number | null = null

    const patchCommune = (corps: unknown) =>
      api(page, `/api/communes/${idCommune}`, json('PATCH', corps))

    /** Pose le gabarit éprouvé et une palette donnée (null = celle d'origine). */
    const poser = (palette: Partial<{ principale: string; accent: string; terre: string }> | null) =>
      patchCommune({
        apparence: {
          gabarit: nom,
          couleurPrincipale: palette?.principale ?? origine.couleurPrincipale ?? null,
          couleurAccent: palette?.accent ?? origine.couleurAccent ?? null,
          couleurTerre: palette?.terre ?? origine.couleurTerre ?? null,
        },
      })

    test.beforeAll(async ({ browser }) => {
      // Axe exige une page née d'un contexte explicite (pas browser.newPage()).
      contexte = await browser.newContext()
      page = await contexte.newPage()
      await connecterAdmin(page, OPERATEUR)

      const commune = (
        await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0')
      ).docs[0]
      idCommune = commune.id
      origine = commune.apparence ?? {}

      // Slugs réels de la base de dev, en lecture.
      const actu = (
        await api(
          page,
          `/api/actualites?where[tenant][equals]=${idCommune}&sort=-datePublication&limit=1&depth=0`,
        )
      ).docs[0]
      expect(actu, 'une actualité publiée en base de dev').toBeTruthy()
      cheminActu = `/actualites/${actu.slug}`
      const pagesContenu = (
        await api(page, `/api/pages?where[tenant][equals]=${idCommune}&limit=20&depth=0`)
      ).docs.filter((p: { slug: string }) => p.slug !== 'accueil' && !RESERVEES.includes(p.slug))
      expect(pagesContenu.length, 'une page de contenu publiée').toBeGreaterThan(0)
      cheminPage = `/${pagesContenu[0].slug}`

      // La page documents doit montrer un vrai document : un créé si aucun.
      const documents = (
        await api(page, `/api/documents?where[tenant][equals]=${idCommune}&limit=1&depth=0`)
      ).docs
      if (documents.length === 0) {
        const r = await page.evaluate(
          async ({ pdf, commune, fichier, titre }) => {
            const corps = new FormData()
            corps.append('file', new Blob([pdf], { type: 'application/pdf' }), fichier)
            corps.append('_payload', JSON.stringify({ titre, categorie: 'autres', tenant: commune }))
            const reponse = await fetch('/api/documents', {
              method: 'POST',
              credentials: 'include',
              body: corps,
            })
            return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
          },
          {
            pdf: PDF,
            commune: idCommune,
            fichier: 'accessibilite-e2e.pdf',
            titre: 'Accessibilité e2e — document de la page documents',
          },
        )
        expect(r.ok, `création document → ${r.statut} : ${r.corps.slice(0, 300)}`).toBe(true)
        idDocumentCree = JSON.parse(r.corps).doc.id
      }
    })

    test.afterAll(async () => {
      if (!page) return
      try {
        await patchCommune({
          apparence: {
            gabarit: origine.gabarit ?? null,
            couleurPrincipale: origine.couleurPrincipale ?? null,
            couleurAccent: origine.couleurAccent ?? null,
            couleurTerre: origine.couleurTerre ?? null,
          },
        })
        // Remise en état vérifiée par GET.
        const relue = (
          await api(page, `/api/communes/${idCommune}?depth=0`)
        ).apparence
        expect(relue.gabarit).toBe(origine.gabarit ?? null)
        expect(relue.couleurPrincipale).toBe(origine.couleurPrincipale ?? null)
        expect(relue.couleurAccent).toBe(origine.couleurAccent ?? null)
        expect(relue.couleurTerre).toBe(origine.couleurTerre ?? null)
        if (idDocumentCree) {
          await api(page, `/api/documents/${idDocumentCree}`, { method: 'DELETE' })
          const statut = await page.evaluate(
            async (id) => (await fetch(`/api/documents/${id}`, { credentials: 'include' })).status,
            idDocumentCree,
          )
          expect(statut, 'document créé par la suite supprimé').toBe(404)
        }
      } finally {
        await contexte.close()
      }
    })

    // Palette de démonstration : toutes les pages, les deux largeurs.
    const PAGES: Array<[string, string]> = [
      ['accueil', '/'],
      ['actualites', '/actualites'],
      ['une actualité', ''],
      ['agenda', '/agenda'],
      ['documents', '/documents'],
      ['page de contenu', ''],
      ['mesure-d-audience', '/mesure-d-audience'],
    ]
    for (const [libelle, cheminFixe] of PAGES) {
      for (const largeur of LARGEURS) {
        test(`palette démo — ${libelle} à ${largeur} px`, async () => {
          await poser(null)
          // Slugs lus en base au beforeAll : résolus au passage, pas à la collecte.
          const chemin =
            libelle === 'une actualité' ? cheminActu : libelle === 'page de contenu' ? cheminPage : cheminFixe
          await auditer(page, `${libelle} (palette démo)`, chemin, largeur, nom)
        })
      }
    }

    // Les deux jeux des captures : accueil et une page intérieure.
    for (const jeu of JEUX) {
      for (const [libelle, cheminFixe] of [
        ['accueil', '/'],
        ['une actualité', ''],
      ] as Array<[string, string]>) {
        for (const largeur of LARGEURS) {
          test(`palette ${jeu.nom} — ${libelle} à ${largeur} px`, async () => {
            await poser(jeu)
            const cible = libelle === 'une actualité' ? cheminActu : cheminFixe
            await auditer(page, `${libelle} (palette ${jeu.nom})`, cible, largeur, nom)
          })
        }
      }
    }
  })
}
