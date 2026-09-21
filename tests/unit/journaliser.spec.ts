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
      // Le type 'domaine' recherche la commune référencée avant d'écrire —
      // simulée en succès pour isoler l'échec testé à celui de `create`.
      findByID: vi.fn().mockResolvedValue({ nom: 'Peu importe' }),
      logger: { error: vi.fn() },
    },
  }) as never

/**
 * Mock « heureux » : `create` et `findByID` réussissent, avec des espions
 * pour inspecter les données réellement envoyées au journal.
 */
function reqOk(user: { id: number; email: string } | null, nomCommuneTrouvee = 'Commune X') {
  const create = vi.fn().mockResolvedValue({ id: 99 })
  const findByID = vi.fn().mockResolvedValue({ nom: nomCommuneTrouvee })
  return {
    mockReq: { user, payload: { create, findByID, logger: { error: vi.fn() } } } as never,
    create,
    findByID,
  }
}

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

/**
 * Décision (g) — le journal survit à la suppression de son auteur ou de sa
 * commune (FK en SET NULL) : l'email de l'auteur et le nom de la commune
 * sont figés dans l'entrée au moment de l'écriture, indépendamment de la
 * relation elle-même.
 */
describe('journal — instantanés auteur/commune', () => {
  it('domaine : communeNom vient d’une recherche sur la commune référencée', async () => {
    const { mockReq, create, findByID } = reqOk({ id: 7, email: 'actrice@pdlm.test' }, 'Ma Commune')
    const hook = journaliser('domaine')
    await hook({
      req: mockReq,
      doc: { id: 3, hostname: 'x.fr', commune: 9 },
      operation: 'create',
    } as never)

    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'communes', id: 9 }),
    )
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          communeNom: 'Ma Commune',
          auteurEmail: 'actrice@pdlm.test',
        }),
      }),
    )
  })

  it('commune : communeNom vient directement du document, sans recherche', async () => {
    const { mockReq, create, findByID } = reqOk({ id: 7, email: 'actrice@pdlm.test' })
    const hook = journaliser('commune')
    await hook({ req: mockReq, doc: { id: 9, nom: 'Ma Commune' }, operation: 'update' } as never)

    expect(findByID).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ communeNom: 'Ma Commune' }) }),
    )
  })

  it('suppression de commune : communeNom survit bien que la relation « commune » soit omise', async () => {
    const { mockReq, create } = reqOk({ id: 7, email: 'actrice@pdlm.test' })
    const hook = journaliserSuppression('commune')
    await hook({ req: mockReq, doc: { id: 9, nom: 'Ma Commune' }, id: 9 } as never)

    const [[appel]] = create.mock.calls
    expect(appel.data.commune).toBeUndefined()
    expect(appel.data.communeNom).toBe('Ma Commune')
  })

  it('utilisateur : aucun nom de commune, aucune recherche', async () => {
    const { mockReq, create, findByID } = reqOk({ id: 7, email: 'actrice@pdlm.test' })
    const hook = journaliser('utilisateur')
    await hook({ req: mockReq, doc: { id: 5, email: 'x@pdlm.test' }, operation: 'create' } as never)

    expect(findByID).not.toHaveBeenCalled()
    const [[appel]] = create.mock.calls
    expect(appel.data.communeNom).toBeUndefined()
  })

  it('sans utilisateur (accès système) : aucun auteurEmail écrit', async () => {
    const { mockReq, create } = reqOk(null)
    const hook = journaliser('utilisateur')
    await hook({ req: mockReq, doc: { id: 5, email: 'x@pdlm.test' }, operation: 'create' } as never)

    const [[appel]] = create.mock.calls
    expect(appel.data.auteurEmail).toBeUndefined()
  })
})
