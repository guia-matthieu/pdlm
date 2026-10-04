/**
 * Instantané du contenu en français, stable et comparable : sert à prouver
 * qu'une migration n'a rien perdu (scripts/verifier-migration-multilingue.sh).
 * Doit tourner sur l'ANCIEN schéma comme sur le nouveau : n'utilise que l'API
 * locale, et retire les champs ajoutés par le multilingue.
 *   INSTANTANE_FICHIER=instantane.json npx payload run scripts/instantane-contenu.ts
 * Écrit dans un fichier et non sur la sortie standard : Payload y écrit aussi
 * ses journaux (horodatés), qui fausseraient la comparaison.
 */
import { writeFileSync } from 'node:fs'

import config from '@payload-config'
import { getPayload } from 'payload'

const COLLECTIONS = [
  'communes',
  'domaines',
  'media',
  'pages',
  'actualites',
  'evenements',
  'documents',
  'alertes',
  'menus',
] as const
const NOUVEAUX = new Set(['traduction', 'langues', 'langue'])
/** Métadonnées que Payload ajoute aux versions dès que la localisation est active
 * (payload/dist/versions/buildCollectionFields.js) : pas du contenu, nulles pour
 * les versions antérieures. Retirées au premier niveau des versions seulement. */
const META_VERSIONS = ['snapshot', 'publishedLocale']

function nettoyer(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(nettoyer)
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur as Record<string, unknown>)
        .filter(([cle]) => !NOUVEAUX.has(cle))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cle, v]) => [cle, nettoyer(v)]),
    )
  }
  return valeur
}

const fichier = process.env.INSTANTANE_FICHIER
if (!fichier) throw new Error('INSTANTANE_FICHIER manquant : chemin du fichier à écrire.')

const payload = await getPayload({ config })
const sortie: Record<string, unknown> = {}
for (const collection of COLLECTIONS) {
  const res = await payload.find({
    collection,
    locale: 'fr',
    depth: 0,
    pagination: false,
    sort: 'id',
    overrideAccess: true,
  } as never)
  sortie[collection] = nettoyer(res.docs)
}
for (const collection of ['pages', 'actualites'] as const) {
  const res = await payload.findVersions({
    collection,
    locale: 'fr',
    depth: 0,
    pagination: false,
    sort: 'id',
    overrideAccess: true,
  } as never)
  const versions = (res.docs as Record<string, unknown>[]).map((doc) =>
    Object.fromEntries(Object.entries(doc).filter(([cle]) => !META_VERSIONS.includes(cle))),
  )
  sortie[`${collection}_versions`] = nettoyer(versions)
}
writeFileSync(fichier, JSON.stringify(sortie, null, 2) + '\n')
process.exit(0)
