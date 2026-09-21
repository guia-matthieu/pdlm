import type { CollectionBeforeValidateHook } from 'payload'

import { describe, expect, it } from 'vitest'

import { Documents } from '@/collections/Documents'
import { Media } from '@/collections/Media'

const Mo = 1024 * 1024

/** I5 : exécute les hooks beforeValidate d'une collection sur un fichier de `taille` octets. */
const televerser = (hooks: CollectionBeforeValidateHook[] | undefined, taille: number) => () => {
  for (const hook of hooks ?? []) {
    hook({ req: { file: { size: taille } } } as never)
  }
}

describe('I5 — limite de taille des fichiers (20 Mo)', () => {
  it.each([
    ['media', Media.hooks?.beforeValidate],
    ['documents', Documents.hooks?.beforeValidate],
  ])('%s : 20 Mo acceptés, au-delà refusé', (_, hooks) => {
    expect(televerser(hooks, 20 * Mo)).not.toThrow()
    expect(televerser(hooks, 20 * Mo + 1)).toThrow(
      'Fichier trop volumineux : la limite est de 20 Mo.',
    )
  })
})
