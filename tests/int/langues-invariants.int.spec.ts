import type { Payload } from 'payload'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import type { CodeLangue } from '@/lib/langues'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { refus } from '../helpers/refus'

let payload: Payload
const aSupprimer: number[] = []

beforeAll(async () => {
  payload = await getPayloadClient()
})

afterEach(async () => {
  while (aSupprimer.length) await supprimerCommuneTest(payload, aSupprimer.pop()!)
})

async function commune(langues: Exclude<CodeLangue, 'fr'>[] = []) {
  const c = await creerCommuneActive(payload, 'langues-inv')
  aSupprimer.push(c.id)
  if (langues.length) await payload.update({ collection: 'communes', id: c.id, data: { langues }, overrideAccess: true })
  return c
}

const domaine = (communeId: number, hostname: string, langue: CodeLangue, canonique = false) =>
  refus(payload.create({ collection: 'domaines', data: { hostname, commune: communeId, langue, canonique }, overrideAccess: true }))

describe('langue d’un domaine', () => {
  it('refuse une langue que la commune n’a pas activée', async () => {
    const c = await commune()
    await expect(domaine(c.id, `${c.host}.corsica`, 'co')).rejects.toThrow(/n’a pas activé/)
  })

  it('accepte une langue activée', async () => {
    const c = await commune(['co'])
    await expect(domaine(c.id, `${c.host}.corsica`, 'co', true)).resolves.toMatchObject({ langue: 'co' })
  })
})

describe('I6 élargi — un canonique par commune ET par langue', () => {
  it('accepte un canonique corse à côté du canonique français', async () => {
    const c = await commune(['co'])
    await expect(domaine(c.id, `${c.host}.corsica`, 'co', true)).resolves.toBeDefined()
  })

  it('refuse un second canonique français', async () => {
    const c = await commune()
    await expect(domaine(c.id, `autre-${c.host}`, 'fr', true)).rejects.toThrow(/déjà un domaine canonique en français/)
  })

  it('refuse de faire passer au corse le dernier canonique français d’une commune active', async () => {
    const c = await commune(['co'])
    const fr = await payload.find({ collection: 'domaines', where: { hostname: { equals: c.host } }, overrideAccess: true })
    await expect(
      refus(payload.update({ collection: 'domaines', id: fr.docs[0].id, data: { langue: 'co' }, overrideAccess: true })),
    ).rejects.toThrow(/dernier domaine canonique en français/)
  })

  it('permet de retirer le canonique corse', async () => {
    const c = await commune(['co'])
    const co = await domaine(c.id, `${c.host}.corsica`, 'co', true)
    await expect(payload.delete({ collection: 'domaines', id: co.id, overrideAccess: true })).resolves.toBeDefined()
  })
})

describe('I15 — désactiver une langue servie à la racine', () => {
  it('refuse, en expliquant quel domaine changer d’abord', async () => {
    const c = await commune(['co'])
    await domaine(c.id, `${c.host}.corsica`, 'co', true)
    await expect(
      refus(payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true })),
    ).rejects.toThrow(new RegExp(`${c.host}\\.corsica.*changez d’abord`, 'i'))
  })

  it('accepte quand aucun domaine ne la sert', async () => {
    const c = await commune(['co'])
    await expect(
      payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true }),
    ).resolves.toMatchObject({ langues: [] })
  })
})

describe('I16 — un code de langue n’est pas un slug de page', () => {
  it('refuse une page de slug « co »', async () => {
    const c = await commune()
    await expect(
      refus(payload.create({ collection: 'pages', data: { tenant: c.id, titre: 'Co', slug: 'co', blocs: [{ blockType: 'contact' }] }, overrideAccess: true })),
    ).rejects.toThrow(/réservé/)
  })
})
