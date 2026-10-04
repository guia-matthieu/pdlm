// @vitest-environment node
import type { Payload } from 'payload'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Actualite, User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

/**
 * I4 — une relation ne franchit jamais la frontière d'une commune, y compris
 * là où la revue v0.1.0 a trouvé des trous : le logo de la commune, et les
 * nœuds upload / relationship / lien interne des textes riches Lexical
 * (injectables par l'API même si le sélecteur de l'admin est filtré).
 */

let payload: Payload
let communeA: number
let communeB: number
let adminA: User
let mediaA: number
let mediaB: number
let pageA: number
let pageB: number

const MDP_TEST = ['motdepasse', '1234'].join('-')
const EMAIL_ADMIN_A = 'admin-a@relations-tenant.pdlm.invalid'

/** Erreur de validation I4 attendue : chemin du champ et motif du message. */
async function refuse(operation: Promise<unknown>, chemin: RegExp, motif: RegExp) {
  const erreur = (await operation.then(
    () => null,
    (e: unknown) => e,
  )) as { data?: { errors?: Array<{ path?: string; message?: string }> } } | null
  expect(erreur, 'l’opération aurait dû être refusée').not.toBeNull()
  const [premiere] = erreur?.data?.errors ?? []
  expect(premiere?.path).toMatch(chemin)
  expect(premiere?.message).toMatch(motif)
}

const texte = (contenu: string) => ({
  type: 'text',
  text: contenu,
  version: 1,
  detail: 0,
  format: 0,
  mode: 'normal',
  style: '',
})

const paragraphe = (...children: unknown[]) => ({
  type: 'paragraph',
  version: 1,
  children,
  direction: null,
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
})

/** État Lexical construit à la main : nœuds volontairement hors commune. */
type TexteRiche = NonNullable<Actualite['contenu']>

const etat = (...children: unknown[]) =>
  ({
    root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
  }) as unknown as TexteRiche

const upload = (relationTo: string, value: number) => ({
  type: 'upload',
  version: 3,
  format: '',
  id: `upload-${relationTo}-${value}`,
  fields: null,
  relationTo,
  value,
})

const relation = (relationTo: string, value: number) => ({
  type: 'relationship',
  version: 2,
  format: '',
  relationTo,
  value,
})

const lienInterne = (relationTo: string, value: number) =>
  paragraphe({
    type: 'link',
    version: 3,
    fields: { linkType: 'internal', newTab: false, doc: { relationTo, value } },
    children: [texte('lien')],
    direction: null,
    format: '',
    indent: 0,
  })

/** Slug généré par le hook `uniqueSlugParCommune`. */
const SLUG_GENERE = undefined as unknown as string

const page = (titre: string, tenant: number, contenu: TexteRiche) => ({
  titre,
  slug: SLUG_GENERE,
  tenant,
  _status: 'draft' as const,
  blocs: [{ blockType: 'texteRiche' as const, contenu }],
})

const actualite = (titre: string, tenant: number, contenu: TexteRiche) => ({
  titre,
  slug: SLUG_GENERE,
  tenant,
  resume: 'Résumé',
  contenu,
  _status: 'draft' as const,
})

async function mkMedia(tenant: number, nom: string) {
  const data = await sharp({
    create: { width: 2, height: 2, channels: 3, background: '#000091' },
  })
    .png()
    .toBuffer()
  const doc = await payload.create({
    collection: 'media',
    data: { alt: nom, tenant },
    file: { data, mimetype: 'image/png', name: `${nom}.png`, size: data.length },
    overrideAccess: true,
  })
  return doc.id
}

beforeAll(async () => {
  payload = await getPayloadClient()

  // Restes d'une exécution interrompue
  const anciennes = await payload.find({
    collection: 'communes',
    where: { slug: { like: 'relations-tenant-' } },
    overrideAccess: true,
    limit: 10,
  })
  const idsAnciennes = anciennes.docs.map((d) => d.id)
  if (idsAnciennes.length > 0) {
    for (const collection of ['pages', 'actualites', 'evenements', 'media'] as const) {
      await payload.delete({
        collection,
        where: { tenant: { in: idsAnciennes } },
        overrideAccess: true,
      })
    }
  }
  await payload.delete({
    collection: 'users',
    where: { email: { like: '@relations-tenant.pdlm.invalid' } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'relations-tenant-' } },
    overrideAccess: true,
  })

  const mkCommune = async (lettre: string) =>
    (
      await payload.create({
        collection: 'communes',
        data: { nom: `Relations ${lettre}`, slug: `relations-tenant-${lettre}`, actif: false },
        overrideAccess: true,
      })
    ).id
  communeA = await mkCommune('a')
  communeB = await mkCommune('b')

  adminA = await payload.create({
    collection: 'users',
    data: {
      email: EMAIL_ADMIN_A,
      password: MDP_TEST,
      name: 'Admin A',
      tenants: [{ tenant: communeA, roles: ['admin'] }],
    },
    overrideAccess: true,
  })

  mediaA = await mkMedia(communeA, 'relations-tenant-a')
  mediaB = await mkMedia(communeB, 'relations-tenant-b')
  pageA = (
    await payload.create({
      collection: 'pages',
      data: page('Page A', communeA, etat(paragraphe(texte('A')))),
      overrideAccess: true,
    })
  ).id
  pageB = (
    await payload.create({
      collection: 'pages',
      data: page('Page B', communeB, etat(paragraphe(texte('B')))),
      overrideAccess: true,
    })
  ).id
})

