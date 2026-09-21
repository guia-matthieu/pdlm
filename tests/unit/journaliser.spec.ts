import { describe, expect, it, vi } from 'vitest'

import { journaliser, journaliserSuppression } from '@/hooks/journaliser'

/**
 * I12 — un échec d'écriture du journal n'est jamais avalé. Dans une
 * transaction Postgres, l'insert refusé avorte déjà toute l'opération :
 * avaler l'erreur ne la sauve pas, cela transforme un échec en faux succès.
 * `payload.create` est simulé : c'est le seul moyen propre de forcer la panne.
 */
const reqEnPanne = () =>
  ({
    user: { id: 1 },
    payload: {
      create: vi.fn().mockRejectedValue(new Error('écriture du journal refusée')),
      logger: { error: vi.fn() },
    },
  }) as never

describe('journal — échec d’écriture', () => {
  it('création ou modification : l’erreur remonte', async () => {
    const hook = journaliser('domaine')
    await expect(
      hook({
        req: reqEnPanne(),
        doc: { id: 3, hostname: 'x.fr', commune: 1 },
        operation: 'update',
      } as never),
    ).rejects.toThrow('écriture du journal refusée')
  })

  it('suppression : l’erreur remonte', async () => {
    const hook = journaliserSuppression('domaine')
    await expect(
      hook({ req: reqEnPanne(), doc: { id: 3, hostname: 'x.fr', commune: 1 }, id: 3 } as never),
    ).rejects.toThrow('écriture du journal refusée')
  })
})
