import type { Alerte } from '@/payload-types'

/** Bandeau d'alertes actives (niveau → rôle aria et couleur). */
export function BandeauAlerte({ alertes }: { alertes: Alerte[] }) {
  if (alertes.length === 0) return null
  return (
    <div
      role={alertes.some((a) => a.niveau === 'urgence') ? 'alert' : 'status'}
      aria-live="polite"
      className={`bandeau-alertes ${
        alertes.some((a) => a.niveau === 'urgence') ? 'bandeau-alertes--urgence' : ''
      }`}
    >
      <ul>
        {alertes.map((alerte) => (
          <li key={alerte.id} className={`alerte alerte--${alerte.niveau}`}>
            {alerte.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
