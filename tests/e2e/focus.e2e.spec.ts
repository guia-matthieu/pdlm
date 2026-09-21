import { expect, test, type Page } from '@playwright/test'
import path from 'node:path'

/**
 * RGAA 10.7 / 3.3 — la prise de focus reste visible (contraste ≥ 3:1 avec le
 * fond qui entoure l'élément) QUELLE QUE SOIT la couleur choisie par la
 * commune. La feuille réelle est chargée dans une page minimale : le test ne
 * dépend ni du seed ni des couleurs stockées en base.
 *
 * Pire cas historique : anneau à la couleur d'accent, identique par défaut à
 * la couleur principale qui sert de fond au Hero → anneau invisible (1:1).
 */
const FEUILLE = path.resolve('src/app/(frontend)/styles.css')

/** Couleurs communales éprouvées : foncée, claire, moyenne (accent = principale). */
const COULEURS = ['#264653', '#ffe14d', '#6b8e23']

function luminance([r, g, b]: number[]) {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

function contraste(a: number[], b: number[]) {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (claire + 0.05) / (sombre + 0.05)
}

const rgb = (valeur: string) => (valeur.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number)

/** Contraste maximal entre une couche de l'indicateur de focus et le fond. */
async function contrasteFocus(page: Page, idElement: string, idFond: string) {
  const styles = await page.evaluate(
    ([id, fond]) => {
      const el = getComputedStyle(document.getElementById(id)!)
      return {
        actif: document.activeElement?.id,
        outlineStyle: el.outlineStyle,
        outlineWidth: el.outlineWidth,
        outlineColor: el.outlineColor,
        boxShadow: el.boxShadow,
        fond: getComputedStyle(document.getElementById(fond)!).backgroundColor,
      }
    },
    [idElement, idFond],
  )
  expect(styles.actif).toBe(idElement)
  const couches = [styles.outlineStyle !== 'none' ? rgb(styles.outlineColor) : null]
  for (const ombre of styles.boxShadow === 'none' ? [] : styles.boxShadow.split(/,(?![^(]*\))/)) {
    couches.push(rgb(ombre))
  }
  const fond = rgb(styles.fond)
  return Math.max(
    0,
    ...couches.filter((c): c is number[] => c !== null).map((c) => contraste(c, fond)),
  )
}

for (const couleur of COULEURS) {
  test(`focus visible avec la couleur communale ${couleur}`, async ({ page }) => {
    await page.setContent(`<!doctype html>
      <html lang="fr"><body id="page" style="--couleur-principale:${couleur};--couleur-accent:${couleur}">
        <main>
          <p><a id="lien-texte" href="#texte">Lien dans le texte</a></p>
          <section id="hero" class="bloc bloc-hero">
            <h1>Bienvenue</h1>
            <a id="lien-hero" class="bouton bouton--primaire" href="#hero">Découvrir</a>
          </section>
        </main>
      </body></html>`)
    await page.addStyleTag({ path: FEUILLE })
    // `body` sans fond explicite : le blanc de la page vient de `html`
    await page.evaluate(() => {
      document.body.style.backgroundColor = getComputedStyle(
        document.documentElement,
      ).backgroundColor
    })

    await page.keyboard.press('Tab')
    expect(await contrasteFocus(page, 'lien-texte', 'page')).toBeGreaterThanOrEqual(3)

    await page.keyboard.press('Tab')
    expect(await contrasteFocus(page, 'lien-hero', 'hero')).toBeGreaterThanOrEqual(3)
  })
}
