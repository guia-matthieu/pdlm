#!/usr/bin/env node
// pdlm — initialisation idempotente de Garage par l'API d'administration v2.
//
// Exécuté par le service Compose `init-s3` (remplace l'ancien `createbuckets`
// du premier serveur S3). Image : node alpine épinglée par digest — shell + fetch + JSON,
// aucun paquet installé à l'exécution. Monté en lecture seule.
//
// Ce que fait le script, chaque étape tolérant l'existant (rejouable) :
//   1. layout du nœud unique (zone, capacité déclarative, tags) ;
//   2. bucket ${S3_BUCKET} ;
//   3. IMPORT de la clé de l'app (${S3_ACCESS_KEY_ID}/${S3_APP_PASSWORD}) —
//      importée, pas générée : les valeurs viennent du .env, une régénération
//      par Garage rendrait le .env mensonger ;
//   4. droits de la clé sur le bucket : lecture + écriture, PAS owner ;
//   5. quota ${S3_QUOTA} en octets (ou retrait si vide).
//
// Aucun secret ne doit apparaître dans la sortie : on n'imprime ni le jeton
// d'administration, ni le secret de la clé. L'identifiant de clé n'est pas un
// secret (même statut que l'identifiant MinIO avant lui).
//
// Environnement :
//   GARAGE_ADMIN_URL   — défaut http://garage:3903
//   GARAGE_ADMIN_TOKEN — jeton d'administration (obligatoire)
//   S3_BUCKET          — défaut pdlm
//   S3_ACCESS_KEY_ID   — identifiant de la clé de l'app (défaut pdlm-app)
//   S3_APP_PASSWORD    — secret de la clé (obligatoire)
//   S3_QUOTA           — ex. 2GiB ; vide = pas de quota
import { convertirQuota } from './garage-quota.mjs'

const adminUrl = process.env.GARAGE_ADMIN_URL ?? 'http://garage:3903'
const jeton = process.env.GARAGE_ADMIN_TOKEN
const bucket = process.env.S3_BUCKET ?? 'pdlm'
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? 'pdlm-app'
const secretAccessKey = process.env.S3_APP_PASSWORD
const quota = process.env.S3_QUOTA ?? ''

if (!jeton) {
  console.error('GARAGE_ADMIN_TOKEN requis')
  process.exit(1)
}
if (!secretAccessKey) {
  console.error('S3_APP_PASSWORD requis')
  process.exit(1)
}

/** Appel API d'administration. Ne renvoie jamais le corps en erreur : le
 *  message d'erreur ne contient ni jeton ni secret (le corps d'erreur de
 *  Garage non plus). */
async function appel(methode, chemin, corps) {
  const reponse = await fetch(adminUrl + chemin, {
    method: methode,
    headers: {
      Authorization: `Bearer ${jeton}`,
      ...(corps !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: corps !== undefined ? JSON.stringify(corps) : undefined,
  })
  const texte = await reponse.text()
  let json = null
  try {
    json = texte ? JSON.parse(texte) : null
  } catch {
    // Réponse non JSON (rare) : garder le texte brut pour le diagnostic.
    json = { brut: texte }
  }
  return { status: reponse.status, json }
}

function attend(reponse, statutAttendu, contexte) {
  if (reponse.status !== statutAttendu) {
    throw new Error(
      `${contexte} : HTTP ${reponse.status} (attendu ${statutAttendu}) ${JSON.stringify(reponse.json)}`,
    )
  }
  return reponse.json
}

// --- 1. Layout du nœud unique ------------------------------------------------
const statut = attend(await appel('GET', '/v2/GetClusterStatus'), 200, 'GetClusterStatus')
const noeud = statut.nodes.find((n) => n.isUp) ?? statut.nodes[0]
if (!noeud) {
  throw new Error('aucun nœud dans le cluster Garage')
}
const layout = attend(await appel('GET', '/v2/GetClusterLayout'), 200, 'GetClusterLayout')
if (layout.roles.some((r) => r.id === noeud.id)) {
  console.log(`layout : déjà posé (version ${layout.version})`)
} else {
  // Capacité purement déclarative sur un nœud unique (le placement n'a pas
  // d'alternative) ; elle ne borne pas le disque — c'est le quota du bucket
  // qui limite réellement l'espace (retouche Y).
  const apres = attend(
    await appel('POST', '/v2/UpdateClusterLayout', {
      roles: [{ id: noeud.id, zone: 'dc1', capacity: 10 * 1024 ** 3, tags: ['pdlm'] }],
    }),
    200,
    'UpdateClusterLayout',
  )
  attend(
    await appel('POST', '/v2/ApplyClusterLayout', { version: apres.version + 1 }),
    200,
    'ApplyClusterLayout',
  )
  console.log(`layout : nœud ${noeud.id.slice(0, 8)} posé (version ${apres.version + 1})`)
}

// --- 2. Bucket ---------------------------------------------------------------
let bucketId
const existant = await appel('GET', `/v2/GetBucketInfo?globalAlias=${encodeURIComponent(bucket)}`)
if (existant.status === 200) {
  bucketId = existant.json.id
  console.log(`bucket ${bucket} : déjà présent`)
} else if (existant.status === 404) {
  const cree = attend(
    await appel('POST', '/v2/CreateBucket', { globalAlias: bucket }),
    200,
    'CreateBucket',
  )
  bucketId = cree.id
  console.log(`bucket ${bucket} : créé`)
} else {
  throw new Error(`GetBucketInfo : HTTP ${existant.status} (attendu 200 ou 404)`)
}

// --- 3. Clé de l'app (importée, jamais régénérée) ----------------------------
const cle = await appel('GET', `/v2/GetKeyInfo?id=${encodeURIComponent(accessKeyId)}`)
if (cle.status === 200) {
  console.log(`clé ${accessKeyId} : déjà importée`)
} else if (cle.status === 404) {
  attend(
    await appel('POST', '/v2/ImportKey', {
      accessKeyId,
      secretAccessKey,
      name: 'pdlm-app',
    }),
    200,
    'ImportKey',
  )
  console.log(`clé ${accessKeyId} : importée`)
} else {
  throw new Error(`GetKeyInfo : HTTP ${cle.status} (attendu 200 ou 404)`)
}

// --- 4. Droits : lecture + écriture, sans owner ------------------------------
// Idempotent par construction : les drapeaux à true sont activés, les autres
// restent inchangés (sémantique documentée d'AllowBucketKey).
attend(
  await appel('POST', '/v2/AllowBucketKey', {
    bucketId,
    accessKeyId,
    permissions: { read: true, write: true, owner: false },
  }),
  200,
  'AllowBucketKey',
)
console.log(`droits : ${accessKeyId} lit et écrit dans ${bucket} (sans owner)`)

// --- 5. Quota ----------------------------------------------------------------
// L'API exige les DEUX champs (maxSize et maxObjects) ; null retire le quota.
const octets = quota ? convertirQuota(quota) : null
attend(
  await appel('POST', `/v2/UpdateBucket?id=${encodeURIComponent(bucketId)}`, {
    quotas: { maxSize: octets, maxObjects: null },
  }),
  200,
  'UpdateBucket',
)
console.log(quota ? `quota : ${octets} octets (${quota})` : 'quota : aucun')

console.log('initialisation Garage : terminée')
