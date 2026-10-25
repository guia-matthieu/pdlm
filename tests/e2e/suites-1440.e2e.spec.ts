import { expect, test, type Page } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Régression « suites 1440 » (docs/qc/notes-suites-1440.md) : à 390 et
 * 1440 px — (B) le courriel de la mairie tient sur une ligne ou se replie
 * uniquement après l'arobase, jamais à un trait d'union ni en plein mot ;
 * un seul lien mailto, même adresse. Le courriel long force le repli dans
 * toutes les casettes mesurées : c'est lui qui rend ce test rouge sur le
 * code d'avant (coupure navigateur aux traits d'union). (C) le © du pied
 * du village s'aligne sur la première colonne. (Relecture) une commune
 * avec téléphone mais sans courriel rend sa carte mairie sans erreur.
 * (Retouches) le courriel du pied suit la même règle que la carte mairie,
 * et à 1440 px la rive mairie du littoral tient sur une seule rangée.
 * (Démo tiret) les plages horaires, carte mairie et pied, ne se coupent
 * plus en deux : aucune ligne ne commence par un tiret, chaque plage de la
 * fixture est entière dans une seule ligne.
 *
 * Fichier séparé, composition minimale (gabarit + coordonnées + horaires),
 * sur le modèle de mosaique-390 : prouver le rouge avant / vert après en
 * quelques secondes, sans captures ni jeux de couleurs.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', motDePasse: 'demo1234' }

const GABARITS = [
  {
    nom: 'village',
    coordonnees: {
      adresse: '1 place de la Mairie',
      codePostal: '01100',
      ville: 'Saint-Exupéry-les-Bains',
      telephone: '03 00 00 00 00',
      email: 'mairie@saint-exupery-les-bains.fr',
    },
  },
  {
    nom: 'littoral',
    coordonnees: {
      adresse: '1 quai de la Mairie',
      codePostal: '01100',
      ville: 'Saint-Exupéry-sur-Mer',
      telephone: '03 00 00 00 00',
      email: 'mairie@saint-exupery-sur-mer.fr',
    },
  },
] as const
const HORAIRES =
  'Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.'
/** Une plage « nombre + h + tiret + nombre + h » — pour exiger que la
 *  fixture en soit rendue entière dans une seule ligne. */
const PLAGE_HORAIRE =
  /\d+[ \u00A0]?h\b(?:[ \u00A0]?\d{1,2}(?!\d))?[ \u00A0]?[–—-][ \u00A0]?\d+[ \u00A0]?h\b(?:[ \u00A0]?\d{1,2}(?!\d))?/g
const LARGEURS = [390, 1440] as const
/** Ne tient dans aucune casette mesurée : le repli est garanti. */
const COURRIEL_LONG = 'secretariat.mairie@commune-saint-exupery-sur-mer.fr'

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

/** Prépare la page à une largeur donnée et attend le rendu, images chargées. */
async function ouvrir(page: Page, largeur: number) {
  await page.setViewportSize({ width: largeur, height: 844 })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(async () => {
    // Images différées hors écran : forcer le chargement avant decode
    // (sinon decode() pend indéfiniment), comme le spec de captures.
    await Promise.all(
      Array.from(document.images).map((img) => {
        img.loading = 'eager'
        return img.decode().catch(() => null)
      }),
    )
  })
}

/** Lignes réelles du courriel : caractères groupés par le haut de leur
 *  rectangle de portée (un Range par caractère) — le `<wbr>` n'a pas de
 *  nœud texte, seule la coupure effective crée une ligne. */
async function lignesCourriel(page: Page, conteneur = '.section-mairie') {
  return page.evaluate((conteneur: string) => {
    const section = document.querySelector(conteneur)
    if (!section) return null
    const lien = section.querySelector('a[href^="mailto:"]') as HTMLAnchorElement | null
    if (!lien) return null
    const lignes: string[] = []
    let cle = -99
    const range = document.createRange()
    const marcheur = document.createTreeWalker(lien, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = marcheur.nextNode())) {
      const t = n.textContent ?? ''
      for (let i = 0; i < t.length; i++) {
        if (t[i] === '\u200B') continue // zéro largeur (wbr)
        range.setStart(n, i)
        range.setEnd(n, i + 1)
        const haut = range.getBoundingClientRect().top
        if (Math.abs(haut - cle) > 2) {
          lignes.push('')
          cle = haut
        }
        lignes[lignes.length - 1] += t[i]
      }
    }
    return {
      href: lien.getAttribute('href'),
      liens: section.querySelectorAll('a[href^="mailto:"]').length,
      lignes,
      scrollWidth: document.documentElement.scrollWidth,
    }
  }, conteneur)
}

/** Le courriel rendu respecte la règle : une ligne, ou des lignes dont
 *  seule la dernière ne se termine pas par l'arobase (le texte, lui, est
 *  complet — aucune lettre avalée par le repli). */
