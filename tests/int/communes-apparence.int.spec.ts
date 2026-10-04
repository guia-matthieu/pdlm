// @vitest-environment node
import type { Payload } from 'payload'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Commune, User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let communeA: number
let communeB: number
let mediaB: number

async function image(): Promise<{ data: Buffer; mimetype: string; name: string; size: number }> {
  const data = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#888888' },
  })
    .png()
    .toBuffer()
  return { data, mimetype: 'image/png', name: 'test.png', size: data.length }
}

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

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'apparence-a')).id
  communeB = (await creerCommuneActive(payload, 'apparence-b')).id
  mediaB = (
    await payload.create({
      collection: 'media',
      data: { alt: 'B', tenant: communeB },
      file: await image(),
      overrideAccess: true,
    })
  ).id as number
})

afterAll(async () => {
  await payload.delete({ collection: 'media', id: mediaB, overrideAccess: true })
  await supprimerCommuneTest(payload, communeA)
  await supprimerCommuneTest(payload, communeB)
})

describe('Communes — apparence et accueil (spec § 1)', () => {
  it('une commune créée reçoit 6 démarches et 4 tuiles préremplies', async () => {
    const c = await payload.findByID({ collection: 'communes', id: communeA, overrideAccess: true })
    expect(c.accueil?.demarches?.map((d) => d.titre)).toEqual([
      'Déchets',
      'Papiers d’identité',
      'État civil',
      'Urbanisme',
      'École et cantine',
      'Conseil municipal',
    ])
    expect(c.accueil?.mosaique?.map((t) => t.illustration)).toEqual([
      'sentiers',
      'patrimoine',
      'commerces',
      'associations',
    ])
    expect(c.apparence?.gabarit).toBe('village')
  })

  // I4 : une photo d'une autre commune est refusée, par le serveur. Le refus
  // se lit dans `data.errors` (forme du helper `refus`, comme
  // relations-tenant) : le message de `ValidationError` n'est que le résumé.
  it('refuse une photo d’accueil qui appartient à une autre commune', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { photoAccueil: mediaB } },
        overrideAccess: true,
      }),
      'apparence.photoAccueil',
      /n’appartient pas à cette commune/,
    )
  })

  it('refuse une photo de mosaïque qui appartient à une autre commune', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { accueil: { mosaique: [{ libelle: 'X', illustration: 'nature', photo: mediaB }] } },
        overrideAccess: true,
      }),
      'accueil.mosaique',
      /n’appartient pas à cette commune/,
    )
  })

  // I24 : seul le format est refusé.
  it('accepte une couleur illisible, refuse un format invalide', async () => {
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurTerre: '#ffff00' } },
      overrideAccess: true,
    })
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { couleurTerre: 'jaune' } },
        overrideAccess: true,
      }),
      'apparence.couleurTerre',
      /#RRGGBB/,
    )
  })

  it('crée une version à chaque enregistrement', async () => {
    const avant = await payload.countVersions({
      collection: 'communes',
      where: { parent: { equals: communeA } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurAccent: '#123456' } },
      overrideAccess: true,
    })
    const apres = await payload.countVersions({
      collection: 'communes',
      where: { parent: { equals: communeA } },
      overrideAccess: true,
    })
    expect(apres.totalDocs).toBe(avant.totalDocs + 1)
  })
})

