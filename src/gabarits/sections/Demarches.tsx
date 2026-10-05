import type { CSSProperties } from 'react'

import type { CodeLangue } from '@/lib/langues'
import type { Commune } from '@/payload-types'

type Demarche = NonNullable<NonNullable<Commune['accueil']>['demarches']>[number]

/**
 * Vos démarches : les demandes fréquentes. I30 : une démarche sans lien
 * n'est pas rendue (l'appelant filtre) ; le pictogramme, masqué depuis
 * public/pictos (même origine, I27), prend un ton du contrat par ligne.
 */
export function Demarches({
  titre,
  langue,
  demarches,
}: {
  titre: string
  langue: CodeLangue
  demarches: Array<Demarche & { langue: CodeLangue }>
}) {
  return (
    <section data-section="demarches" className="section-demarches">
      <h2>{titre}</h2>
      <ul className="demarches">
        {demarches.map((demarche, i) => (
          <li key={demarche.id ?? i}>
            <a href={demarche.lien ?? undefined}>
              {demarche.picto && (
                <span
                  className="demarche__pastille"
                  style={{ '--ton': `var(--picto-${(i % 6) + 1})` } as CSSProperties}
                >
                  <span
                    className="demarche__picto"
                    style={
                      { '--picto-url': `url(/pictos/${demarche.picto}.svg)` } as CSSProperties
                    }
                    aria-hidden="true"
                  />
                </span>
              )}
              <span
                className="demarche__corps"
                lang={demarche.langue !== langue ? demarche.langue : undefined}
              >
                <b>{demarche.titre}</b>
                {demarche.precision && <small>{demarche.precision}</small>}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
