import { describe, expect, it } from 'vitest'

import { normaliserSiret, validerSiret } from '@/lib/siret'

describe('SIRET (D5 : format seulement)', () => {
  it('retire les espaces de saisie', () => {
    expect(normaliserSiret(' 200 022 000 00000 ')).toBe('20002200000000')
  })
  it('accepte 14 chiffres', () => {
    expect(validerSiret('20002200000000')).toBe(true)
  })
  it('refuse 9 chiffres (un SIREN)', () => {
    expect(validerSiret('200022000')).toBe('Le SIRET compte 14 chiffres.')
  })
  it('refuse une lettre', () => {
    expect(validerSiret('2000220000000A')).toBe('Le SIRET compte 14 chiffres.')
  })
  it('refuse le vide', () => {
    expect(validerSiret('')).toBe('Le SIRET compte 14 chiffres.')
  })
})