describe('R4 — les lignes de l’accueil se modifient en français', () => {
  const STRUCTURE =
    /Les lignes de l’accueil \(ajout, retrait ou changement d’ordre\) se modifient en français\. Dans cette langue, traduisez seulement les titres\./
  type Demarche = NonNullable<NonNullable<Commune['accueil']>['demarches']>[number]
  type Tuile = NonNullable<NonNullable<Commune['accueil']>['mosaique']>[number]
  let lignes: Demarche[]
  let tuiles: Tuile[]

  beforeAll(async () => {
    const c = await payload.findByID({
      collection: 'communes',
      id: communeA,
      depth: 0,
      overrideAccess: true,
    })
    lignes = c.accueil?.demarches ?? []
    tuiles = c.accueil?.mosaique ?? []
  })

  it('traduit un titre et un libellé en corse (mêmes lignes, même ordre)', async () => {
    await payload.update({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      overrideAccess: true,
      data: {
        accueil: {
          demarches: lignes.map((l, i) => ({
            id: l.id,
            picto: l.picto,
            lien: l.lien,
            titre: `Titre ${i}`,
          })),
          mosaique: tuiles.map((t, i) => ({
            id: t.id,
            illustration: t.illustration,
            libelle: `Libelle ${i}`,
          })),
        },
      },
    })
    const co = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      depth: 0,
      overrideAccess: true,
    })
    expect(co.accueil?.demarches?.[0]?.titre).toBe('Titre 0')
    expect(co.accueil?.mosaique?.[0]?.libelle).toBe('Libelle 0')
  })

  it('le français lu après la traduction corse est inchangé', async () => {
    const fr = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'fr',
      depth: 0,
      overrideAccess: true,
    })
    expect(fr.accueil?.demarches?.map((d) => d.titre)).toEqual([
      'Déchets',
      'Papiers d’identité',
      'État civil',
      'Urbanisme',
      'École et cantine',
      'Conseil municipal',
    ])
    expect(fr.accueil?.demarches?.map((d) => d.id)).toEqual(lignes.map((l) => l.id))
  })

  it('refuse d’ajouter une démarche en corse', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            demarches: [
              ...lignes.map((l) => ({ id: l.id, picto: l.picto, lien: l.lien })),
              { picto: 'conseil', titre: 'Novu' },
            ],
          },
        },
      }),
      'accueil.demarches',
      STRUCTURE,
    )
  })

  it('refuse de retirer une tuile en corse', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            mosaique: tuiles.slice(0, 3).map((t) => ({ id: t.id, illustration: t.illustration })),
          },
        },
      }),
      'accueil.mosaique',
      STRUCTURE,
    )
  })

  it('refuse de changer l’ordre des démarches en corse', async () => {
    const [premiere, ...reste] = lignes
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            demarches: [
              ...reste.map((l) => ({ id: l.id, picto: l.picto, lien: l.lien })),
              { id: premiere.id, picto: premiere.picto, lien: premiere.lien },
            ],
          },
        },
      }),
      'accueil.demarches',
      STRUCTURE,
    )
  })
})

describe('droits — apparence et accueil (décisions 14, 15)', () => {
  const MDP_TEST = ['motdepasse', '1234'].join('-')
  let adminA: User
  let redacteurA: User

  beforeAll(async () => {
    adminA = await payload.create({
      collection: 'users',
      data: {
        email: 'admin-a@apparence.pdlm.invalid',
        password: MDP_TEST,
        name: 'Admin A',
        tenants: [{ tenant: communeA, roles: ['admin'] }],
      },
      overrideAccess: true,
    })
    redacteurA = await payload.create({
      collection: 'users',
      data: {
        email: 'redacteur-a@apparence.pdlm.invalid',
        password: MDP_TEST,
        name: 'Rédacteur A',
        tenants: [{ tenant: communeA, roles: ['redacteur'] }],
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'users', id: adminA.id, overrideAccess: true })
    await payload.delete({ collection: 'users', id: redacteurA.id, overrideAccess: true })
  })

  it('le rédacteur ne modifie pas la fiche commune (apparence comprise)', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { couleurAccent: '#123456' } },
        overrideAccess: false,
        user: redacteurA,
      }),
    ).rejects.toThrow()
  })

  it('l’admin de la commune change les couleurs et l’accueil', async () => {
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurAccent: '#abcdef' } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(c.apparence?.couleurAccent).toBe('#abcdef')
  })

  it('le gabarit reste au seul opérateur : une écriture admin est ignorée', async () => {
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { gabarit: 'littoral' } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    // Payload ignore silencieusement un champ dont access.update est faux.
    expect(c.apparence?.gabarit).toBe('village')
  })

  it('la frise reste au seul opérateur : une écriture admin est ignorée', async () => {
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { frise: [{ piece: 'test', taille: 'grande' }] } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(c.apparence?.frise).toHaveLength(0)
  })
})
