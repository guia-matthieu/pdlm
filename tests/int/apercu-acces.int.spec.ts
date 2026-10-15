// @vitest-environment node
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'
import { peutApercevoir } from '@/lib/apercu'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/**
 * Accès à l'aperçu d'apparence (spec gabarits-couleurs § 4, I28) : opérateur
 * ou admin de la commune demandée, personne d'autre. Décision 15 : le
 * mandataire, qui n'a pas la main sur la fiche commune, n'y a pas accès — le
 * gabarit et la frise restent à l'opérateur, les couleurs à l'admin.
 */
describe('apercu — accès (I28)', () => {
  const MDP_TEST = ['motdepasse', '1234'].join('-')
  // SIRET propre à ce fichier : `lignes-mandat` crée '32000000000002' en parallèle.
  const SIRET_TEST = '35000000000005'

  let payload: Payload
  let communeA: number
  let communeB: number
  let adminA: User
  let adminB: User
  let redacteurA: User
  let mandataireA: User
  let operateur: User

  // Rejouable après une exécution interrompue : les utilisateurs et
  // l'organisation survivent à la suppression des communes de test et
  // feraient échouer la création suivante (e-mail ou SIRET déjà pris).
  const purger = async () => {
    await payload.delete({
      collection: 'users',
      where: { email: { like: '@apercu.pdlm.invalid' } },
      overrideAccess: true,
    })
    const restes = await payload.find({
      collection: 'organisations',
      where: { siret: { equals: SIRET_TEST } },
      overrideAccess: true,
      depth: 0,
    })
    for (const o of restes.docs) {
      await payload.delete({
        collection: 'mandats',
        where: { organisation: { equals: o.id } },
        overrideAccess: true,
      })
      await payload.delete({ collection: 'organisations', id: o.id, overrideAccess: true })
    }
  }

  beforeAll(async () => {
    payload = await getPayloadClient()
    await purger()
    communeA = (await creerCommuneActive(payload, 'apercu-a')).id
    communeB = (await creerCommuneActive(payload, 'apercu-b')).id

    const mkUser = (suffixe: string, roles: Array<'admin' | 'redacteur'>, commune: number) =>
      payload.create({
        collection: 'users',
        data: {
          email: `${suffixe}@apercu.pdlm.invalid`,
          password: MDP_TEST,
          name: suffixe,
          tenants: [{ tenant: commune, roles }],
        },
        overrideAccess: true,
      })
    adminA = await mkUser('admin-a', ['admin'], communeA)
    adminB = await mkUser('admin-b', ['admin'], communeB)
    redacteurA = await mkUser('redacteur-a', ['redacteur'], communeA)
    operateur = await payload.create({
      collection: 'users',
      data: {
        email: 'operateur@apercu.pdlm.invalid',
        password: MDP_TEST,
        name: 'Opérateur',
        role: 'operateur',
      },
      overrideAccess: true,
    })
    // Le rôle « mandataire » se calcule depuis un mandat actif (lignesMandat),
    // il ne se pose pas dans `tenants` : organisation + mandat + agent.
    const organisation = (
      await payload.create({
        collection: 'organisations',
        data: { nom: 'CC Aperçu', nature: 'epci', siret: SIRET_TEST },
        overrideAccess: true,
      })
    ).id
    await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      overrideAccess: true,
    })
    mandataireA = await payload.create({
      collection: 'users',
      data: {
        email: 'mandataire-a@apercu.pdlm.invalid',
        password: MDP_TEST,
        name: 'Mandataire A',
        organisation,
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    // Utilisateurs et mandat d'abord : `supprimerCommuneTest` refuserait la
    // commune tant qu'un mandat vivant lui est lié.
    await purger()
    await supprimerCommuneTest(payload, communeA)
    await supprimerCommuneTest(payload, communeB)
  })

  it('un visiteur anonyme n’aperçoit rien', () => {
    expect(peutApercevoir(null, communeA)).toBe(false)
    expect(peutApercevoir(undefined, communeA)).toBe(false)
  })

  it('le rédacteur de la commune n’aperçoit pas', () => {
    expect(peutApercevoir(redacteurA, communeA)).toBe(false)
  })

  it('l’admin d’une autre commune n’aperçoit pas', () => {
    expect(peutApercevoir(adminB, communeA)).toBe(false)
  })

  it('l’admin de la commune aperçoit', () => {
    expect(peutApercevoir(adminA, communeA)).toBe(true)
  })

  it('l’opérateur aperçoit toute commune', () => {
    expect(peutApercevoir(operateur, communeA)).toBe(true)
    expect(peutApercevoir(operateur, communeB)).toBe(true)
  })

  // Décision 15 : le mandataire publie, mais la fiche commune — donc
  // l'apparence et son aperçu — ne lui appartient pas.
  it('le mandataire de la commune n’aperçoit pas', () => {
    expect(peutApercevoir(mandataireA, communeA)).toBe(false)
  })
})
