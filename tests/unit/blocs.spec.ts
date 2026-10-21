import { describe, expect, it } from 'vitest'

import { aUnBlocHero } from '@/lib/blocs'

/** Rich text vide, pour satisfaire le type du bloc `texteRiche`. */
const texteVide: {
  root: { type: string; children: never[]; direction: 'ltr'; format: ''; indent: number; version: number }
} = { root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 0 } }

describe('aUnBlocHero', () => {
  it('faux sans aucun bloc', () => {
    expect(aUnBlocHero([])).toBe(false)
  })

  it('faux quand aucun bloc n’est un hero', () => {
    expect(
      aUnBlocHero([
        { blockType: 'texteRiche', contenu: texteVide },
        { blockType: 'accordeon', elements: [] },
      ]),
    ).toBe(false)
  })

  it('vrai dès qu’un bloc est un hero, même après d’autres blocs', () => {
    expect(
      aUnBlocHero([
        { blockType: 'texteRiche', contenu: texteVide },
        { blockType: 'hero', titre: 'Marché du samedi' },
      ]),
    ).toBe(true)
  })
})
