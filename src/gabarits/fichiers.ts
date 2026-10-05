/**
 * Fichiers statiques d'un gabarit (décision 19) : sa feuille `theme.css` et
 * ses polices, servies depuis l'origine de la commune sous `/gabarits/<nom>/`
 * par deux routes statiques. Les adresses reprennent l'arborescence du
 * dossier du gabarit : dans `theme.css`, `url(polices/x.woff2)` se résout
 * sans réécriture. Module serveur (lit le disque) : le registre et les kits
 * ne l'importent pas, ils restent utilisables côté client (tâche 7).
 */

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { GABARITS, type NomGabarit } from './registre'
import type { Gabarit } from './types'

const TYPES_POLICE: Record<string, string> = {
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
}

/** Adresses publiques des fichiers d'un gabarit, pour le `<head>` du layout. */
export function adressesGabarit(gabarit: Gabarit): { feuille: string; polices: string[] } {
  const base = `/gabarits/${gabarit.nom}`
  return {
    feuille: `${base}/theme.css`,
    polices: gabarit.polices.map((fichier) => `${base}/polices/${fichier}`),
  }
}

/** Type MIME d'un fichier de police, ou null si l'extension n'en est pas une. */
export function typePolice(fichier: string): string | null {
  return TYPES_POLICE[path.extname(fichier).toLowerCase()] ?? null
}

/** Le gabarit du registre de ce nom exact — jamais de repli ici : un nom inconnu n'a pas de fichier. */
function entree(nom: string) {
  return Object.hasOwn(GABARITS, nom) ? (GABARITS[nom as NomGabarit] ?? null) : null
}

const dossier = (nom: string) => path.join(process.cwd(), 'src', 'gabarits', nom)

/** Les couples servis par la route des polices : ceux que les gabarits déclarent, rien d'autre. */
export function policesServies(): { nom: string; fichier: string }[] {
  return Object.values(GABARITS).flatMap((e) =>
    e ? e.gabarit.polices.map((fichier) => ({ nom: e.gabarit.nom, fichier })) : [],
  )
}

/** `theme.css` d'un gabarit du registre ; null pour tout autre nom. */
export async function lireTheme(nom: string): Promise<string | null> {
  if (!entree(nom)) return null
  return readFile(path.join(dossier(nom), 'theme.css'), 'utf8').catch(() => null)
}

/**
 * Une police d'un gabarit. I27 : seuls les fichiers déclarés dans
 * `gabarit.polices` sont servis — la comparaison est une égalité de nom, un
 * chemin (`../x`) ne peut pas en sortir.
 */
export async function lirePolice(
  nom: string,
  fichier: string,
): Promise<{ octets: Buffer; type: string } | null> {
  const type = typePolice(fichier)
  if (!type || !entree(nom)?.gabarit.polices.includes(fichier)) return null
  const octets = await readFile(path.join(dossier(nom), 'polices', fichier)).catch(() => null)
  return octets ? { octets, type } : null
}