function attenduCourriel(courriel: string, lignes: string[], href: string | null, liens: number) {
  expect(href, 'le lien mailto porte l’adresse entière').toBe(`mailto:${courriel}`)
  expect(liens, 'un seul lien courriel').toBe(1)
  expect(lignes.join(''), 'le texte rendu est l’adresse entière').toBe(courriel)
  for (const [i, ligne] of lignes.entries()) {
    if (i < lignes.length - 1) {
      expect(
        ligne.endsWith('@'),
        `la coupure ${i + 1} se fait après l’arobase : ${JSON.stringify(lignes)}`,
      ).toBe(true)
    }
  }
}

/** Lignes réelles du bloc horaires : mêmes Range par caractère que
 *  lignesCourriel, sur le <span> des horaires du bloc (carte mairie ou
 *  pied). */
async function lignesHoraires(page: Page, conteneur: string) {
  return page.evaluate((conteneur: string) => {
    const racine = document.querySelector(conteneur)
    const span = racine?.querySelector('p:has(strong) span')
    if (!span) return null
    const lignes: string[] = []
    let cle = -99
    const range = document.createRange()
    const marcheur = document.createTreeWalker(span, NodeFilter.SHOW_TEXT)
    let n: Node | null
    while ((n = marcheur.nextNode())) {
      const t = n.textContent ?? ''
      for (let i = 0; i < t.length; i++) {
        range.setStart(n, i)
        range.setEnd(n, i + 1)
        const haut = range.getBoundingClientRect().top
        if (Math.abs(haut - cle) > 2) {
          lignes.push('')
          cle = haut
        }
        lignes[lignes.length - 1] += t[i]
      }
    }
    return { lignes, scrollWidth: document.documentElement.scrollWidth }
  }, conteneur)
}

/** Le bloc horaires rendu respecte la règle : texte complet, chaque plage
 *  de la fixture entière dans une seule ligne (aucune coupure entre le
 *  nombre et le « h » ni autour du tiret), aucune ligne ne commençant par
 *  un tiret. Les insécables (U+00A0) et le lieur (U+2060) posés à
 *  l'affichage sont normalisés avant comparaison. */
