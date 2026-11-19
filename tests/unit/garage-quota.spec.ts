import { describe, expect, it } from 'vitest'

import { convertirQuota } from '../../scripts/garage-quota.mjs'

// L'API d'administration de Garage ne parle qu'en octets (UpdateBucket →
// maxSize) ; S3_QUOTA garde sa syntaxe lisible d'origine
// (« 2GiB », retouche Y). La conversion vit dans scripts/garage-quota.mjs,
// exécutée par l'init — c'est ici qu'elle est prouvée.
describe('conversion des quotas S3 (convertirQuota)', () => {
  it.each([
    ['2GiB', 2 * 1024 ** 3],
    ['512MiB', 512 * 1024 ** 2],
    ['100MB', 100_000_000],
    ['1B', 1],
    ['1.5GiB', 1_610_612_736],
    // Casses et espaces tolérés
    ['2gib', 2 * 1024 ** 3],
    [' 2GiB ', 2 * 1024 ** 3],
    ['2 GiB', 2 * 1024 ** 3],
  ])('%s → %d octets', (quota, attendu) => {
    expect(convertirQuota(quota)).toBe(attendu)
  })

  it.each([
    [''],
    ['2'],
    ['GiB'],
    ['2 XB'],
    ['-2GiB'],
    ['0GiB'],
  ])('refuse « %s »', (quota) => {
    expect(() => convertirQuota(quota)).toThrow(/quota (illisible|invalide) :/)
  })
})
