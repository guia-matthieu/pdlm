import { afterEach, describe, expect, it } from 'vitest'

import { hostnamesReserves } from '@/collections/Communes'

describe('I6 élargi — le nom de l’interface Umami est réservé', () => {
  const avant = process.env.UMAMI_PUBLIC_URL
  afterEach(() => {
    if (avant === undefined) delete process.env.UMAMI_PUBLIC_URL
    else process.env.UMAMI_PUBLIC_URL = avant
  })

  it('stats.<plateforme> ne peut pas devenir le domaine d’une commune', () => {
    process.env.UMAMI_PUBLIC_URL = 'https://stats.pdlm.example.fr'
    expect(hostnamesReserves()).toContain('stats.pdlm.example.fr')
  })

  it('sans UMAMI_PUBLIC_URL, rien de plus', () => {
    delete process.env.UMAMI_PUBLIC_URL
    expect(hostnamesReserves().some((h) => h.startsWith('stats.'))).toBe(false)
  })
})
