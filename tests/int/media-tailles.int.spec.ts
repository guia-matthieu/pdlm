// @vitest-environment node
import type { Payload } from 'payload'

import fs from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

import { regenererUn } from '../../scripts/regenerer-tailles'

/**
 * Tâche 6 (spec § 3, « Cadrages d'image ») — les tailles `heros-haut`
 * (1600×1100) et `panorama` (2000×800) sont recadrées au point focal
 * (`focalPoint` Payload), pas au centre. Image témoin 2400×1600, point
 * focal (90, 10) : un marqueur bleu au point focal et un marqueur rouge au
 * coin supérieur droit doivent tous deux survivre aux deux recadrages —
 * le centrage perdrait le rouge (fenêtre 1600 large dans 1650 réduits).
 */

let payload: Payload
let commune: number
let mediaId: number

/** Nom des tailles attendu dans `doc.sizes` (le nom exact, tiret compris). */
type Taille = { filename?: string | null; height?: number | null; width?: number | null }

/** Image témoin : fond vert, marqueur bleu au point focal (2160, 160), rouge au coin (2250..2400 × 0..150). */
async function imageTemoin() {
  const bleu = await sharp({
    create: { width: 160, height: 160, channels: 3, background: '#0000ff' },
  })
    .png()
    .toBuffer()
  const rouge = await sharp({
    create: { width: 150, height: 150, channels: 3, background: '#ff0000' },
  })
    .png()
    .toBuffer()
  return sharp({
    create: { width: 2400, height: 1600, channels: 3, background: '#22783c' },
  })
    .composite([
      { input: bleu, left: 2080, top: 80 },
      { input: rouge, left: 2250, top: 0 },
    ])
    .png()
    .toBuffer()
}

/** Pixel (x, y) d'une image décodée. */
async function pixel(image: Buffer, x: number, y: number) {
  const { data, info } = await sharp(image)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true })
  return { b: data[2], g: data[1], r: data[0], canaux: info.channels }
}

const estBleu = (p: Awaited<ReturnType<typeof pixel>>) => p.b > 200 && p.r < 100 && p.g < 100
const estRouge = (p: Awaited<ReturnType<typeof pixel>>) => p.r > 200 && p.g < 100 && p.b < 100
const estVert = (p: Awaited<ReturnType<typeof pixel>>) => p.g > 100 && p.r < 100 && p.b < 100

/** Lit une taille générée sur le disque (stockage local des tests). */
async function lireTaille(t: Taille | undefined, nom: string) {
  expect(t, `taille ${nom} absente`).toBeTruthy()
  expect(t!.filename, `la taille ${nom} doit avoir un fichier`).toBeTruthy()
  return fs.readFile(path.join('media', t!.filename!))
}

/** Pixels bruts d'une taille, pour une comparaison indépendante de l'encodage. */
async function pixels(image: Buffer) {
  return sharp(image).raw().toBuffer()
}

/** Écrit le témoin sur disque (nom de fichier stable) et rend le payload `file`. */
async function televerserTemoin(name: string) {
  const donnees = await imageTemoin()
  return { data: donnees, mimetype: 'image/png', name, size: donnees.length }
}

/**
 * Supprime du stockage local de test tout fichier `media-tailles-*`. Le
 * balayage par préfixe attrape aussi les `<nom>-1.png` laissés par un run où
 * Payload a renommé : un fichier restant ferait échouer les assertions « nom
 * inchangé » pour la mauvaise raison (nouveau renommage, pas la régression).
 */
async function nettoyerFichiersTest() {
  await fs.mkdir('media', { recursive: true })
  for (const f of await fs.readdir('media')) {
    if (f.startsWith('media-tailles-')) await fs.rm(path.join('media', f))
  }
}

beforeAll(async () => {
  payload = await getPayloadClient()
  await nettoyerFichiersTest()

  // Restes d'une exécution interrompue
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'media-tailles-%' } },
    overrideAccess: true,
  })
  // Lignes orphelines : la suppression de la commune met tenant à NULL, la
  // ligne media survit (mesuré : un run rouge hérite d'un suffixe -2 parce
  // que la ligne -1 du run précédent existe encore en base — Payload rend le
  // nom sûr contre la base ET le disque, getSafeFilename.js).
  await payload.db.drizzle!.execute(
    sql`DELETE FROM media WHERE filename LIKE 'media-tailles-%'`,
  )

  commune = (
    await payload.create({
      collection: 'communes',
      data: { nom: 'Tailles', slug: 'media-tailles-a', actif: false },
      overrideAccess: true,
    })
  ).id

  mediaId = (
    await payload.create({
      collection: 'media',
      data: {
        alt: 'Témoin cadrages',
        tenant: commune,
        focalX: 90,
        focalY: 10,
      },
      file: await televerserTemoin('media-tailles-temoin.png'),
      overrideAccess: true,
    })
  ).id
})

