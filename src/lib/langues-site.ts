import type { Commune } from '../payload-types'

import { FRANCAIS, estCodeLangue, type CodeLangue } from './langues'

/**
 * Langues du site : le français (toujours actif) puis celles activées par la
 * commune. Fonction pure (aucun import `next/navigation` ni `server-only`)
 * pour que `contenu.ts` puisse l'importer.
 */
export function languesDuSite(commune: Commune): CodeLangue[] {
  const regionales = ((commune.langues as string[] | null) ?? [])
    .filter(estCodeLangue)
    .filter((l) => l !== FRANCAIS)
  return [FRANCAIS, ...regionales]
}
