import { describe, expect, it } from 'vitest'

import {
  departementDuCodeInsee,
  etiquetteDomaine,
  formesRecommandees,
} from '@/lib/nomenclature'

describe('etiquetteDomaine — transcription ANCT d’un nom', () => {
  it('minuscules, sans accent, séparateurs en tirets', () => {
    expect(etiquetteDomaine('Quimper')).toBe('quimper')
    expect(etiquetteDomaine('Saint-Étienne')).toBe('saint-etienne')
    expect(etiquetteDomaine("L'Île-Rousse")).toBe('l-ile-rousse')
    expect(etiquetteDomaine('Saint-Jean-de-Luz')).toBe('saint-jean-de-luz')
  })

  it('réduit les séparateurs multiples et coupe les bords', () => {
    expect(etiquetteDomaine("  Saint--lô  ")).toBe('saint-lo')
    expect(etiquetteDomaine('Arradon')).toBe('arradon')
  })

  it('les ligatures se translittèrent : œ→oe, æ→ae', () => {
    expect(etiquetteDomaine('Œuilly')).toBe('oeuilly') // communes réelles 02565 et 51410
    expect(etiquetteDomaine('La Gaubretière')).toBe('la-gaubretiere')
    expect(etiquetteDomaine('Œuilly-sur-Marne')).toBe('oeuilly-sur-marne')
  })

  it('jamais d’IDN : hors œ/æ, un signe non ASCII ne transcrit pas', () => {
    // Une fois œ→oe et æ→ae passés, un nom resté non ASCII n’a pas
    // d’équivalent : aucune forme proposée, plutôt qu’un punycode (xn--…).
    expect(etiquetteDomaine('Жуан')).toBeNull()
    expect(etiquetteDomaine('cerf-œuf²')).toBeNull()
  })
})

describe('formesRecommandees — formes ANCT, geoTLD à égalité (RPNT § 2)', () => {
  it('Quimper (29) : .fr et .bzh au même rang, jamais l’un après l’autre', () => {
    expect(formesRecommandees('Quimper', '29', false)).toEqual([
      ['quimper.fr', 'quimper.bzh'],
      ['mairie-quimper.fr', 'mairie-quimper.bzh'],
      ['ville-quimper.fr', 'ville-quimper.bzh'],
    ])
  })

  it('L’Île-Rousse (2B) : .corsica à égalité, apostrophe et accents partis', () => {
    expect(formesRecommandees("L'Île-Rousse", '2B', false)).toEqual([
      ['l-ile-rousse.fr', 'l-ile-rousse.corsica'],
      ['mairie-l-ile-rousse.fr', 'mairie-l-ile-rousse.corsica'],
      ['ville-l-ile-rousse.fr', 'ville-l-ile-rousse.corsica'],
    ])
  })

  it('Saint-Jean-de-Luz (64) : pas de geoTLD, .fr seul', () => {
    expect(formesRecommandees('Saint-Jean-de-Luz', '64', false)).toEqual([
      ['saint-jean-de-luz.fr'],
      ['mairie-saint-jean-de-luz.fr'],
      ['ville-saint-jean-de-luz.fr'],
    ])
  })

  it('homonymie : une quatrième forme nom+département, dernier rang', () => {
    expect(formesRecommandees('Saint-Étienne', '42', true)).toEqual([
      ['saint-etienne.fr'],
      ['mairie-saint-etienne.fr'],
      ['ville-saint-etienne.fr'],
      ['saint-etienne42.fr'],
    ])
  })

  it('homonymie en Corse : la forme nom+département garde .corsica à égalité', () => {
    expect(formesRecommandees('Sotta', '2A', true)).toEqual([
      ['sotta.fr', 'sotta.corsica'],
      ['mairie-sotta.fr', 'mairie-sotta.corsica'],
      ['ville-sotta.fr', 'ville-sotta.corsica'],
      ['sotta2a.fr', 'sotta2a.corsica'],
    ])
  })

  it('sans homonymie, la forme nom+département n’apparaît pas', () => {
    const formes = formesRecommandees('Saint-Étienne', '42', false)
    expect(formes).toHaveLength(3)
    expect(formes.flat()).not.toContain('saint-etienne42.fr')
  })

  it('département inconnu ou absent : .fr seul, pas de forme homonyme', () => {
    expect(formesRecommandees('Quimper', null, false)).toEqual([
      ['quimper.fr'],
      ['mairie-quimper.fr'],
      ['ville-quimper.fr'],
    ])
    // Homonymie réclamée mais département inconnu : la forme nom+dép serait
    // fausse, on ne la fabrique pas.
    expect(formesRecommandees('Quimper', null, true)).toHaveLength(3)
    expect(formesRecommandees('Quimper', '9Z', true)).toHaveLength(3)
  })

  it('Œuilly homonyme (02 et 51 réels) : œ→oe puis nom+département', () => {
    expect(formesRecommandees('Œuilly', '02', true)).toEqual([
      ['oeuilly.fr'],
      ['mairie-oeuilly.fr'],
      ['ville-oeuilly.fr'],
      ['oeuilly02.fr'],
    ])
  })

  it('nom intraduisible : aucune forme, jamais d’IDN', () => {
    expect(formesRecommandees('Жуан', '62', false)).toEqual([])
    expect(formesRecommandees('Жуан', '62', true)).toEqual([])
  })

  it('aucune forme proposée ne contient de punycode', () => {
    const formes = formesRecommandees("L'Île-Rousse", '2B', true).flat()
    expect(formes.length).toBeGreaterThan(0)
    expect(formes.every((f) => !f.includes('xn--') && /^[\x20-\x7E]+$/.test(f))).toBe(true)
  })
})

describe('departementDuCodeInsee — du code INSEE au département', () => {
  it('métropole : 2 chiffres ; Corse : 2A/2B ; outre-mer : 97x sur 3 chiffres', () => {
    expect(departementDuCodeInsee('29232')).toBe('29')
    expect(departementDuCodeInsee('2A004')).toBe('2A')
    expect(departementDuCodeInsee('2B134')).toBe('2B')
    expect(departementDuCodeInsee('97411')).toBe('974')
    expect(departementDuCodeInsee('2a004')).toBe('2A')
  })

  it('code absent ou illisible : null', () => {
    expect(departementDuCodeInsee(null)).toBeNull()
    expect(departementDuCodeInsee(undefined)).toBeNull()
    expect(departementDuCodeInsee('')).toBeNull()
    expect(departementDuCodeInsee('2900')).toBeNull()
    expect(departementDuCodeInsee('ab123')).toBeNull()
  })
})
