import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { accords, contraste, DEFAUTS, deriver, VARIABLES_CONTRAT } from '@/lib/couleurs'
import type { Forcees } from '@/lib/couleurs'

const HEX = /^#[0-9a-f]{6}$/
const BLANC = '#ffffff'

/** Couleur valide quelconque, tirée sur tout l'espace sRGB 8 bits. */
const hexQuelconque = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`)

/** Écart de teinte OKLCH en degrés (plus court chemin sur le cercle). */
function ecartTeinte(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

describe('deriver — garanties (I25)', () => {
  // I25 : chaque garantie du tableau de la section 2 tient pour toute couleur
  // choisie valide. Graine fixe : un échec se rejoue à l'identique.
  it('toutes les garanties tiennent sur 3 000 tirages', () => {
    fc.assert(
      fc.property(hexQuelconque, hexQuelconque, hexQuelconque, (principale, accent, terre) => {
        const { variables: v, controles } = deriver({ principale, accent, terre })
        for (const c of controles) {
          expect(c.contraste, `${c.role} : ${c.couleur} sur ${c.fond}`).toBeGreaterThanOrEqual(
            c.seuil,
          )
        }
        // Les garanties sont recalculées ici, indépendamment de `controles` :
        // une ligne oubliée dans `controles` ne doit pas masquer un échec.
        expect(contraste(v['--principale-sure'], BLANC)).toBeGreaterThanOrEqual(4.5)
        expect(contraste(v['--encre'], v['--pale'])).toBeGreaterThanOrEqual(4.5)
        expect(contraste(BLANC, v['--profond'])).toBeGreaterThanOrEqual(7)
        expect(contraste(v['--accent-sur-profond'], v['--profond'])).toBeGreaterThanOrEqual(3)
        expect(contraste(v['--texte-sur-accent'], v['--accent'])).toBeGreaterThanOrEqual(4.5)
        expect(contraste(BLANC, v['--terre-sure'])).toBeGreaterThanOrEqual(3)
        for (let i = 1; i <= 6; i++) {
          expect(contraste(BLANC, v[`--picto-${i}`])).toBeGreaterThanOrEqual(3)
        }
      }),
      { seed: 25, numRuns: 3000 },
    )
  })

  it('produit exactement les variables du contrat, toutes au format #rrggbb', () => {
    fc.assert(
      fc.property(hexQuelconque, hexQuelconque, hexQuelconque, (principale, accent, terre) => {
        const { variables } = deriver({ principale, accent, terre })
        expect(Object.keys(variables).sort()).toEqual([...VARIABLES_CONTRAT].sort())
        for (const valeur of Object.values(variables)) expect(valeur).toMatch(HEX)
      }),
      { seed: 25, numRuns: 300 },
    )
  })

  it('les 4 tons de pictos ajoutés s’écartent d’au moins 30° des deux premiers', () => {
    const { variables: v } = deriver({ principale: '#2a7f9e', terre: '#d2462f' })
    const tons = [3, 4, 5, 6].map((i) => v[`--picto-${i}`])
    expect(new Set(tons).size).toBe(4)
  })
})

describe('deriver — cas nommés de la spec', () => {
  it('#2f7d5b (4,99:1) ressort inchangée', () => {
    expect(deriver({ principale: '#2f7d5b' }).variables['--principale-sure']).toBe('#2f7d5b')
  })

  it('#7fc8a0 (1,97:1) est assombrie jusqu’à 4,5:1 avec un écart de teinte < 2°', async () => {
    const { vers_oklch } = await import('@/lib/couleurs')
    const sure = deriver({ principale: '#7fc8a0' }).variables['--principale-sure']
    expect(sure).toBe('#3c8460') // valeur du prototype couleurs.py
    expect(contraste(sure, BLANC)).toBeGreaterThanOrEqual(4.5)
    expect(ecartTeinte(vers_oklch(sure)[2], vers_oklch('#7fc8a0')[2])).toBeLessThan(2)
  })

  // Écart volontaire au prototype : couleurs.py rendait #777676 (gris
  // légèrement teinté par les arrondis). Un gris saisi reste un gris.
  it('#777777 (4,48:1) est légèrement assombrie et reste grise', () => {
    expect(deriver({ principale: '#777777' }).variables['--principale-sure']).toBe('#767676')
    expect(deriver({ principale: '#ffffff' }).variables['--principale-sure']).toBe('#767676')
  })

  it('#ffff00 et #000000 donnent les valeurs du prototype', () => {
    expect(deriver({ principale: '#ffff00' }).variables['--principale-sure']).toBe('#7a7a0f')
    expect(deriver({ principale: '#000000' }).variables['--principale-sure']).toBe('#000000')
  })

  it('les défauts reproduisent la sortie du prototype couleurs.py', () => {
    expect(deriver({}).variables).toEqual({
      '--principale-sure': '#264653',
      '--profond': '#1d3d49',
      '--pale': '#e6f7fe',
      '--encre': '#0e222a',
      '--accent': '#e2a72e',
      '--accent-sur-profond': '#e2a72e',
      '--texte-sur-accent': '#000000',
      '--terre-sure': '#b36b00',
      '--picto-1': '#264653',
      '--picto-2': '#b36b00',
      '--picto-3': '#61558c',
      '--picto-4': '#87485d',
      '--picto-5': '#496a34',
      '--picto-6': '#4a5c91',
    })
  })
})

describe('deriver — saisies et défauts', () => {
  it('les défauts sont ceux de la spec', () => {
    expect(DEFAUTS).toEqual({ principale: '#264653', accent: '#e2a72e', terre: '#b36b00' })
  })

  // I24 : seul le format est validé, par le champ ; ici, une saisie hors
  // format (vide, 3 chiffres, nom CSS) est traitée comme absente, jamais
  // comme une erreur qui casserait le rendu du site.
  it('une saisie hors format vaut le défaut', () => {
    for (const mauvaise of ['', '#fff', 'red', '#12345g', ' #264653', null, undefined]) {
      expect(deriver({ principale: mauvaise as string }).variables, String(mauvaise)).toEqual(
        deriver({}).variables,
      )
    }
  })

  // I24 : une ligne de base incomplète (groupe absent, valeurs nulles, clés
  // en trop) ne doit jamais faire tomber le rendu du site.
  it('un argument nul ou des clés inconnues valent les défauts, sans erreur', () => {
    const defauts = deriver({}).variables
    expect(deriver(null).variables).toEqual(defauts)
    expect(deriver({}, null).variables).toEqual(defauts)
    expect(
      deriver({}, { id: '42', picto7: '#123456', texte: null } as unknown as Forcees).variables,
    ).toEqual(defauts)
  })

  it('les majuscules sont acceptées et donnent la même sortie', () => {
    expect(deriver({ principale: '#7FC8A0' }).variables).toEqual(
      deriver({ principale: '#7fc8a0' }).variables,
    )
  })
})

describe('deriver — couleurs forcées', () => {
  it('une forcée est utilisée telle quelle, marquée force, et avertit sous le seuil', () => {
    const r = deriver({ principale: '#264653' }, { texte: '#aaaaaa' })
    expect(r.variables['--principale-sure']).toBe('#aaaaaa')
    const ligne = r.controles.find((c) => c.role === 'texte et liens sur blanc')!
    expect(ligne.force).toBe(true)
    expect(ligne.contraste).toBeLessThan(4.5)
    expect(r.avertissements).toContain('Texte et liens sur blanc : 2,32:1, illisible')
  })

  it('une forcée lisible n’avertit pas', () => {
    const r = deriver({}, { profond: '#000000' })
    expect(r.variables['--profond']).toBe('#000000')
    expect(r.avertissements).toEqual([])
  })

  it('une forcée hors format est ignorée', () => {
    expect(deriver({}, { pale: 'blanc' }).variables).toEqual(deriver({}).variables)
  })

  it('une picto forcée ne remplace que son ton', () => {
    const r = deriver({}, { picto3: '#123456' })
    expect(r.variables['--picto-3']).toBe('#123456')
    expect(r.variables['--picto-4']).toBe(deriver({}).variables['--picto-4'])
  })

  it('l’accent sur profond se recalcule contre le profond forcé', () => {
    // Profond forcé proche de l'accent : contre le profond dérivé (sombre),
    // l'accent passerait tel quel ; contre le forcé, il doit être éclairci.
    const r = deriver({ accent: '#e2a72e' }, { profond: '#8a6a20' })
    expect(r.variables['--accent-sur-profond']).not.toBe('#e2a72e')
    expect(contraste(r.variables['--accent-sur-profond'], '#8a6a20')).toBeGreaterThanOrEqual(3)
  })
})

describe('deriver — harmonie', () => {
  it('avertit quand deux couleurs saisies se confondent', () => {
    const r = deriver({ principale: '#264653', accent: '#274754' })
    expect(r.avertissements).toContain('L’accent se confond avec la principale')
  })

  // Les défauts sont distincts par construction ; une seule saisie proche
  // d'un défaut non saisi n'avertit pas : l'utilisateur n'a rien choisi.
  it('n’avertit jamais sur un défaut non saisi', () => {
    expect(deriver({}).avertissements).toEqual([])
    expect(deriver({ accent: '#264653' }).avertissements).toEqual([])
  })
})

describe('accords', () => {
  it('propose 5 couleurs distinctes, valides, déterministes, différentes de l’entrée', () => {
    fc.assert(
      fc.property(hexQuelconque, (principale) => {
        const a = accords(principale)
        expect(a.length).toBeGreaterThanOrEqual(4)
        expect(a.length).toBeLessThanOrEqual(5)
        for (const c of a) expect(c).toMatch(HEX)
        expect(new Set(a).size).toBe(a.length)
        expect(a).not.toContain(principale)
        expect(accords(principale)).toEqual(a)
      }),
      { seed: 25, numRuns: 500 },
    )
  })

  it('une entrée hors format vaut la principale par défaut', () => {
    expect(accords('rouge')).toEqual(accords(DEFAUTS.principale))
  })
})
