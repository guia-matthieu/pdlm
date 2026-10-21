import type { Page } from '../payload-types'

/**
 * Un bloc `hero` rend déjà le `h1` de la page (RenduBlocs) : quand la page en
 * porte un, son titre ne doit pas en ajouter un second.
 */
export function aUnBlocHero(blocs: NonNullable<Page['blocs']>): boolean {
  return blocs.some((bloc) => bloc.blockType === 'hero')
}
