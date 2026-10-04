import type { EnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Alerte } from '@/payload-types'

/** Bandeau d'alertes actives (niveau → rôle aria et couleur) ; une alerte non traduite est marquée `lang`. */
export function BandeauAlerte({
  alertes,
  langue,
}: {
  alertes: EnLangue<Alerte>[]
  langue: CodeLangue
}) {
  if (alertes.length === 0) return null
  const urgence = alertes.some((a) => a.doc.niveau === 'urgence')
  return (
    <div
      role={urgence ? 'alert' : 'status'}
      aria-live="polite"
      className={`bandeau-alertes ${urgence ? 'bandeau-alertes--urgence' : ''}`}
    >
      <ul>
        {alertes.map((a) => (
          <li
            key={a.doc.id}
            className={`alerte alerte--${a.doc.niveau}`}
            lang={a.langue !== langue ? a.langue : undefined}
          >
            {a.doc.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
