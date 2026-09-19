import type { FieldHook } from 'payload'

/** Convertit un texte en slug ASCII simple. */
export function slugifier(valeur: string): string {
  return valeur
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/** Génère le slug depuis le champ source si non renseigné (hook beforeValidate de champ). */
export const formatSlug =
  (source: string): FieldHook =>
  ({ value, data }) => {
    if (typeof value === 'string' && value !== '') {
      return slugifier(value)
    }
    const brut = data && source in data ? (data[source] as unknown) : undefined
    return typeof brut === 'string' ? slugifier(brut) : value
  }
