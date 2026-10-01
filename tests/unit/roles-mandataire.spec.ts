import type { PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import {
  creerContenu,
  creerPublication,
  majContenu,
  majPublication,
  supprimerContenu,
} from '@/access'
import { aRoleSur, communesAvecRole } from '@/access/roles'
import { Communes } from '@/collections/Communes'
import { Domaines } from '@/collections/Domaines'
import { bloquerPublication } from '@/hooks/bloquerPublication'

/**
 * I36 — le mandataire agit (rédige, publie), la commune décide.
 * Ligne `mandataire` telle que la produit `ajouterLignesMandat` (tâche 4).
 */
const mandataire = { id: 99, tenants: [{ tenant: 7, roles: ['mandataire'] }] }
const req = (user: unknown, context: Record<string, unknown> = {}) =>
  ({ user, context }) as unknown as PayloadRequest
const args = (data?: Record<string, unknown>) =>
  ({ req: req(mandataire), data }) as unknown as Parameters<typeof creerContenu>[0]

describe('mandataire — contenus de la commune mandante', () => {
  it('crée un brouillon sur sa commune, pas sur une autre', () => {
    expect(creerContenu(args({ tenant: 7 }))).toBe(true)
    expect(creerContenu(args({ tenant: 8 }))).toBe(false)
  })

  it('modifie les contenus de sa commune', () => {
    expect(majContenu(args())).toEqual({ tenant: { in: ['7'] } })
  })

  it('crée et modifie les contenus publiés immédiatement (médias, alertes…)', () => {
    expect(creerPublication(args({ tenant: 7 }))).toBe(true)
    expect(majPublication(args())).toEqual({ tenant: { in: ['7'] } })
  })

  it('D1 : ne supprime rien', () => {
    expect(supprimerContenu(args())).toBe(false)
  })

  it('publie une page de sa commune', () => {
    const hook = () =>
      bloquerPublication({
        collection: { slug: 'pages' },
        req: req(mandataire),
        originalDoc: undefined,
        data: { tenant: 7, _status: 'published' },
      } as unknown as Parameters<typeof bloquerPublication>[0])
    expect(hook).not.toThrow()
  })
})

describe('mandataire — ce qui reste à la commune (I36)', () => {
  it('n’est jamais admin', () => {
    expect(aRoleSur(mandataire, 7, 'admin')).toBe(false)
    expect(communesAvecRole(mandataire, 'admin')).toEqual([])
  })

  it('D2 : ne modifie pas la fiche commune', () => {
    const update = Communes.access!.update as (a: unknown) => unknown
    expect(update({ req: req(mandataire) })).toBe(false)
  })

  it('ne crée ni ne modifie de domaine', () => {
    const create = Domaines.access!.create as (a: unknown) => unknown
    const update = Domaines.access!.update as (a: unknown) => unknown
    expect(create({ req: req(mandataire) })).toBe(false)
    expect(update({ req: req(mandataire) })).toBe(false)
  })
})
