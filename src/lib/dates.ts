import type { Where } from 'payload'

import { langueDe, type CodeLangue } from './langues'

/**
 * Dates : stockage UTC (convention Payload), affichage Europe/Paris (D9).
 * `maintenant()` centralise le « now » pour des tests déterministes.
 */
export function maintenant(): Date {
  return new Date()
}

/** Filtre Where pour les alertes actives : dateDebut <= now <= dateFin. */
export function filtreAlerteActive(now = maintenant()): Where {
  const iso = now.toISOString()
  return {
    and: [{ dateDebut: { less_than_equal: iso } }, { dateFin: { greater_than_equal: iso } }],
  }
}

/** Filtre Where pour les événements visibles : pas encore terminés (en cours inclus). */
export function filtreEvenementAVenir(now = maintenant()): Where {
  return { dateFin: { greater_than_equal: now.toISOString() } }
}

/** Filtre Where pour les actualités publiées et non programmées dans le futur. */
export function filtrePublication(now = maintenant()): Where {
  const iso = now.toISOString()
  return {
    and: [
      { _status: { equals: 'published' } },
      {
        or: [{ datePublication: { exists: false } }, { datePublication: { less_than_equal: iso } }],
      },
    ],
  }
}

/**
 * Formatage public dans la langue affichée, fuseau Europe/Paris (D9).
 * Si Intl ne connaît pas la langue, il retombe EN SILENCE sur la locale du
 * système (français sur le poste de dev, anglais dans l'image alpine — constat
 * du 22/09) : on prend alors les noms de `langues.ts`.
 */
export function formaterDate(
  date: string | Date,
  langue: CodeLangue,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Intl.DateTimeFormat.supportedLocalesOf([langue]).length > 0) {
    return new Intl.DateTimeFormat(langue, { timeZone: 'Europe/Paris', ...options }).format(d)
  }
  const noms = langueDe(langue).dates
  if (!noms) {
    throw new Error(`Langue « ${langue} » : inconnue d’Intl et sans noms de dates dans langues.ts.`)
  }
  // Repli sans Intl : gabarits limités à dateStyle 'long'/'full' et timeStyle
  // absent/'short' (avec dateStyle). Toute autre option serait silencieusement
  // mal rendue (ex. dateStyle 'short' rendu comme 'long') : on refuse au lieu
  // de mentir sur le format.
  const { dateStyle, timeStyle, ...autres } = options
  const optionInconnue = Object.keys(autres)[0]
  if (optionInconnue) {
    throw new Error(
      `Langue « ${langue} » : option Intl « ${optionInconnue} » non prise en charge par le repli sans Intl.`,
    )
  }
  if (timeStyle !== undefined && dateStyle === undefined) {
    throw new Error(
      `Langue « ${langue} » : timeStyle sans dateStyle non pris en charge par le repli sans Intl.`,
    )
  }
  if (dateStyle !== 'long' && dateStyle !== 'full') {
    throw new Error(
      `Langue « ${langue} » : dateStyle « ${String(dateStyle)} » non pris en charge par le repli sans Intl (seuls « long » et « full » le sont).`,
    )
  }
  if (timeStyle !== undefined && timeStyle !== 'short') {
    throw new Error(
      `Langue « ${langue} » : timeStyle « ${String(timeStyle)} » non pris en charge par le repli sans Intl (seul « short » l'est).`,
    )
  }
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((part) => [part.type, part.value]),
  )
  const annee = Number(p.year)
  const mois = Number(p.month)
  const jour = Number(p.day)
  const jourSemaine = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay()
  const remplir = (gabarit: string, valeurs: Record<string, string>) =>
    gabarit.replace(/\{(\w+)\}/g, (_, cle: string) => valeurs[cle] ?? '')
  const valeurs = {
    j: String(jour),
    mois: noms.mois[mois - 1],
    a: String(annee),
    jour: noms.jours[jourSemaine],
    h: p.hour,
    min: p.minute,
  }
  const texteDate = remplir(dateStyle === 'full' ? noms.format.complet : noms.format.long, valeurs)
  return timeStyle ? remplir(noms.format.heure, { ...valeurs, date: texteDate }) : texteDate
}