function attenduHoraires(lignes: string[], scrollWidth: number, largeur: number) {
  expect(scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(largeur)
  const normalisees = lignes.map((l) => l.replace(/\u00A0/g, ' ').replace(/\u2060/g, ''))
  expect(normalisees.join(''), 'le texte rendu est la phrase entière').toBe(HORAIRES)
  // Une plage peut apparaître deux fois dans la fixture : c'est la borne de
  // coupure qu'on contrôle, pas la présence du texte de la plage (présent
  // intact ailleurs, une coupure passerait inaperçue).
  const texte = normalisees.join('')
  const plages = [...HORAIRES.matchAll(PLAGE_HORAIRE)].map((m) => [
    m.index!,
    m.index! + m[0].length,
  ])
  let borne = 0
  for (let i = 0; i < normalisees.length - 1; i++) {
    borne += normalisees[i].length
    for (const [debut, fin] of plages) {
      expect(
        !(borne > debut && borne < fin),
        `la coupure ${i + 1} tombe dans la plage « ${texte.slice(debut, fin)} » : ${JSON.stringify(normalisees)}`,
      ).toBe(true)
    }
  }
  for (const ligne of normalisees) {
    expect(
      ligne.trim(),
      `aucune ligne ne commence par un tiret : ${JSON.stringify(normalisees)}`,
    ).not.toMatch(/^[–—-]/)
  }
}

for (const g of GABARITS) {
  test.describe.serial(`${g.nom} : courriel de la mairie`, () => {
    let page: Page
    let idCommune: number
    let origine: Record<string, unknown>

    test.beforeAll(async ({ browser }) => {
      test.setTimeout(180_000)
      page = await (await browser.newContext()).newPage()
      await connecterAdmin(page, OPERATEUR)

      const commune = (
        await api(page, '/api/communes?where[slug][equals]=saint-ex&limit=1&depth=0')
      ).docs[0]
      idCommune = commune.id
      origine = commune
      await api(page, `/api/communes/${idCommune}`, json('PATCH', {
        apparence: { gabarit: g.nom },
        coordonnees: g.coordonnees,
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

    for (const largeur of LARGEURS) {
      test(`à ${largeur} px, courriel de capture : une seule ligne`, async () => {
        // Chaque test repose son état : le précédent a pu laisser le
        // courriel long en base.
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: g.coordonnees,
        }))
        await ouvrir(page, largeur)
        const m = await lignesCourriel(page)
        expect(m, 'la carte mairie est rendue').toBeTruthy()
        expect(m!.scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(largeur)
        attenduCourriel(g.coordonnees.email, m!.lignes, m!.href, m!.liens)
        expect(
          m!.lignes,
          `le courriel tient sur une ligne : ${JSON.stringify(m!.lignes)}`,
        ).toHaveLength(1)
      })

      test(`à ${largeur} px, courriel long : replié après l’arobase seulement`, async () => {
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: { ...g.coordonnees, email: COURRIEL_LONG },
        }))
        await ouvrir(page, largeur)
        const m = await lignesCourriel(page)
        expect(m, 'la carte mairie est rendue').toBeTruthy()
        expect(m!.scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(largeur)
        attenduCourriel(COURRIEL_LONG, m!.lignes, m!.href, m!.liens)
        expect(
          m!.lignes.length,
          `deux lignes au plus, coupées après l’arobase : ${JSON.stringify(m!.lignes)}`,
        ).toBeLessThanOrEqual(2)
      })

      test(`à ${largeur} px, courriel long au pied : replié après l’arobase seulement`, async () => {
        // Chaque test repose son état (le précédent a pu laisser le
        // courriel court) : le pied montre le même courriel que la carte
        // mairie, la règle doit y être la même.
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: { ...g.coordonnees, email: COURRIEL_LONG },
        }))
        await ouvrir(page, largeur)
        const m = await lignesCourriel(page, '.pied-page')
        expect(m, 'le pied est rendu').toBeTruthy()
        expect(m!.scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(largeur)
        attenduCourriel(COURRIEL_LONG, m!.lignes, m!.href, m!.liens)
        expect(
          m!.lignes.length,
          `deux lignes au plus, coupées après l’arobase : ${JSON.stringify(m!.lignes)}`,
        ).toBeLessThanOrEqual(2)
      })

      test(`à ${largeur} px, horaires de la carte mairie : aucune plage coupée`, async () => {
        // Chaque test repose son état : le précédent a pu laisser le
        // courriel long en base.
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: g.coordonnees,
        }))
        await ouvrir(page, largeur)
        const m = await lignesHoraires(page, '.section-mairie')
        expect(m, 'la carte mairie est rendue').toBeTruthy()
        attenduHoraires(m!.lignes, m!.scrollWidth, largeur)
      })

      test(`à ${largeur} px, horaires du pied : aucune plage coupée`, async () => {
        // Le test précédent vient de reposer les coordonnées, et les
        // horaires de démonstration tiennent encore : ouvrir suffit.
        await ouvrir(page, largeur)
        const m = await lignesHoraires(page, '.pied-page')
        expect(m, 'le pied est rendu').toBeTruthy()
        attenduHoraires(m!.lignes, m!.scrollWidth, largeur)
      })

      if (g.nom === 'village') {
        test(`à ${largeur} px, © du pied aligné sur la première colonne`, async () => {
          // Les tests précédents ont reposé le courriel de capture : sans
          // importance,
          // le pied ne dépend pas des coordonnées de la carte mairie.
          await ouvrir(page, largeur)
          const mesure = await page.evaluate(() => {
            const colonnes = document.querySelector('.pied-page__colonnes')
            const mentions = document.querySelector('.pied-page__mentions')
            if (!colonnes || !mentions) return null
            const range = document.createRange()
            range.selectNode(mentions.firstChild ?? mentions)
            return {
              copyright: range.getBoundingClientRect().x,
              colonne: colonnes.firstElementChild!.getBoundingClientRect().x,
              scrollWidth: document.documentElement.scrollWidth,
            }
          })
          expect(mesure, 'le pied est rendu').toBeTruthy()
          expect(mesure!.scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(largeur)
          expect(
            Math.abs(mesure!.copyright - mesure!.colonne),
            `© à ${mesure!.copyright} px, première colonne à ${mesure!.colonne} px`,
          ).toBeLessThanOrEqual(1)
        })
      }
    }

    if (g.nom === 'littoral') {
      test('téléphone sans courriel : la carte mairie rend sans erreur', async () => {
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: {
            adresse: null,
            codePostal: null,
            ville: null,
            telephone: g.coordonnees.telephone,
            email: null,
          },
          horaires: null,
        }))
        const reponse = await page.goto('/')
        expect(reponse!.status(), 'l’accueil répond').toBe(200)
        await expect(page.locator('[data-section="mairie"]')).toBeVisible()
        await expect(page.locator('.mairie__tel')).toBeVisible()
      })

      test('à 1440 px, la rive mairie tient sur une rangée (courriel de démonstration)', async () => {
        // Le test précédent a laissé la commune sans courriel : remettre
        // les coordonnées de démonstration, celles du cas réel 1440 px.
        await api(page, `/api/communes/${idCommune}`, json('PATCH', {
          coordonnees: g.coordonnees,
          horaires: HORAIRES,
        }))
        await ouvrir(page, 1440)
        const rive = await page.evaluate(() => {
          const section = document.querySelector('.section-mairie')
          if (!section) return null
          const rects = Array.from(section.children).map((el) => el.getBoundingClientRect())
          // Rive sans retour à la ligne : dans l’ordre du DOM, chaque
          // casette commence après la fin de la précédente.
          let rangees = 1
          for (let i = 1; i < rects.length; i++) {
            if (rects[i].left < rects[i - 1].right - 1) rangees++
          }
          return { rangees, scrollWidth: document.documentElement.scrollWidth }
        })
        expect(rive, 'la rive mairie est rendue').toBeTruthy()
        expect(rive!.scrollWidth, 'la page ne déborde pas').toBeLessThanOrEqual(1440)
        expect(rive!.rangees, 'les cinq casettes sur une seule rangée').toBe(1)
      })
    }
  })
}
