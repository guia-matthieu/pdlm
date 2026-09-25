/**
 * Liste des langues : SEULE source de vérité (spec multilingue § 1). Lue par la
 * configuration Payload, le proxy, le routage, le sélecteur de langue et les
 * tests. Ajouter une langue = une ligne ici + un dictionnaire `src/i18n/<code>.ts`
 * + une migration de base.
 *
 * Textes corses PROVISOIRES, à relire par un locuteur (spec § 10, point 1).
 */

/** Noms de dates pour une langue qu'Intl ne connaît pas (constat du 22/09 : `co`). */
export interface NomsDates {
  /** Janvier → décembre. */
  mois: readonly string[]
  /** Dimanche → samedi (ordre de `Date.getUTCDay()`). */
  jours: readonly string[]
  /** Gabarits : {j} jour du mois, {mois}, {a} année, {jour} jour de la semaine, {date}, {h}, {min}. */
  format: { long: string; complet: string; heure: string }
}

export interface Langue {
  code: string
  nom: string
  nomNatif: string
  dates?: NomsDates
}

export const LANGUES = [
  // `dates: undefined` explicite (et non omis) : sans lui, le type littéral de
  // cette entrée n'a pas de clé `dates` du tout, et `l.dates` ne type-check
  // plus dans une boucle sur l'union `LANGUES[number]` (tests/unit/langues.spec.ts).
  { code: 'fr', nom: 'Français', nomNatif: 'Français', dates: undefined },
  {
    code: 'co',
    nom: 'Corse',
    nomNatif: 'Corsu',
    dates: {
      mois: [
        'ghjennaghju',
        'ferraghju',
        'marzu',
        'aprile',
        'maghju',
        'ghjugnu',
        'lugliu',
        'aostu',
        'settembre',
        'ottobre',
        'nuvembre',
        'dicembre',
      ],
      jours: ['dumenica', 'luni', 'marti', 'mercuri', 'ghjovi', 'venneri', 'sabbatu'],
      format: {
        long: '{j} {mois} {a}',
        complet: '{jour} {j} {mois} {a}',
        heure: '{date}, à {h}:{min}',
      },
    },
  },
] as const satisfies readonly Langue[]

export type CodeLangue = (typeof LANGUES)[number]['code']

export const FRANCAIS = 'fr' satisfies CodeLangue

export const CODES_LANGUES: readonly CodeLangue[] = LANGUES.map((l) => l.code)

export const LANGUES_REGIONALES: readonly Langue[] = LANGUES.filter((l) => l.code !== FRANCAIS)

export function estCodeLangue(valeur: unknown): valeur is CodeLangue {
  return typeof valeur === 'string' && (CODES_LANGUES as readonly string[]).includes(valeur)
}

export function langueDe(code: CodeLangue): Langue {
  const langue = LANGUES.find((l) => l.code === code)
  if (!langue) throw new Error(`Langue inconnue : « ${code} »`)
  return langue
}
