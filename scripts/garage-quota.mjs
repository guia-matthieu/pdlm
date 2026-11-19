// Conversion d'un quota S3_QUOTA (« 2GiB », « 512MiB », « 100MB », « 2gib »…)
// en octets pour l'API d'administration de Garage (UpdateBucket → maxSize).
// Syntaxe conservée telle quelle depuis l'époque du premier serveur S3
// (`mc quota set --size`).
const UNITES = {
  b: 1,
  kb: 1_000,
  mb: 1_000_000,
  gb: 1_000_000_000,
  tb: 1_000_000_000_000,
  pb: 1_000_000_000_000_000,
  kib: 1_024,
  mib: 1_048_576,
  gib: 1_073_741_824,
  tib: 1_099_511_627_776,
  pib: 1_125_899_906_842_624,
}

/**
 * Convertit une taille lisible en octets (entier).
 * @param {string} quota — par exemple « 2GiB » ou « 512MiB »
 * @returns {number} taille en octets
 * @throws {Error} syntaxe non reconnue ou valeur non entière
 */
export function convertirQuota(quota) {
  const nettoyee = String(quota).trim().toLowerCase()
  const analyse = /^([0-9]+(?:\.[0-9]+)?)\s*(b|kb|mb|gb|tb|pb|kib|mib|gib|tib|pib)$/.exec(nettoyee)
  if (!analyse) {
    throw new Error(`quota illisible : « ${quota} » (attendu : nombre + unité, ex. 2GiB)`)
  }
  const octets = Number(analyse[1]) * UNITES[analyse[2]]
  if (!Number.isSafeInteger(octets) || octets <= 0) {
    throw new Error(`quota invalide : « ${quota} » (doit donner un entier d'octets > 0)`)
  }
  return octets
}