afterAll(async () => {
  // Par slug : un média créé par un test en échec est nettoyé aussi
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'media-tailles-%' } },
    overrideAccess: true,
  })
  // Lignes media orphelines (tenant mis à NULL par le delete ci-dessus)
  await payload.db.drizzle!.execute(
    sql`DELETE FROM media WHERE filename LIKE 'media-tailles-%'`,
  )
  // Originaux et tailles, même renommés en -1 par un run rouge.
  await nettoyerFichiersTest()
})

describe('Média — tailles heros-haut et panorama cadrées au point focal', () => {
  it('produit heros-haut 1600×1100 et panorama 2000×800', async () => {
    const doc = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    // Cast : la clé tiret n'est pas encore dans les types générés avant l'étape 2
    const tailles = doc.sizes as Record<string, Taille>

    expect(tailles['heros-haut']?.width).toBe(1600)
    expect(tailles['heros-haut']?.height).toBe(1100)
    expect(tailles.panorama?.width).toBe(2000)
    expect(tailles.panorama?.height).toBe(800)
  })

  it('garde le point focal (90, 10) et le coin supérieur droit dans le panorama', async () => {
    const doc = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    const tailles = doc.sizes as Record<string, Taille>
    const panorama = await lireTaille(tailles.panorama, 'panorama')

    // 2000 de large dans 2000 réduits, 800 de haut dans 1333 : bande haute entière
    await expect(
      sharp(panorama).metadata(),
    ).resolves.toMatchObject({ height: 800, width: 2000 })
    // Marqueur rouge réduit : [1875..2000] × [0..125]
    expect(estRouge(await pixel(panorama, 1950, 60)), 'coin supérieur droit conservé').toBe(true)
    // Marqueur bleu réduit : [1733..1867] × [67..200]
    expect(estBleu(await pixel(panorama, 1800, 133)), 'point focal conservé').toBe(true)
    // Le cadrage n'est pas inversé : coin bas gauche = fond
    expect(estVert(await pixel(panorama, 10, 790)), 'coin bas gauche = fond').toBe(true)
  })

  it('garde le point focal et le coin supérieur droit dans heros-haut', async () => {
    const doc = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    const tailles = doc.sizes as Record<string, Taille>
    const herosHaut = await lireTaille(tailles['heros-haut'], 'heros-haut')

    await expect(
      sharp(herosHaut).metadata(),
    ).resolves.toMatchObject({ height: 1100, width: 1600 })
    // Fenêtre réduits [50..1650] × [0..1100] : bleu relatif [1380..1490] × [55..165]
    expect(estBleu(await pixel(herosHaut, 1435, 110)), 'point focal conservé').toBe(true)
    // Rouge relatif [1497..1600] × [0..103] — perdu par un cadrage centré
    expect(estRouge(await pixel(herosHaut, 1560, 50)), 'coin supérieur droit conservé').toBe(true)
  })
})

