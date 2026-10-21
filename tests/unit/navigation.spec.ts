import { describe, expect, it } from 'vitest'

import { sansLiensFixes } from '@/components/Navigation'
import type { ElementMenu } from '@/lib/contenu'

const item = (href: string, enfants: ElementMenu['enfants'] = []): ElementMenu => ({
  label: { texte: href, langue: 'fr' } as ElementMenu['label'],
  href,
  enfants,
})

describe('sansLiensFixes', () => {
  it('retire les entrées simples qui redoublent un lien fixe, avec ou sans barre finale', () => {
    const menu = [item('/vie-municipale'), item('/documents'), item('/agenda/'), item('/')]
    expect(sansLiensFixes(menu).map((e) => e.href)).toEqual(['/vie-municipale'])
  })

  it('garde une entrée à sous-menu même si elle pointe vers un lien fixe', () => {
    const deroulant = item('/documents', [{ label: { texte: 'PLU', langue: 'fr' } as ElementMenu['label'], href: '/plu' }])
    expect(sansLiensFixes([deroulant])).toEqual([deroulant])
  })

  it('garde les chemins voisins et les URL externes', () => {
    const menu = [item('/documents/plu'), item('/actualites?page=2'), item('https://www.service-public.fr')]
    expect(sansLiensFixes(menu)).toEqual(menu)
  })
})
