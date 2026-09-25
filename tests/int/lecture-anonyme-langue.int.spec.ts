import type { Payload } from 'payload'

import config from '@payload-config'
import { handleEndpoints } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { lectureAnonymeEnFrancais } from '@/lib/champs-langue'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/**
 * R14 : une traduction « à relire » est invisible au public, y compris par
 * l'API REST anonyme (le proxy laisse passer `/api/*` sur le domaine de la
 * plateforme). Le site public, lui, lit par l'API locale en corse.
 */
let payload: Payload
let commune: { id: number; host: string }
let idEvenement: number

const FR = 'Marché du samedi'
const CO = 'Mercatu di u sabbatu (à relire)'

/** Vrai passage par le routeur REST de Payload (celui de `api/[...slug]/route.ts`). */
async function getRest(
  chemin: string,
): Promise<{ status: number; corps: Record<string, unknown> }> {
  const reponse = await handleEndpoints({
    config,
    request: new Request(`http://localhost:3000/api/${chemin}`, { method: 'GET' }),
  })
  return { status: reponse.status, corps: (await reponse.json()) as Record<string, unknown> }
}

beforeAll(async () => {
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'lecture-anonyme')
  const evenement = await payload.create({
    collection: 'evenements',
    data: {
      tenant: commune.id,
      titre: FR,
      dateDebut: '2026-10-03T08:00:00.000Z',
      dateFin: '2026-10-03T12:00:00.000Z',
    },
    overrideAccess: true,
  })
  idEvenement = evenement.id
  await payload.update({
    collection: 'evenements',
    id: idEvenement,
    locale: 'co',
    data: { titre: CO, traduction: 'a-relire' },
    overrideAccess: true,
  })
})

afterAll(async () => {
  await payload.delete({
    collection: 'evenements',
    where: { tenant: { equals: commune.id } },
    overrideAccess: true,
  })
  await supprimerCommuneTest(payload, commune.id)
})

describe('R14 — lecture REST anonyme : toujours en français', () => {
  it('findByID en `co` renvoie le titre français', async () => {
    const { status, corps } = await getRest(`evenements/${idEvenement}?locale=co&depth=0`)
    expect(status).toBe(200)
    expect(corps.titre).toBe(FR)
    expect(corps.traduction).not.toBe('a-relire')
  })

  it('find en `co` renvoie le titre français', async () => {
    const { corps } = await getRest(`evenements?locale=co&depth=0&where[id][equals]=${idEvenement}`)
    const docs = corps.docs as Array<Record<string, unknown>>
    expect(docs).toHaveLength(1)
    expect(docs[0]?.titre).toBe(FR)
  })

  it('`locale=all` ne livre aucune valeur corse non validée', async () => {
    const { corps } = await getRest(`evenements/${idEvenement}?locale=all&depth=0`)
    expect(JSON.stringify(corps)).not.toContain(CO)
  })

  it('un filtre sur un champ localisé en `co` ne révèle pas le texte corse', async () => {
    const { corps } = await getRest(
      `evenements?locale=co&depth=0&where[titre][equals]=${encodeURIComponent(CO)}`,
    )
    expect(corps.totalDocs).toBe(0)
  })

  it('findDistinct en `co` ne livre pas le texte corse', async () => {
    const resultat = await payload.findDistinct({
      collection: 'evenements',
      field: 'titre',
      locale: 'co',
      where: { id: { equals: idEvenement } },
      overrideAccess: false,
      req: { payloadAPI: 'REST' },
    })
    expect(JSON.stringify(resultat)).not.toContain(CO)
  })
})

describe('R14 — non-régression : l’API locale (site public) lit toujours la langue demandée', () => {
  it('sans utilisateur, `overrideAccess`, en `co` : titre corse', async () => {
    const evenement = await payload.findByID({
      collection: 'evenements',
      id: idEvenement,
      locale: 'co',
      depth: 0,
      overrideAccess: true,
    })
    expect(evenement.titre).toBe(CO)
  })

  it('sans utilisateur, `overrideAccess: false`, en `co` : titre corse', async () => {
    const evenement = await payload.findByID({
      collection: 'evenements',
      id: idEvenement,
      locale: 'co',
      depth: 0,
      overrideAccess: false,
    })
    expect(evenement.titre).toBe(CO)
  })
})

describe('R14 — toutes les collections à champs localisés sont couvertes', () => {
  it('chaque collection qui a un champ localisé porte le hook', () => {
    const localisees = payload.config.collections.filter((c) =>
      JSON.stringify(c.fields, (cle, valeur) =>
        typeof valeur === 'function' ? undefined : valeur,
      ).includes('"localized":true'),
    )
    expect(localisees.map((c) => c.slug).sort()).toEqual([
      'actualites',
      'alertes',
      'communes',
      'documents',
      'evenements',
      'media',
      'menus',
      'pages',
    ])
    for (const collection of localisees) {
      expect(collection.hooks.beforeOperation, collection.slug).toContain(lectureAnonymeEnFrancais)
    }
  })
})
