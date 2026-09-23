import { afterEach, describe, expect, it } from 'vitest'

import { identifiantSite, uuidV5 } from '@/lib/umami/uuid'

describe('uuidV5', () => {
  it('vecteur de référence RFC 4122 (espace DNS)', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
  })
})

describe('identifiantSite', () => {
  const avant = process.env.PLATFORM_DOMAIN
  afterEach(() => {
    if (avant === undefined) delete process.env.PLATFORM_DOMAIN
    else process.env.PLATFORM_DOMAIN = avant
  })

  it('stable pour une même commune, distinct d’une commune à l’autre et d’une plateforme à l’autre', () => {
    process.env.PLATFORM_DOMAIN = 'pdlm.example.fr'
    const a = identifiantSite(12)
    expect(identifiantSite(12)).toBe(a)
    expect(identifiantSite('12')).toBe(a)
    expect(identifiantSite(13)).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    process.env.PLATFORM_DOMAIN = 'autre.example.fr'
    expect(identifiantSite(12)).not.toBe(a)
  })
})
