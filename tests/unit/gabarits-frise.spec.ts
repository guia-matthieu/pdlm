import { describe, expect, it } from 'vitest'

import { composerFrise } from '@/gabarits/frise'
import type { Kit } from '@/gabarits/types'

const kit: Kit = {
  horizon: () => '<path d="M0 100H1440"/>',
  pieces: {
    maison: (x, sol, taille) => ({
      formes: [`M${x} ${sol}h${taille === 'grande' ? 60 : 40}v-30h-40z`],
      traits: [],
    }),
  },
}

describe('composerFrise', () => {
  it('frise vide : aucun SVG', () => {
    expect(composerFrise(kit, [])).toEqual({ svg: null, ignorees: [] })
  })

  it('pièce hors kit : ignorée et listée, sans erreur', () => {
    const r = composerFrise(kit, [{ piece: 'phare', taille: 'moyenne' }, { piece: 'maison', taille: 'grande' }])
    expect(r.ignorees).toEqual(['phare'])
    expect(r.svg).toContain('aria-hidden="true"')
  })

  it('noms hérités d’Object.prototype : ignorés et listés, sans exception (I30)', () => {
    // `piece` est un champ texte libre : ces noms existent sur tout objet via
    // la chaîne de prototypes et ne sont pas des pièces du kit.
    const noms = ['constructor', 'toString', 'hasOwnProperty', '__proto__']
    const r = composerFrise(kit, noms.map((piece) => ({ piece, taille: 'moyenne' })))
    expect(r.ignorees).toEqual(noms)
    expect(r.svg).toBeNull()
  })

  it('seulement des pièces hors kit : aucun SVG', () => {
    expect(composerFrise(kit, [{ piece: 'phare', taille: 'moyenne' }]).svg).toBeNull()
  })

  it('le SVG est bien formé', () => {
    const { svg } = composerFrise(kit, [{ piece: 'maison', taille: 'petite', ecart: 12 }])
    const doc = new DOMParser().parseFromString(svg!, 'image/svg+xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  })
})
