import { describe, expect, it } from 'vitest'

import { lienTelephone } from '@/lib/telephone'

describe('lienTelephone', () => {
  it('met un numéro français à dix chiffres au format international', () => {
    expect(lienTelephone('04 95 00 00 00')).toBe('tel:+33495000000')
    expect(lienTelephone('04.95.00.00.00')).toBe('tel:+33495000000')
    expect(lienTelephone('06 12 34 56 78')).toBe('tel:+33612345678')
    expect(lienTelephone('02 98 00 00 00')).toBe('tel:+33298000000')
  })

  it('laisse un numéro déjà international tel quel, avec ou sans +', () => {
    expect(lienTelephone('+33 4 95 00 00 00')).toBe('tel:+33495000000')
    expect(lienTelephone('0033 4 95 00 00 00')).toBe('tel:+33495000000')
  })

  it('laisse au format national numéro court et préfixes d’outre-mer', () => {
    expect(lienTelephone('3949')).toBe('tel:3949')
    expect(lienTelephone('0262 00 00 00')).toBe('tel:0262000000')
  })
})
