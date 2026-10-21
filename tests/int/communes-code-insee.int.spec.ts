// @vitest-environment node
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let communeA: number
let communeB: number

/** Erreur de validation attendue : chemin du champ et motif du message. */
async function refus(operation: Promise<unknown>, chemin: string, motif: RegExp) {
  const erreur = (await operation.then(
    () => null,
    (e: unknown) => e,
  )) as { data?: { errors?: Array<{ path?: string; message?: string }> } } | null
  expect(erreur, 'l’opération aurait dû être refusée').not.toBeNull()
  const [premiere] = erreur?.data?.errors ?? []
  expect(premiere?.path).toBe(chemin)
  expect(premiere?.message).toMatch(motif)
}

/** Refus d'accès attendu : APIError 403 (Forbidden), pas une erreur de validation. */
async function refusAcces(operation: Promise<unknown>) {
  const erreur = (await operation.then(
    () => null,
    (e: unknown) => e,
  )) as { status?: number } | null
  expect(erreur, 'l’opération aurait dû être refusée').not.toBeNull()
  expect(erreur?.status).toBe(403)
}

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'code-insee-a')).id
  communeB = (await creerCommuneActive(payload, 'code-insee-b')).id
})

afterAll(async () => {
  await supprimerCommuneTest(payload, communeA)
  await supprimerCommuneTest(payload, communeB)
})

describe('Communes — code INSEE (RPNT § 1)', () => {
  it('accepte 29232, 2A004 et 2B134, et le champ reste facultatif', async () => {
    for (const code of ['29232', '2A004', '2B134']) {
      const c = await payload.update({
        collection: 'communes',
        id: communeA,
        data: { codeInsee: code },
        overrideAccess: true,
        depth: 0,
      })
      expect(c.codeInsee).toBe(code)
    }
    // La remise à zéro reste possible (facultatif ≠ obligatoire).
    const pose = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { codeInsee: '29232' },
      overrideAccess: true,
      depth: 0,
    })
    expect(pose.codeInsee).toBe('29232')
    const efface = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { codeInsee: null },
      overrideAccess: true,
      depth: 0,
    })
    expect(efface.codeInsee).toBeNull()
  })

  it('refuse 2C004, 2932, 292320 et ab123', async () => {
    // communeA garde « 2B134 » du test précédent : les refus ne l'écrasent pas.
    for (const code of ['2C004', '2932', '292320', 'ab123']) {
      await refus(
        payload.update({
          collection: 'communes',
          id: communeA,
          data: { codeInsee: code },
          overrideAccess: true,
        }),
        'codeInsee',
        /INSEE/,
      )
    }
  })

  it('refuse un code déjà pris par une autre commune', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { codeInsee: '2B134' }, // pris par communeA
        overrideAccess: true,
      }),
      'codeInsee',
      /unique/i,
    )
    // Un code distinct passe : le refus n'est pas « tout refuser ».
    const c = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { codeInsee: '29232' },
      overrideAccess: true,
      depth: 0,
    })
    expect(c.codeInsee).toBe('29232')
  })

  it('normalise en majuscules : 2a004 stocké 2A004, l’unicité ignore la casse', async () => {
    // Sans normalisation, « 2a004 » et « 2A004 » coexisteraient malgré
    // l’unicité, et le rapprochement avec la ligne ANCT échouerait.
    const pose = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { codeInsee: '2a004' }, // distinct du « 2B134 » de communeA
      overrideAccess: true,
      depth: 0,
    })
    expect(pose.codeInsee).toBe('2A004')
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { codeInsee: '2A004' }, // pris par communeB, à la casse près
        overrideAccess: true,
      }),
      'codeInsee',
      /unique/i,
    )
    // Ménage : communeB repart sans code, communeA garde « 2B134 ».
    await payload.update({
      collection: 'communes',
      id: communeB,
      data: { codeInsee: null },
      overrideAccess: true,
    })
  })
})

describe('droits — code INSEE (opérateur et admin, personne d’autre)', () => {
  const MDP_TEST = ['motdepasse', '1234'].join('-')
  let adminA: User
  let redacteurA: User
  let mandataireA: User
  let operateur: User

  // Rejouable après une exécution interrompue : purge par critère, pas par id.
  const purger = async () => {
    await payload.delete({
      collection: 'users',
      where: { email: { like: '@code-insee.pdlm.invalid' } },
      overrideAccess: true,
    })
  }

  beforeAll(async () => {
    await purger()
    const mkUser = (suffixe: string, roles: Array<'admin' | 'redacteur' | 'mandataire'>) =>
      payload.create({
        collection: 'users',
        data: {
          email: `${suffixe}@code-insee.pdlm.invalid`,
          password: MDP_TEST,
          name: suffixe,
          tenants: [{ tenant: communeA, roles }],
        },
        overrideAccess: true,
      })
    adminA = await mkUser('admin-a', ['admin'])
    redacteurA = await mkUser('redacteur-a', ['redacteur'])
    mandataireA = await mkUser('mandataire-a', ['mandataire'])
    operateur = await payload.create({
      collection: 'users',
      data: {
        email: 'operateur@code-insee.pdlm.invalid',
        password: MDP_TEST,
        name: 'Opérateur',
        role: 'operateur',
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await purger()
  })

  // Rédacteur et mandataire : même accès collection (update limité à
  // l’opérateur et aux admins de la commune), prouvé aussi dans
  // communes-apparence et mandataire-i36.
  it('le rédacteur ne modifie pas le code INSEE (refus 403)', async () => {
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { codeInsee: '29000' },
        overrideAccess: false,
        user: redacteurA,
      }),
    )
  })

  it('le mandataire ne modifie pas non plus le code INSEE (refus 403)', async () => {
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { codeInsee: '29000' },
        overrideAccess: false,
        user: mandataireA,
      }),
    )
  })

  it('l’admin de la commune et l’opérateur posent le code', async () => {
    const parAdmin = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { codeInsee: '2A004' },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(parAdmin.codeInsee).toBe('2A004')
    const parOperateur = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { codeInsee: '2B134' },
      overrideAccess: false,
      user: operateur,
      depth: 0,
    })
    expect(parOperateur.codeInsee).toBe('2B134')
  })
})

describe('activation — code INSEE facultatif', () => {
  it('une commune sans code INSEE s’active (le code n’est jamais bloquant)', async () => {
    // creerCommuneActive crée SANS code puis active : c'est exactement le cas.
    const { id } = await creerCommuneActive(payload, 'code-insee-sans-code')
    const c = await payload.findByID({
      collection: 'communes',
      id,
      overrideAccess: true,
      depth: 0,
    })
    expect(c.actif).toBe(true)
    expect(c.codeInsee).toBeNull()
    await supprimerCommuneTest(payload, id)
  })
})