describe('Média — régénération (téléversé avant l’ajout des tailles)', () => {
  // Point non vérifié de la spec (tâche 6, étape 3) : les tailles sont des
  // colonnes SQL (cf. migration 20260920_154554) — un média « d'avant » est
  // simulé en les mettant à NULL, puis réenregistré avec son propre fichier
  // relu depuis le stockage.
  it('retrouve heros-haut et panorama au point focal après update avec son fichier', async () => {
    const ancien = (
      await payload.create({
        collection: 'media',
        data: {
          alt: 'Témoin régénération',
          tenant: commune,
          focalX: 90,
          focalY: 10,
        },
        file: await televerserTemoin('media-tailles-regen.png'),
        overrideAccess: true,
      })
    ).id

    // Simulation du média d'avant : les deux tailles n'existaient pas
    if (!payload.db.drizzle) throw new Error('adapter sans drizzle')
    await payload.db.drizzle.execute(sql`
      UPDATE media SET
        sizes_heros_haut_url = NULL, sizes_heros_haut_width = NULL,
        sizes_heros_haut_height = NULL, sizes_heros_haut_mime_type = NULL,
        sizes_heros_haut_filesize = NULL, sizes_heros_haut_filename = NULL,
        sizes_panorama_url = NULL, sizes_panorama_width = NULL,
        sizes_panorama_height = NULL, sizes_panorama_mime_type = NULL,
        sizes_panorama_filesize = NULL, sizes_panorama_filename = NULL
      WHERE id = ${ancien}`)

    const efface = (await payload.findByID({ collection: 'media', id: ancien, overrideAccess: true }))
      .sizes as Record<string, Taille>
    // L'état simulé est bien en place (sinon le test prouverait rien)
    expect(efface['heros-haut']?.filename ?? null, 'heros-haut effacée en base').toBeFalsy()
    expect(efface.panorama?.filename ?? null, 'panorama effacée en base').toBeFalsy()

    // Réenregistrement : le fichier est relu depuis le stockage local.
    // focalX/focalY sont repassés — sans eux, l'update recadrerait au centre
    // (payload/dist/uploads/generateFileData.js ne réapplique le point focal
    // que si data le porte).
    const doc = await payload.findByID({ collection: 'media', id: ancien, overrideAccess: true })
    const nomAvant = doc.filename!
    const urlAvant = doc.url!
    const fichier = await fs.readFile(path.join('media', doc.filename!))
    const regenere = await payload.update({
      collection: 'media',
      id: ancien,
      data: { focalX: 90, focalY: 10 },
      file: {
        data: fichier,
        mimetype: doc.mimeType ?? 'image/png',
        name: doc.filename!,
        size: fichier.length,
      },
      // Sans cela, Payload rend le nom sûr contre la base et le disque
      // (getSafeFilename.js) : le réenregistré devient <nom>-1.png — c'est
      // le rouge vu ci-dessus. Option par appel, documentée dans
      // collections/operations/local/update.d.ts (« replace the existing
      // file instead of generating a new filename »).
      overwriteExistingFiles: true,
      overrideAccess: true,
    })

    // Relecteur (point B3) : le réenregistrement doit garder le même nom de
    // fichier et la même URL — sans `overwriteExistingFiles`, Payload renomme
    // en <nom>-1.png quand le fichier existe déjà (mesuré en base).
    expect(regenere.filename).toBe(nomAvant)
    expect(regenere.url).toBe(urlAvant)

    const tailles = regenere.sizes as Record<string, Taille>
    expect(tailles['heros-haut']?.width).toBe(1600)
    expect(tailles['heros-haut']?.height).toBe(1100)
    expect(tailles.panorama?.width).toBe(2000)
    expect(tailles.panorama?.height).toBe(800)

    // Même image, même point focal : le panorama régénéré est pixel-identique
    // à celui du témoin téléversé directement avec les tailles.
    const temoin = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    const panoramaRegenere = await lireTaille(
      (regenere.sizes as Record<string, Taille>).panorama,
      'panorama',
    )
    const panoramaTemoin = await lireTaille(
      (temoin.sizes as Record<string, Taille>).panorama,
      'panorama',
    )
    expect((await pixels(panoramaRegenere)).equals(await pixels(panoramaTemoin))).toBe(true)
  })
})

describe('scripts/regenerer-tailles.ts (relecteur, point 4)', () => {
  // Le script n'est jamais exécuté ici (décision de Matthieu) : seule sa
  // fonction par document `regenererUn` est appelée, sur le média « d'avant »
  // simulé comme dans le describe précédent.
  it('régénère les tailles sans toucher nom, URL ni point focal', async () => {
    const doc0 = await payload.create({
      collection: 'media',
      data: { alt: 'Témoin script', tenant: commune, focalX: 90, focalY: 10 },
      file: await televerserTemoin('media-tailles-script.png'),
      overrideAccess: true,
    })

    // Simulation du média d'avant : les 12 colonnes SQL vidées
    if (!payload.db.drizzle) throw new Error('adapter sans drizzle')
    await payload.db.drizzle.execute(sql`
      UPDATE media SET
        sizes_heros_haut_url = NULL, sizes_heros_haut_width = NULL,
        sizes_heros_haut_height = NULL, sizes_heros_haut_mime_type = NULL,
        sizes_heros_haut_filesize = NULL, sizes_heros_haut_filename = NULL,
        sizes_panorama_url = NULL, sizes_panorama_width = NULL,
        sizes_panorama_height = NULL, sizes_panorama_mime_type = NULL,
        sizes_panorama_filesize = NULL, sizes_panorama_filename = NULL
      WHERE id = ${doc0.id}`)

    await regenererUn(payload, doc0)

    const apres = await payload.findByID({
      collection: 'media',
      id: doc0.id,
      overrideAccess: true,
    })
    const tailles = apres.sizes as Record<string, Taille>
    expect(tailles['heros-haut']?.width).toBe(1600)
    expect(tailles['heros-haut']?.height).toBe(1100)
    expect(tailles.panorama?.width).toBe(2000)
    expect(tailles.panorama?.height).toBe(800)
    expect(apres.filename).toBe(doc0.filename)
    expect(apres.url).toBe(doc0.url)
    expect(apres.focalX).toBe(doc0.focalX)
    expect(apres.focalY).toBe(doc0.focalY)
  })
})
