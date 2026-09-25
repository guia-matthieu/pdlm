import { describe, expect, it } from 'vitest'

import { formaterDate } from '@/lib/dates'

// 10:00 UTC = 12:00 à Paris (heure d'été) ; un mardi.
const DATE = '2026-09-22T10:00:00.000Z'

describe('formaterDate', () => {
  it('formate en français via Intl', () => {
    expect(formaterDate(DATE, 'fr', { dateStyle: 'long' })).toBe('22 septembre 2026')
    expect(formaterDate(DATE, 'fr', { dateStyle: 'full', timeStyle: 'short' })).toBe(
      'mardi 22 septembre 2026 à 12:00',
    )
  })

  it('constate qu’Intl ne connaît pas le corse (sinon revoir le repli)', () => {
    // Si ce test casse, Node a gagné des données corses : vérifier leur sortie
    // avant de supprimer les noms de langues.ts.
    expect(Intl.DateTimeFormat.supportedLocalesOf(['co'])).toEqual([])
  })

  it('formate en corse avec les noms de la liste, pas la locale du système', () => {
    expect(formaterDate(DATE, 'co', { dateStyle: 'long' })).toBe('22 settembre 2026')
    expect(formaterDate(DATE, 'co', { dateStyle: 'full' })).toBe('marti 22 settembre 2026')
    expect(formaterDate(DATE, 'co', { dateStyle: 'full', timeStyle: 'short' })).toBe(
      'marti 22 settembre 2026, à 12:00',
    )
  })

  it('applique le fuseau de Paris en corse aussi (jour qui change à minuit)', () => {
    // 22:30 UTC le 22 = 00:30 le 23 à Paris
    expect(formaterDate('2026-09-22T22:30:00.000Z', 'co', { dateStyle: 'long' })).toBe(
      '23 settembre 2026',
    )
  })

  it('refuse en corse les options que le repli sans Intl ne sait pas rendre', () => {
    // dateStyle 'short' serait silencieusement rendu comme 'long' sans ce refus.
    expect(() => formaterDate(DATE, 'co', { dateStyle: 'short' })).toThrow()
    // timeStyle seul (sans dateStyle) rendrait à tort une date complète + l'heure.
    expect(() => formaterDate(DATE, 'co', { timeStyle: 'short' })).toThrow()
  })
})
