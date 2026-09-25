import { describe, expect, it } from 'vitest'

import { RACINE } from '@/lib/adresses'
import { CODES_LANGUES } from '@/lib/langues'
import { SLUGS_RESERVES } from '@/hooks/uniqueSlugParCommune'

describe('I16 — slugs réservés', () => {
  it('réserve chaque code de langue et la sentinelle', () => {
    for (const code of CODES_LANGUES) expect(SLUGS_RESERVES).toContain(code)
    expect(SLUGS_RESERVES).toContain(RACINE)
  })
})
