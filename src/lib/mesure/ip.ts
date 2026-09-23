import { isIP } from 'node:net'

const V4_ENCAPSULEE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

/** IPv4 encapsulée dans IPv6, en notation pointée (`::ffff:1.2.3.4`) ou hexadécimale (`::ffff:102:304`). */
function sansEncapsulation(ip: string): string {
  const pointee = ip.match(V4_ENCAPSULEE)?.[1]
  if (pointee) return pointee
  if (isIP(ip) !== 6) return ip
  const g = groupesIpv6(ip)
  if (!g || g.slice(0, 5).some((x) => x !== '0') || g[5] !== 'ffff') return ip
  const haut = parseInt(g[6], 16)
  const bas = parseInt(g[7], 16)
  return `${haut >> 8}.${haut & 255}.${bas >> 8}.${bas & 255}`
}

/** Boucle locale, réseaux privés, lien local : jamais l'adresse d'un visiteur. */
function estLocale(ip: string): boolean {
  const v = sansEncapsulation(ip)
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }
  const bas = v.toLowerCase()
  return bas === '::1' || /^f[cd]/.test(bas) || /^fe[89ab]/.test(bas)
}

/**
 * IP du visiteur : la valeur la plus à droite de X-Forwarded-For, celle
 * qu'écrit Caddy, seul mandataire. Umami, lui, lirait la plus à gauche, que
 * le client peut forger. Next n'ajoute l'en-tête que s'il est absent
 * (`??=`, base-server.js) : en développement, sans Caddy, c'est l'adresse
 * locale, écartée ici — Umami ne localise pas, rien de plus.
 */
export function ipVisiteur(xff: string | null): string | null {
  const derniere = (xff ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .at(-1)
  if (!derniere || isIP(derniere) === 0 || estLocale(derniere)) return null
  return derniere
}

/** Les huit groupes d'une IPv6, développés et sans zéros de tête. */
function groupesIpv6(ip: string): string[] | null {
  let texte = ip.toLowerCase().split('%')[0]
  const v4 = texte.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) {
    const o = v4[1].split('.').map(Number)
    texte = `${texte.slice(0, -v4[1].length)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const [gauche, droite] = texte.split('::')
  const g = gauche ? gauche.split(':') : []
  const d = droite ? droite.split(':') : []
  const groupes = texte.includes('::')
    ? [...g, ...Array<string>(8 - g.length - d.length).fill('0'), ...d]
    : g
  return groupes.length === 8 ? groupes.map((x) => x.replace(/^0+(?=.)/, '')) : null
}

/** I18 : dernier octet à zéro en IPv4 ; en IPv6, le /48 gardé, les 80 bits suivants à zéro. */
export function tronquerIp(ip: string): string | null {
  const v = sansEncapsulation(ip)
  if (isIP(v) === 4) {
    const o = v.split('.')
    return `${o[0]}.${o[1]}.${o[2]}.0`
  }
  if (isIP(v) !== 6) return null
  const g = groupesIpv6(v)
  return g ? `${g.slice(0, 3).join(':')}::` : null
}
