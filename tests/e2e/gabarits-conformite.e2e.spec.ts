import AxeBuilder from '@axe-core/playwright'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { GABARITS } from '../../src/gabarits/registre'
import { VARIABLES_CONTRAT } from '../../src/lib/couleurs'
import { connecterAdmin } from '../helpers/login'

/**
 * Suite de conformité commune (spec § 6, I31) : un gabarit qui la passe est
 * techniquement recevable. Paramétrée par `Object.keys(GABARITS)` — aujourd'hui
 * le seul `village` provisoire (décision 18). Contre la commune de
 * démonstration saint-ex (localhost = DEFAULT_COMMUNE_SLUG).
 *
 * Un gabarit du registre fournit `theme.css` et ses polices (contrat) : les
 * points 3 et 8 échouent si l'un manque — ils ne passent plus à vide comme au
 * temps du gabarit provisoire (décision 18, close à la tâche 5).
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

/** Couleurs littérales admises dans theme.css (spec § 6, point 3). */
const BLANCHE = ['#fff', '#ffffff', '#000', '#000000']
/** Variables fixes hors contrat (décision 5) : jamais issues de la commune. */
const FIXES = ['--alerte', '--alerte-texte', '--focus']
/** Vider les coordonnées : un groupe Payload n'accepte pas null (mesuré : 500). */
const COORDONNEES_NULLES = {
  adresse: null,
  codePostal: null,
  ville: null,
  telephone: null,
  email: null,
}
const COORDONNEES_DEMO = {
  adresse: '1 place de la Mairie',
  codePostal: '01100',
  ville: 'Saint-Exupéry-les-Bains',
  telephone: '03 00 00 00 00',
  email: 'mairie@saint-exupery-les-bains.fr',
}

