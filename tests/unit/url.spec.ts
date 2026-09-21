import { describe, expect, it } from 'vitest'

import { validerUrlEditoriale } from '@/lib/url'

describe('validerUrlEditoriale', () => {
  it('accepte les chemins internes et les schémas autorisés', () => {
    for (const valeur of [
      '/actualites',
      '/actualites/fete-du-village?page=2#programme',
      'https://www.service-public.fr',
      'mailto:mairie@exemple.fr',
      'tel:+33123456789',
    ]) {
      expect(validerUrlEditoriale(valeur), valeur).toBe(true)
    }
  })

  it('refuse les schémas dangereux', () => {
    expect(validerUrlEditoriale('javascript:alert(1)')).not.toBe(true)
    expect(validerUrlEditoriale('data:text/html,<script>alert(1)</script>')).not.toBe(true)
  })

  // Un navigateur lit `\` comme `/` et supprime tabulations et retours à la
  // ligne : ces valeurs, qui commencent par « / », sortent pourtant du site.
  it('refuse un faux chemin interne qui mène vers un autre domaine', () => {
    for (const valeur of [
      '//exemple-tiers.test',
      '/\\exemple-tiers.test',
      '/\\/exemple-tiers.test',
      '/\t/exemple-tiers.test',
      '/\n/exemple-tiers.test',
    ]) {
      expect(validerUrlEditoriale(valeur), JSON.stringify(valeur)).not.toBe(true)
    }
  })
})
