import { describe, expect, it } from 'vitest'

import { CODES_LANGUES } from '@/lib/langues'
import { dictionnaire } from '@/i18n'

/** Clés à plat, sous-objets compris (ex. « categories.budget »). */
function cles(objet: object, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, valeur]) =>
    valeur !== null && typeof valeur === 'object'
      ? cles(valeur, `${prefixe}${cle}.`)
      : [`${prefixe}${cle}`],
  )
}

describe('dictionnaires d’interface', () => {
  const fr = dictionnaire('fr')

  it.each(CODES_LANGUES)('%s fournit toutes les clés du français, et aucune autre', (code) => {
    expect(cles(dictionnaire(code)).sort()).toEqual(cles(fr).sort())
  })

  it.each(CODES_LANGUES)('%s n’a aucun texte vide', (code) => {
    const d = dictionnaire(code) as unknown as Record<string, unknown>
    for (const cle of cles(d)) {
      const valeur = cle.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)
      const texte =
        typeof valeur === 'function' ? (valeur as (...a: string[]) => string)('X', 'Y') : valeur
      expect(String(texte).trim(), `${code}.${cle}`).not.toBe('')
    }
  })
})
