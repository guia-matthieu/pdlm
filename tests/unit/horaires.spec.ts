import { describe, expect, it } from 'vitest'

import { horairesInsecables } from '@/lib/horaires'

/** Ce que voit le lecteur : insécables rendus comme des espaces, lieurs
 *  invisibles retirés. */
const lisible = (texte: string) => texte.replace(/\u00A0/g, ' ').replace(/\u2060/g, '')

describe('horairesInsecables', () => {
  it('rend insécables les espaces internes des formes courantes', () => {
    expect(horairesInsecables('9 h – 12 h')).toBe('9\u00A0h\u00A0–\u2060\u00A012\u00A0h')
    expect(horairesInsecables('9 h 30 – 12 h')).toBe(
      '9\u00A0h\u00A030\u00A0–\u2060\u00A012\u00A0h',
    )
    expect(horairesInsecables('14 h — 17 h')).toBe('14\u00A0h\u00A0—\u2060\u00A017\u00A0h')
    expect(horairesInsecables('9 h - 12 h')).toBe('9\u00A0h\u00A0-\u2060\u00A012\u00A0h')
  })

  it('laisse une plage sans espace interne telle quelle (rien à protéger)', () => {
    expect(horairesInsecables('9h-12h')).toBe('9h-12h')
  })

  it('ne touche que les plages dans une phrase d’horaires', () => {
    const horaires = 'Lundi, mardi : 9 h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h.'
    expect(horairesInsecables(horaires)).toBe(
      'Lundi, mardi : 9\u00A0h\u00A0–\u2060\u00A012\u00A0h, 14\u00A0h\u00A0–\u2060\u00A017\u00A0h. Mercredi : 9\u00A0h\u00A0–\u2060\u00A012\u00A0h.',
    )
    // La ponctuation garde ses espaces sécables.
    expect(horairesInsecables(horaires)).not.toContain(',\u00A014')
    expect(horairesInsecables(horaires)).not.toContain('.\u00A0Mercredi')
  })

  it('ne reconnaît pas « heures » comme une heure', () => {
    expect(horairesInsecables('ouvert 2 heures')).toBe('ouvert 2 heures')
  })

  it('laisse un texte sans plage inchangé', () => {
    expect(horairesInsecables('Sur rendez-vous le matin')).toBe('Sur rendez-vous le matin')
  })

  it('accepte le texte vide', () => {
    expect(horairesInsecables('')).toBe('')
  })

  it('ne change que les espaces : le texte lisible est identique', () => {
    const horaires = 'Lundi : 9 h – 12 h, 14 h – 17 h.'
    expect(lisible(horairesInsecables(horaires))).toBe(horaires)
  })

  it('est idempotent (insécables et lieurs déjà posés)', () => {
    const uneFois = horairesInsecables('9 h – 12 h')
    expect(horairesInsecables(uneFois)).toBe(uneFois)
  })
})