/*
 * Les appels API partent du navigateur (cookie de session + en-têtes propres,
 * acceptés par la protection CSRF) — même raison que couleurs.e2e.spec.ts.
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

/** Contrastes de tous les textes visibles, mesurés dans la page rendue (point 5). */
async function contrastes(page: Page) {
  return page.evaluate(() => {
    // Une couleur calculée n'est pas toujours `rgb()` : `color-mix(in oklab, …)`
    // se lit `oklab(…)` ou `color(srgb …)`. Le canevas la ramène en sRGB 8 bits,
    // quelle que soit sa syntaxe, transparence comprise.
    const canevas = document.createElement('canvas')
    canevas.width = canevas.height = 1
    const pinceau = canevas.getContext('2d', { willReadFrequently: true })!
    const rvba = (v: string): [number, number, number, number] => {
      pinceau.clearRect(0, 0, 1, 1)
      pinceau.fillStyle = v
      pinceau.fillRect(0, 0, 1, 1)
      const [r, g, b, a] = pinceau.getImageData(0, 0, 1, 1).data
      return [r, g, b, a / 255]
    }
    const lum = ([r, g, b]: number[]) => {
      const lin = (c: number) => {
        const x = c / 255
        return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    }
    const opaque = (v: string) => rvba(v)[3] === 1
    const porteurs = Array.from(document.querySelectorAll('body *')).filter((el) => {
      const aSonTexte = Array.from(el.childNodes).some(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent && n.textContent.trim() !== '',
      )
      if (!aSonTexte) return false
      const cs = getComputedStyle(el)
      return cs.display !== 'none' && cs.visibility !== 'hidden'
    })
    return porteurs.map((el) => {
      const cs = getComputedStyle(el)
      // Décision 17 : premier fond opaque des ancêtres (une photo ne compte pas).
      let fond: string | null = null
      for (let ancetre: Element | null = el; ancetre; ancetre = ancetre.parentElement) {
        const fondAncetre = getComputedStyle(ancetre).backgroundColor
        if (fondAncetre !== 'transparent' && opaque(fondAncetre)) {
          fond = fondAncetre
          break
        }
      }
      const taille = Number.parseFloat(cs.fontSize)
      const gras = Number.parseInt(cs.fontWeight, 10) >= 700
      const large = taille >= 24 || (taille >= 18.66 && gras)
      // Un texte translucide se mesure tel qu'il est vu : mêlé à son fond.
      const [fr, fv, fb] = fond ? rvba(fond) : [0, 0, 0]
      const [tr, tv, tb, ta] = rvba(cs.color)
      const vu = [tr * ta + fr * (1 - ta), tv * ta + fv * (1 - ta), tb * ta + fb * (1 - ta)]
      const [claire, sombre] = [lum(vu), lum([fr, fv, fb])].sort((a, b) => b - a)
      return {
        texte: (el.textContent ?? '').trim().slice(0, 50),
        couleur: cs.color,
        fond: fond ?? 'aucun',
        contraste: (claire + 0.05) / (sombre + 0.05),
        seuil: large ? 3 : 4.5,
      }
    })
  })
}

/** Couleurs littérales hors liste blanche + variables hors contrat d'un CSS (point 3). */
function controleCss(css: string) {
  const litteraux = (css.match(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/gi) ?? []).map((m) =>
    m.toLowerCase().replace(/\s/g, ''),
  )
  const horsListe = litteraux.filter((m) => !BLANCHE.includes(m) && m !== 'transparent')
  const declarees = new Set([...css.matchAll(/(^|\s)(--[a-z0-9-]+)\s*:/gim)].map((m) => m[2]))
  const admises = new Set<string>([...VARIABLES_CONTRAT, ...FIXES, ...declarees])
  const refs = [...css.matchAll(/var\((--[a-z0-9-]+)/gi)].map((m) => m[1])
  const refsInconnues = [...new Set(refs.filter((v) => !admises.has(v)))]
  return { horsListe, refsInconnues }
}

for (const [nom, { gabarit }] of Object.entries(GABARITS)) {
  test.describe.serial(`Suite de conformité — ${nom}`, () => {
    let page: Page
    let contexte: BrowserContext
    // État d'origine de la commune de démonstration, remis dans afterAll.
    let idCommune: number
    let idPageAccueil: number | null = null
    let origine: {
      gabarit?: string | null
      frise?: unknown[]
      photoAccueil?: number | null
      couleurPrincipale?: string | null
      couleurAccent?: string | null
      couleurTerre?: string | null
      coordonnees?: unknown
      demarches?: Array<{
        id?: string
        picto?: string
        titre?: string
        precision?: string
        lien?: string
      }>
    }

    test.beforeAll(async ({ browser }) => {
      // Axe exige une page née d'un contexte explicite (pas browser.newPage()).
      contexte = await browser.newContext()
      page = await contexte.newPage()
      await connecterAdmin(page, OPERATEUR)

      const docs = (await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0'))
        .docs as Array<Record<string, never>>
      idCommune = docs[0].id
      origine = {
        ...((docs[0] as unknown as { apparence?: typeof origine }).apparence ?? {}),
        coordonnees: (docs[0] as unknown as { coordonnees?: unknown }).coordonnees,
        demarches: (
          (docs[0] as unknown as { accueil?: { demarches?: typeof origine.demarches } }).accueil
            ?.demarches ?? []
        ).map((d) => ({ ...d })),
      }
      const pagesAccueil = (
        await api(
          page,
          `/api/pages?where[and][0][tenant][equals]=${idCommune}&where[and][1][slug][equals]=accueil&limit=1&draft=true&depth=0`,
        )
      ).docs as Array<{ id: number }>
      idPageAccueil = pagesAccueil[0]?.id ?? null

      // Bascule sur le gabarit éprouvé (opérateur seul, décision 15) et
      // coordonnées complètes : la carte mairie n'est pas vide, l'ordre des
      // sections s'éprouve sans section filtrée.
      await api(page, `/api/communes/${idCommune}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apparence: { gabarit: nom },
          coordonnees: {
            adresse: '1 place de la Mairie',
            codePostal: '01100',
            ville: 'Saint-Exupéry-les-Bains',
            telephone: '03 00 00 00 00',
            email: 'mairie@saint-exupery-les-bains.fr',
          },
        }),
      })
    })

    test.afterAll(async () => {
      if (!page) return
      try {
        await api(page, `/api/communes/${idCommune}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apparence: {
              gabarit: origine.gabarit ?? null,
              frise: origine.frise ?? [],
              photoAccueil: origine.photoAccueil ?? null,
              couleurPrincipale: origine.couleurPrincipale ?? null,
              couleurAccent: origine.couleurAccent ?? null,
              couleurTerre: origine.couleurTerre ?? null,
            },
            coordonnees: origine.coordonnees ?? null,
            accueil: {
              demarches: (origine.demarches ?? []).map((d) => ({
                id: d.id,
                picto: d.picto,
                titre: d.titre,
                precision: d.precision ?? null,
                lien: d.lien ?? null,
              })),
            },
          }),
        })
        if (idPageAccueil) {
          await api(page, `/api/pages/${idPageAccueil}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _status: 'published' }),
          })
        }
      } finally {
        await contexte.close()
      }
    })

    test('1 et 2 — accueil 200, sections dans l’ordre du gabarit, rien hors de l’origine, aucun script ajouté', async () => {
      const requetes: string[] = []
      page.on('request', (r) => requetes.push(r.url()))
      const reponse = await page.goto('/')
      expect(reponse?.status()).toBe(200)
      await page.waitForLoadState('networkidle')

      // I27 : aucune URL hors de l'origine testée (le host, tout protocole —
      // le websocket de dev est de l'origine).
      const hote = new URL(page.url()).host
      const exterieures = requetes.filter((u) => {
        try {
          return new URL(u).host !== hote
        } catch {
          return true
        }
      })
      expect(exterieures).toEqual([])

      // L'ordre des sections rendues égale la composition du gabarit (aucune
      // vide : la commune de démonstration a du contenu partout).
      const rendues = await page.$$eval('section[data-section]', (els) =>
        els.map((e) => e.getAttribute('data-section')),
      )
      expect(rendues).toEqual(gabarit.accueil.map((s) => s.section))

      // I27 : l'accueil n'ajoute aucun script par rapport à une page intérieure.
      // En dev, turbopack nomme ses chunks par route (constaté : un nom diffère
      // entre / et /actualites) : l'égalité porte sur les scripts qui ne sont
      // pas des chunks internes de Next — le gabarit n'en ajoute aucun.
      // En production (E2E_PROD=1 sur un build servi par next start), l'égalité
      // porte sur tous les scripts, chunks compris : c'est le contrôle complet.
      const enProd = process.env.E2E_PROD === '1'
      const srcs = () =>
        page.$$eval(
          'script[src]',
          (els, tous) =>
            els
              .map((e) => new URL((e as HTMLScriptElement).src).pathname)
              .filter((src) => tous || !src.startsWith('/_next/static/chunks/'))
              .sort(),
          enProd,
        )
      const scriptsAccueil = await srcs()
      await page.goto('/actualites')
      await page.waitForLoadState('networkidle')
      expect(scriptsAccueil).toEqual(await srcs())
    })

    test('3 — theme.css sans couleur littérale, variables du contrat seulement', async () => {
      const css = await readFile(path.join(process.cwd(), 'src/gabarits', nom, 'theme.css'), 'utf8')
      // Le contrôle porte sur une vraie feuille, pas sur un fichier vide.
      expect(css.length, 'theme.css non vide').toBeGreaterThan(500)
      const { horsListe, refsInconnues } = controleCss(css)
      expect(horsListe, 'couleurs littérales hors liste blanche').toEqual([])
      expect(refsInconnues, 'variables hors contrat/hors fichier').toEqual([])
    })

    test('4 — axe : aucune violation d’accessibilité sur l’accueil', async () => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const { violations } = await new AxeBuilder({ page }).analyze()
      expect(violations.map((v) => `${v.id} : ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual(
        [],
      )
    })

    test('5 — trois palettes extrêmes : contrastes mesurés dans la page', async () => {
      for (const extreme of ['#ffff00', '#777777', '#3b0a14']) {
        await api(page, `/api/communes/${idCommune}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apparence: {
              couleurPrincipale: extreme,
              couleurAccent: extreme,
              couleurTerre: extreme,
            },
          }),
        })
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        const mesures = await contrastes(page)
        const enEchec = mesures.filter((m) => m.contraste < m.seuil)
        expect(
          enEchec.map(
            (m) =>
              `« ${m.texte} » ${m.couleur} sur ${m.fond} : ${m.contraste.toFixed(2)} < ${m.seuil}`,
          ),
          `palette ${extreme}`,
        ).toEqual([])
      }
      // Retour aux couleurs d'origine pour la suite (captures, commune vide).
      await api(page, `/api/communes/${idCommune}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apparence: {
            couleurPrincipale: origine.couleurPrincipale ?? null,
            couleurAccent: origine.couleurAccent ?? null,
            couleurTerre: origine.couleurTerre ?? null,
          },
        }),
      })
    })

    test('6 — commune vide : aucun emplacement vide (I30)', async () => {
      await api(page, `/api/communes/${idCommune}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apparence: { photoAccueil: null, frise: [] },
          coordonnees: COORDONNEES_NULLES,
          accueil: {
            demarches: (origine.demarches ?? []).map((d) => ({
              id: d.id,
              picto: d.picto,
              titre: d.titre,
              precision: d.precision ?? null,
              lien: null,
            })),
          },
        }),
      })
      if (idPageAccueil) {
        await api(page, `/api/pages/${idPageAccueil}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ _status: 'draft' }),
        })
      }

      try {
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        const etat = await page.evaluate(() => ({
          imgSansSrc: Array.from(document.querySelectorAll('img'))
            .filter((i) => !i.getAttribute('src'))
            .map((i) => i.outerHTML.slice(0, 80)),
          illustrationsVides: Array.from(document.querySelectorAll('svg[data-illustration]'))
            .filter((s) => s.childElementCount === 0)
            .map((s) => s.outerHTML.slice(0, 80)),
          sectionsVides: Array.from(document.querySelectorAll('section[data-section]'))
            .filter((s) => s.childElementCount === 0)
            .map((s) => s.getAttribute('data-section')),
          sections: Array.from(document.querySelectorAll('section[data-section]')).map((s) =>
            s.getAttribute('data-section'),
          ),
          herosIllustre: Boolean(
            document.querySelector('[data-section="heros"] svg[data-illustration]'),
          ),
        }))
        expect(etat.imgSansSrc, 'aucun img sans src').toEqual([])
        expect(etat.illustrationsVides, 'aucun svg[data-illustration] vide').toEqual([])
        expect(etat.sectionsVides, 'aucune section sans enfant').toEqual([])
        // Sans photo, le héros rend l'illustration du kit (I30) ; sans liens,
        // ni page « accueil », ni coordonnées : démarches, texte libre et
        // mairie ne sont pas rendues du tout.
        expect(etat.herosIllustre, 'le héros sans photo rend une illustration').toBe(true)
        expect(etat.sections).toEqual(['heros', 'actualites', 'agenda', 'mosaique'])
      } finally {
        await api(page, `/api/communes/${idCommune}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apparence: {
              photoAccueil: origine.photoAccueil ?? null,
              frise: origine.frise ?? [],
            },
            coordonnees: COORDONNEES_DEMO,
            accueil: {
              demarches: (origine.demarches ?? []).map((d) => ({
                id: d.id,
                picto: d.picto,
                titre: d.titre,
                precision: d.precision ?? null,
                lien: d.lien ?? null,
              })),
            },
          }),
        })
        if (idPageAccueil) {
          await api(page, `/api/pages/${idPageAccueil}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _status: 'published' }),
          })
        }
      }
    })

    test('8 — chaque police du gabarit a sa licence voisine', async () => {
      const { readdir } = await import('node:fs/promises')
      const fichiers = await readdir(path.join(process.cwd(), 'src/gabarits', nom, 'polices'))
      const polices = fichiers.filter((f) => /\.(woff2?|ttf|otf)$/i.test(f))
      expect(polices.length, 'au moins une police auto-hébergée').toBeGreaterThan(0)
      // Les polices servies (décision 19) sont exactement celles du dossier.
      expect([...gabarit.polices].sort()).toEqual([...polices].sort())
      // Convention : `<famille>-LICENSE.txt`, où <famille> est le début du nom
      // du fichier de police (casse ignorée) — la licence d'une autre police
      // du dossier ne compte pas.
      const licences = fichiers.filter((f) => /-(licen[cs]e|ofl)\.txt$/i.test(f))
      for (const police of polices) {
        const sienne = licences.filter((l) =>
          police.toLowerCase().startsWith(l.replace(/-(licen[cs]e|ofl)\.txt$/i, '').toLowerCase()),
        )
        expect(sienne.length, `licence de ${police}`).toBeGreaterThan(0)
        const texte = await readFile(
          path.join(process.cwd(), 'src/gabarits', nom, 'polices', sienne[0]),
          'utf8',
        )
        expect(texte.length, `${sienne[0]} non vide`).toBeGreaterThan(200)
      }
    })

    test('9 — captures pleine page 1440 et 390', async () => {
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const dossier = path.join('test-results', 'gabarits')
      for (const largeur of [1440, 390]) {
        await page.setViewportSize({ width: largeur, height: largeur === 1440 ? 900 : 844 })
        await page.goto('/')
        await page.waitForLoadState('networkidle')
        await page.screenshot({
          path: path.join(dossier, `${nom}-${largeur}.png`),
          fullPage: true,
        })
      }
      await page.setViewportSize({ width: 1280, height: 720 })
    })
  })
}
