/**
 * Tâche 6 (spec § 3) : régénère les tailles de tous les médias existants —
 * ceux téléversés avant l'ajout de `heros-haut` et `panorama` n'ont pas ces
 * tailles en base. Chaque média est réenregistré avec son propre fichier,
 * relu depuis le stockage, et son point focal repassé tel quel : sans
 * focalX/focalY dans `data`, un update recadrerait au centre
 * (payload/dist/uploads/generateFileData.js ne réapplique le point focal
 * que si les données le portent).
 *   npx payload run scripts/regenerer-tailles.ts
 * ⚔️ Jamais exécuté sur une base réelle : la relecture passe par le test
 * d'intégration tests/int/media-tailles.int.spec.ts, qui importe
 * regenererUn ; l'exécution réelle est une décision de Matthieu.
 * Ne touche ni au contenu ni aux métadonnées : seules les tailles et le
 * point focal (valeur déjà en base) sont réécrits.
 */
import fs from 'node:fs/promises'
import path from 'node:path'

import type { Media } from '../src/payload-types'

import { getPayloadClient } from '../src/lib/payload'

type Payload = Awaited<ReturnType<typeof getPayloadClient>>

/**
 * Fichier d'un média. En stockage local, `doc.url` est une route
 * (`/api/media/file/<nom>`, mesuré), pas un chemin disque : le fichier vit
 * dans `staticDir` (défaut = slug de la collection, cf.
 * payload/dist/collections/config/sanitize.js). URL absolue (http…) : fetch.
 */
async function lireFichier(payload: Payload, doc: Media): Promise<{
  data: Buffer
  mimetype: string
  name: string
  size: number
}> {
  if (!doc.filename) throw new Error('média sans fichier')
  // Même garde que payload/dist/uploads/generateFileData.js : un nom qui
  // remonte hors de staticDir n'est jamais un fichier du média.
  if (doc.filename.includes('../') || doc.filename.includes('..\\')) {
    throw new Error('nom de fichier interdit')
  }
  if (!doc.mimeType?.startsWith('image/')) {
    throw new Error(`mimeType non image, ignoré : ${doc.mimeType ?? 'absent'}`)
  }
  let donnees: Buffer
  if (doc.url?.startsWith('http')) {
    const reponse = await fetch(doc.url)
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status} sur ${doc.url}`)
    donnees = Buffer.from(await reponse.arrayBuffer())
  } else {
    const staticDir = payload.collections.media.config.upload?.staticDir ?? 'media'
    donnees = await fs.readFile(path.join(staticDir, doc.filename))
  }
  return { data: donnees, mimetype: doc.mimeType, name: doc.filename, size: donnees.length }
}

/** Régénère les tailles d'un média, sans rien changer d'autre. */
export async function regenererUn(payload: Payload, doc: Media): Promise<Media> {
  const fichier = await lireFichier(payload, doc)
  return payload.update({
    collection: 'media',
    id: doc.id,
    // focalX/focalY repassés (valeur en base) : sans eux, recadrage au centre.
    data: { focalX: doc.focalX ?? 50, focalY: doc.focalY ?? 50 },
    file: fichier,
    // Par appel (option de l'API locale, local/update.d.ts) : sans cela,
    // Payload renomme le réenregistré en <nom>-1.png quand le fichier
    // existe déjà — mesuré en base avant ce correctif.
    overwriteExistingFiles: true,
    overrideAccess: true,
  })
}

async function regenerer() {
  const payload = await getPayloadClient()

  let page = 1
  let totalPages = 1
  let oks = 0
  const enErreur: number[] = []

  // Pages de 50 triées par id : la pagination reste stable, l'update ne
  // change pas l'id d'un média.
  do {
    const resultat = await payload.find({
      collection: 'media',
      limit: 50,
      page,
      sort: 'id',
      overrideAccess: true,
    })
    totalPages = resultat.totalPages

    for (const doc of resultat.docs) {
      try {
        await regenererUn(payload, doc)
        oks++
        console.log(`${doc.id} → ok`)
      } catch (erreur) {
        enErreur.push(doc.id)
        console.error(
          `${doc.id} → erreur : ${erreur instanceof Error ? erreur.message : erreur}`,
        )
      }
    }
    page++
  } while (page <= totalPages)

  console.log(
    `\nRégénération terminée : ${oks} ok, ${enErreur.length} en erreur` +
      (enErreur.length > 0 ? ` (ids : ${enErreur.join(', ')})` : ''),
  )
  process.exit(enErreur.length > 0 ? 1 : 0)
}

// Top-level await : `payload run` attend la fin de l'évaluation du module —
// sans cela, le CLI sortirait avant la fin du script. Sous vitest (test
// d'intégration), seul `regenererUn` est importé : la boucle ne doit pas
// partir à l'import du module.
if (!process.env.VITEST) {
  try {
    await regenerer()
  } catch (erreur) {
    console.error(erreur)
    process.exit(1)
  }
}
