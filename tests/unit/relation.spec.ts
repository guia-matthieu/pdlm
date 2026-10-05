import { describe, expect, it } from 'vitest'

import { idRelation } from '@/lib/relation'

describe('idRelation', () => {
  it('relation vide : null', () => {
    expect(idRelation(null)).toBeNull()
    expect(idRelation(undefined)).toBeNull()
    expect(idRelation('')).toBeNull()
  })

  it('relation non peuplée (depth 0) : l’identifiant tel quel', () => {
    expect(idRelation(12)).toBe(12)
    expect(idRelation('abc')).toBe('abc')
  })

  it('relation peuplée (depth ≥ 1) : l’identifiant du document', () => {
    // La commune du site est lue avec ses relations : apparence.photoAccueil
    // et accueil.mosaique[].photo arrivent en objets.
    expect(idRelation({ id: 12, url: '/api/media/file/x.jpg' })).toBe(12)
  })

  it('objet sans identifiant : null', () => {
    expect(idRelation({})).toBeNull()
    expect(idRelation({ id: null })).toBeNull()
  })
})
