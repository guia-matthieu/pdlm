import { describe, expect, it } from 'vitest'

import { CODES_LANGUES, LANGUES, LANGUES_REGIONALES, estCodeLangue, langueDe } from '@/lib/langues'

describe('liste des langues', () => {
  it('commence par le français, toujours présent', () => {
    expect(LANGUES[0].code).toBe('fr')
    expect(CODES_LANGUES).toContain('fr')
    expect(LANGUES_REGIONALES.map((l) => l.code)).not.toContain('fr')
  })

  it('contient le corse avec son nom natif', () => {
    expect(langueDe('co')).toMatchObject({ code: 'co', nom: 'Corse', nomNatif: 'Corsu' })
  })

  it('a des codes uniques, en BCP 47 simple', () => {
    expect(new Set(CODES_LANGUES).size).toBe(CODES_LANGUES.length)
    for (const code of CODES_LANGUES) expect(code).toMatch(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/)
  })

  it('reconnaît un code et refuse le reste', () => {
    expect(estCodeLangue('co')).toBe(true)
    expect(estCodeLangue('CO')).toBe(false)
    expect(estCodeLangue('racine')).toBe(false)
    expect(estCodeLangue(undefined)).toBe(false)
  })

  it('donne des noms de dates complets à toute langue inconnue d’Intl', () => {
    for (const l of LANGUES) {
      if (Intl.DateTimeFormat.supportedLocalesOf([l.code]).length > 0) continue
      expect(l.dates, `${l.code} : Intl ne la connaît pas, dates obligatoires`).toBeDefined()
      expect(l.dates?.mois).toHaveLength(12)
      expect(l.dates?.jours).toHaveLength(7)
    }
  })
})
