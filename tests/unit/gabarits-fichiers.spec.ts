// @vitest-environment node
import { describe, expect, it } from 'vitest'

import {
  adressesGabarit,
  lirePolice,
  lireTheme,
  policesServies,
  typePolice,
} from '@/gabarits/fichiers'
import { GABARITS } from '@/gabarits/registre'

/**
 * Décision 19 : la feuille et les polices d'un gabarit sont servies depuis
 * l'origine sous `/gabarits/<nom>/`, et seulement elles (I27).
 */
describe('fichiers de gabarit', () => {
  it('adresses : la feuille et une adresse par police déclarée', () => {
    expect(
      adressesGabarit({
        nom: 'essai',
        libelle: 'Essai',
        versionContrat: 1,
        polices: ['a.woff2', 'b.woff2'],
        accueil: [],
        cadrageHeros: 'haut',
      }),
    ).toEqual({
      feuille: '/gabarits/essai/theme.css',
      polices: ['/gabarits/essai/polices/a.woff2', '/gabarits/essai/polices/b.woff2'],
    })
  })

  it('type MIME par extension, null pour ce qui n’est pas une police', () => {
    expect(typePolice('x.woff2')).toBe('font/woff2')
    expect(typePolice('X.WOFF2')).toBe('font/woff2')
    expect(typePolice('licence.txt')).toBeNull()
  })

  for (const [nom, { gabarit }] of Object.entries(GABARITS)) {
    it(`${nom} : theme.css lu sur disque`, async () => {
      const css = await lireTheme(nom)
      expect(css).toContain('@font-face')
    })

    it(`${nom} : chaque police déclarée existe et se sert`, async () => {
      expect(gabarit.polices.length).toBeGreaterThan(0)
      for (const fichier of gabarit.polices) {
        const police = await lirePolice(nom, fichier)
        expect(police?.type, fichier).toBe('font/woff2')
        // Signature d'un fichier WOFF2 : « wOF2 ».
        expect(police?.octets.subarray(0, 4).toString('latin1'), fichier).toBe('wOF2')
      }
      expect(policesServies()).toEqual(
        expect.arrayContaining(gabarit.polices.map((fichier) => ({ nom, fichier }))),
      )
    })

    it(`${nom} : chaque police qu’emploie theme.css est déclarée dans gabarit.polices`, async () => {
      const css = (await lireTheme(nom)) ?? ''
      const employees = [...css.matchAll(/url\(\s*['"]?polices\/([^'")]+)['"]?\s*\)/g)].map(
        (m) => m[1],
      )
      expect(employees.length).toBeGreaterThan(0)
      expect([...new Set(employees)].sort()).toEqual([...gabarit.polices].sort())
    })
  }

  it('gabarit inconnu ou nom hérité d’Object.prototype : rien', async () => {
    expect(await lireTheme('montagne')).toBeNull()
    expect(await lireTheme('constructor')).toBeNull()
    expect(await lirePolice('constructor', 'a.woff2')).toBeNull()
  })

  it('I27 : seuls les fichiers déclarés sont servis — ni licence, ni chemin remontant', async () => {
    expect(await lirePolice('village', 'bricolage-LICENSE.txt')).toBeNull()
    expect(await lirePolice('village', '../theme.css')).toBeNull()
    expect(await lirePolice('village', '../../../../package.json')).toBeNull()
    expect(await lirePolice('village', 'absente.woff2')).toBeNull()
  })
})