afterAll(async () => {
  // Par slug : une commune créée par un test en échec est nettoyée aussi
  const ids = (
    await payload.find({
      collection: 'communes',
      where: { slug: { like: 'relations-tenant-' } },
      overrideAccess: true,
      limit: 10,
    })
  ).docs.map((d) => d.id)
  for (const collection of ['pages', 'actualites', 'evenements'] as const) {
    await payload.delete({ collection, where: { tenant: { in: ids } }, overrideAccess: true })
  }
  // Le logo référence un média : le retirer avant de supprimer les médias
  await payload.update({
    collection: 'communes',
    where: { id: { in: ids } },
    data: { logo: null },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'media',
    where: { tenant: { in: ids } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'users',
    where: { email: { like: '@relations-tenant.pdlm.invalid' } },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'communes', where: { id: { in: ids } }, overrideAccess: true })
})

describe('I4 — logo de la commune', () => {
  it('admin de A : le logo de A peut être un média de A', async () => {
    const commune = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { logo: mediaA },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(commune.logo).toBe(mediaA)
  })

  it('admin de A : le logo de A ne peut pas être un média de B', async () => {
    await refuse(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { logo: mediaB },
        overrideAccess: false,
        user: adminA,
      }),
      /^logo$/,
      /n’appartient pas à cette commune/,
    )
  })

  it('opérateur : une commune créée ne peut pas prendre le média d’une autre comme logo', async () => {
    await refuse(
      payload.create({
        collection: 'communes',
        data: { nom: 'Relations C', slug: 'relations-tenant-c', actif: false, logo: mediaB },
        overrideAccess: true,
      }),
      /^logo$/,
      /n’appartient pas à cette commune/,
    )
  })
})

describe('I4 — image à la une d’une actualité', () => {
  it('actualité de A : image de B refusée, erreur signalée sur le champ image', async () => {
    await refuse(
      payload.create({
        collection: 'actualites',
        data: { ...actualite('Fuite une', communeA, etat(paragraphe(texte('x')))), image: mediaB },
        overrideAccess: true,
      }),
      /^image$/,
      /n’appartient pas à cette commune/,
    )
  })
})

describe('I4 — références dans les textes riches', () => {
  it('témoin : image, relation et lien interne vers des contenus de la même commune acceptés', async () => {
    const doc = await payload.create({
      collection: 'pages',
      data: page(
        'Témoin A',
        communeA,
        etat(upload('media', mediaA), relation('pages', pageA), lienInterne('pages', pageA)),
      ),
      overrideAccess: true,
    })
    expect(doc.id).toBeDefined()
  })

  it('page de A : image d’un média de B dans un bloc texte riche refusée', async () => {
    await refuse(
      payload.create({
        collection: 'pages',
        data: page('Fuite image', communeA, etat(upload('media', mediaB))),
        overrideAccess: true,
      }),
      /^blocs\.0\.contenu$/,
      /n’appartient pas à cette commune/,
    )
  })

  it('page de A : image de B dans un accordéon refusée', async () => {
    await refuse(
      payload.create({
        collection: 'pages',
        data: {
          titre: 'Fuite accordéon',
          slug: SLUG_GENERE,
          tenant: communeA,
          _status: 'draft' as const,
          blocs: [
            {
              blockType: 'accordeon' as const,
              elements: [{ titre: 'Question', contenu: etat(upload('media', mediaB)) }],
            },
          ],
        },
        overrideAccess: true,
      }),
      /^blocs\.0\.elements\.0\.contenu$/,
      /n’appartient pas à cette commune/,
    )
  })

  it('actualité de A : relation vers une page de B refusée', async () => {
    await refuse(
      payload.create({
        collection: 'actualites',
        data: actualite('Fuite relation', communeA, etat(relation('pages', pageB))),
        overrideAccess: true,
      }),
      /^contenu$/,
      /n’appartient pas à cette commune/,
    )
  })

  it('actualité de A : lien interne vers une page de B refusé', async () => {
    await refuse(
      payload.create({
        collection: 'actualites',
        data: actualite('Fuite lien', communeA, etat(lienInterne('pages', pageB))),
        overrideAccess: true,
      }),
      /^contenu$/,
      /n’appartient pas à cette commune/,
    )
  })

  it('actualité de A : relation vers une collection non communale (users) refusée', async () => {
    await refuse(
      payload.create({
        collection: 'actualites',
        data: actualite('Fuite compte', communeA, etat(relation('users', adminA.id))),
        overrideAccess: true,
      }),
      /^contenu$/,
      /contenus de la commune/,
    )
  })

  it('événement de A : image de B dans la description refusée', async () => {
    await refuse(
      payload.create({
        collection: 'evenements',
        data: {
          titre: 'Fuite agenda',
          tenant: communeA,
          dateDebut: '2026-10-01T10:00:00.000Z',
          dateFin: '2026-10-01T12:00:00.000Z',
          description: etat(upload('media', mediaB)),
        },
        overrideAccess: true,
      }),
      /^description$/,
      /n’appartient pas à cette commune/,
    )
  })
})
