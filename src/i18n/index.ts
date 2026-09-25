import type { CodeLangue } from '@/lib/langues'

import { co } from './co'
import { fr, type Dictionnaire } from './fr'

export type { Dictionnaire }

/** Un dictionnaire par langue : une langue ajoutée sans le sien ne compile pas. */
const DICTIONNAIRES: Record<CodeLangue, Dictionnaire> = { fr, co }

export function dictionnaire(langue: CodeLangue): Dictionnaire {
  return DICTIONNAIRES[langue]
}
