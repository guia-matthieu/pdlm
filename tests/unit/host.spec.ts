import { describe, expect, it, beforeAll } from 'vitest'

import { candidatCommune, normaliserHost, sansWww } from '@/lib/commune'
import { estDomainePlateforme } from '@/proxy'

describe('normaliserHost', () => {
  it('minuscules, sans port ni point final', () => {
    expect(normaliserHost('Mairie-SaintX.FR:3000')).toBe('mairie-saintx.fr')
    expect(normaliserHost('www.Exemple.fr.')).toBe('www.exemple.fr')
  })
})

describe('sansWww', () => {
  it('retire le www initial', () => {
    expect(sansWww('www.exemple.fr')).toBe('exemple.fr')
    expect(sansWww('exemple.fr')).toBe('exemple.fr')
  })
})

describe('candidatCommune', () => {
  beforeAll(() => {
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
  })

  it('sous-domaine de la plateforme → slug exact', () => {
    expect(candidatCommune('saint-ex.plateforme.test:3000')).toEqual({
      slugPlateforme: 'saint-ex',
    })
  })

  it('host de la plateforme lui-même → null (pas une commune)', () => {
    expect(candidatCommune('plateforme.test')).toBeNull()
    expect(candidatCommune('admin.plateforme.test')).toBeNull()
    expect(candidatCommune('www.plateforme.test')).toBeNull()
  })

  it('domaine propre → recherche par domaine (www retiré)', () => {
    expect(candidatCommune('www.mairie-saintx.fr')).toEqual({ domaine: 'mairie-saintx.fr' })
    expect(candidatCommune('mairie-saintx.fr')).toEqual({ domaine: 'mairie-saintx.fr' })
  })

  it('sous-domaine quelconque d’un domaine communal reste un domaine exact', () => {
    expect(candidatCommune('agenda.mairie-saintx.fr')).toEqual({
      domaine: 'agenda.mairie-saintx.fr',
    })
  })

  it('localhost nu → fallback dev uniquement hors production', () => {
    const precedent = process.env.NODE_ENV
    process.env.DEFAULT_COMMUNE_SLUG = 'saint-ex'

    Object.assign(process.env, { NODE_ENV: 'development' })
    expect(candidatCommune('localhost:3000')).toEqual({ fallbackDev: 'saint-ex' })

    Object.assign(process.env, { NODE_ENV: 'production' })
    expect(candidatCommune('localhost:3000')).toBeNull()
    expect(candidatCommune('saint-ex.localhost:3000')).toBeNull()

    Object.assign(process.env, { NODE_ENV: precedent })
  })

  it('*.localhost en dev → traité comme sous-domaine', () => {
    const precedent = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: 'development' })
    expect(candidatCommune('valvert.localhost:3000')).toEqual({ slugPlateforme: 'valvert' })
    Object.assign(process.env, { NODE_ENV: 'production' })
    expect(candidatCommune('valvert.localhost:3000')).toBeNull()
    Object.assign(process.env, { NODE_ENV: precedent })
  })

  it('stats.<plateforme> (interface Umami) → null, jamais une commune de slug « stats »', () => {
    expect(candidatCommune('stats.plateforme.test')).toBeNull()

    const precedent = process.env.NODE_ENV
    Object.assign(process.env, { NODE_ENV: 'development' })
    expect(candidatCommune('stats.localhost:3000')).toBeNull()
    Object.assign(process.env, { NODE_ENV: precedent })
  })
})

describe('estDomainePlateforme (I7)', () => {
  it('reconnaît la plateforme, son www et son admin — et rien d’autre', () => {
    const precedent = process.env.PLATFORM_DOMAIN
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
    expect(estDomainePlateforme('plateforme.test')).toBe(true)
    expect(estDomainePlateforme('www.plateforme.test:3000')).toBe(true)
    expect(estDomainePlateforme('admin.plateforme.test')).toBe(true)
    expect(estDomainePlateforme('mairie-saintx.fr')).toBe(false)
    expect(estDomainePlateforme('saint-ex.plateforme.test')).toBe(false)
    process.env.PLATFORM_DOMAIN = precedent
  })

  it('PLATFORM_DOMAIN absent : permissif en dev, jamais en production', () => {
    const domaine = process.env.PLATFORM_DOMAIN
    const env = process.env.NODE_ENV
    delete process.env.PLATFORM_DOMAIN

    Object.assign(process.env, { NODE_ENV: 'development' })
    expect(estDomainePlateforme('mairie-saintx.fr')).toBe(true)

    // En production, une variable oubliée ne doit pas ouvrir /api sur tous
    // les domaines communaux : on échoue du côté fermé.
    Object.assign(process.env, { NODE_ENV: 'production' })
    expect(estDomainePlateforme('mairie-saintx.fr')).toBe(false)

    process.env.PLATFORM_DOMAIN = domaine
    Object.assign(process.env, { NODE_ENV: env })
  })
})
