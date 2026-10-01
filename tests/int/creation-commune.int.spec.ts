import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/**
 * I1/I36 — la commune d'une création est celle des DONNÉES FINALES : le plugin
 * multi-tenant remplit `tenant` depuis le cookie `payload-tenant` après le
 * contrôle d'accès. Un compte admin de A et rédacteur de B ne doit pas créer
 * une publication dans B en passant par le cookie.
 */
let payload: Payload
let communeA: number
let communeB: number
let compteId: number
let redacteurBId: number
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@creation-commune.pdlm.invalid'

const reqAvec = async (userId: number, cookieTenant?: number) => {
  const user = {
    ...(await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })),
    collection: 'users',
  }
  return {
    user,
    context: {},
    headers: new Headers(cookieTenant ? { cookie: `payload-tenant=${cookieTenant}` } : {}),
  } as unknown as PayloadRequest
}
const contenu = {
  root: {
    type: 'root',
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    children: [
      {
        type: 'paragraph',
        version: 1,
        direction: null,
        format: '',
        indent: 0,
        textFormat: 0,
        textStyle: '',
        children: [
          {
            type: 'text',
            version: 1,
            text: 'Texte',
            format: 0,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
      },
    ],
  },
}
const alerte = (tenant?: number) => ({
  niveau: 'info' as const,
  message: 'Test création',
  dateDebut: new Date().toISOString(),
  dateFin: new Date(Date.now() + 3600_000).toISOString(),
  ...(tenant ? { tenant } : {}),
})

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'cc-a')).id
  communeB = (await creerCommuneActive(payload, 'cc-b')).id
  compteId = (
    await payload.create({
      collection: 'users',
      data: {
        email: `mixte${DOMAINE}`,
        password: MDP_TEST,
        tenants: [
          { tenant: communeA, roles: ['admin'] },
          { tenant: communeB, roles: ['redacteur'] },
        ],
      },
      overrideAccess: true,
    })
  ).id
  redacteurBId = (
    await payload.create({
      collection: 'users',
      data: {
        email: `redacteur-b${DOMAINE}`,
        password: MDP_TEST,
        tenants: [{ tenant: communeB, roles: ['redacteur'] }],
      },
      overrideAccess: true,
    })
  ).id
})

afterAll(async () => {
  await payload.delete({
    collection: 'alertes',
    where: { message: { equals: 'Test création' } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'pages',
    where: { titre: { equals: 'Page création cookie' } },
    overrideAccess: true,
  })
  for (const id of [compteId, redacteurBId]) {
    await payload.delete({ collection: 'users', id, overrideAccess: true })
  }
  for (const id of [communeA, communeB]) await supprimerCommuneTest(payload, id)
})

describe('commune finale d’une création', () => {
  it('(a) refuse une publication dans B posée par le cookie, sans droit de publier dans B', async () => {
    const erreur = await payload
      .create({
        collection: 'alertes',
        data: alerte(),
        req: await reqAvec(compteId, communeB),
        overrideAccess: false,
      })
      .then(
        () => null,
        (e: unknown) => e as { status?: number },
      )
    expect(erreur, 'la création aurait dû être refusée').not.toBeNull()
    expect(erreur?.status).toBe(403)
  })

  it('(b) accepte la même création dans A avec un tenant explicite', async () => {
    const cree = await payload.create({
      collection: 'alertes',
      data: alerte(communeA),
      req: await reqAvec(compteId, communeB),
      overrideAccess: false,
    })
    expect(cree.id).toBeDefined()
  })

  it('(c) un rédacteur de B crée un brouillon dans B via le sélecteur (cookie)', async () => {
    const cree = await payload.create({
      collection: 'pages',
      data: {
        titre: 'Page création cookie',
        slug: undefined as unknown as string,
        _status: 'draft',
        blocs: [{ blockType: 'texteRiche', contenu }],
      } as never,
      draft: true,
      req: await reqAvec(redacteurBId, communeB),
      overrideAccess: false,
    })
    const tenant = typeof cree.tenant === 'object' ? cree.tenant?.id : cree.tenant
    expect(tenant).toBe(communeB)
  })
})
