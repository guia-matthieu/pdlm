import { createHash } from 'node:crypto'

/**
 * Espace de noms pdlm des sites Umami, tiré une fois pour toutes. Ne jamais
 * le changer : l'identifiant du site de chaque commune en dépend, et c'est
 * lui qui fait retomber un nouvel essai sur le même site au lieu d'un orphelin.
 */
export const ESPACE_PDLM = '521e2d21-9c59-4092-a51d-dbb0d72f1827'

/** UUID version 5 (RFC 4122, SHA-1). */
export function uuidV5(nom: string, espace: string): string {
  const h = createHash('sha1')
    .update(Buffer.from(espace.replace(/-/g, ''), 'hex'))
    .update(nom, 'utf8')
    .digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

/** Identifiant du site Umami d'une commune, déterministe par plateforme. */
export function identifiantSite(communeId: number | string): string {
  const plateforme = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase()
  return uuidV5(`${plateforme}/communes/${communeId}`, ESPACE_PDLM)
}
