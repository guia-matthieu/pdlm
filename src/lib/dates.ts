import type { Where } from 'payload'

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

/** Formatage FR pour l'affichage public. */
export function formaterDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', ...options }).format(
    typeof date === 'string' ? new Date(date) : date,
  )
}
