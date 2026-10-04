/**
 * Valeurs préremplies de l'accueil d'une commune (spec § 1) : une commune qui
 * démarre n'affiche jamais de section vide (I30). Source unique partagée par
 * le `defaultValue` des champs `array` (création, décision 10) et par la
 * migration qui préremplit les communes existantes — les deux écrivent le
 * français (décision 14).
 */

/** Pictogrammes GemeentenIconen (CC0) servis depuis `public/pictos/<nom>.svg`. */
export const PICTOS = [
  'dechets',
  'identite',
  'etat-civil',
  'urbanisme',
  'ecole',
  'conseil',
] as const

/** Scènes d'illustration des kits de gabarit (spec § 3) ; repli au rendu : `nature`. */
export const SCENES = [
  'sentiers',
  'patrimoine',
  'commerces',
  'associations',
  'ecole',
  'mer',
  'nature',
] as const
export type Scene = (typeof SCENES)[number]

/** Libellés français des pictogrammes et scènes, pour les listes de l'admin. */
export const LIBELLES_PICTOS: Record<(typeof PICTOS)[number], string> = {
  dechets: 'Déchets',
  identite: 'Papiers d’identité',
  'etat-civil': 'État civil',
  urbanisme: 'Urbanisme',
  ecole: 'École',
  conseil: 'Conseil municipal',
}

export const LIBELLES_SCENES: Record<Scene, string> = {
  sentiers: 'Sentiers',
  patrimoine: 'Patrimoine',
  commerces: 'Commerces',
  associations: 'Associations',
  ecole: 'École',
  mer: 'Mer',
  nature: 'Nature',
}

export const DEMARCHES_DEFAUT = [
  { picto: 'dechets', titre: 'Déchets' },
  {
    picto: 'identite',
    titre: 'Papiers d’identité',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N358',
  },
  {
    picto: 'etat-civil',
    titre: 'État civil',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N359',
  },
  {
    picto: 'urbanisme',
    titre: 'Urbanisme',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N319',
  },
  { picto: 'ecole', titre: 'École et cantine' },
  { picto: 'conseil', titre: 'Conseil municipal' },
]

export const MOSAIQUE_DEFAUT = [
  { libelle: 'Balades et sentiers', illustration: 'sentiers' },
  { libelle: 'Patrimoine', illustration: 'patrimoine' },
  { libelle: 'Commerces', illustration: 'commerces' },
  { libelle: 'Associations', illustration: 'associations' },
]
