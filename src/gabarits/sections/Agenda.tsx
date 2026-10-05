import type { Dictionnaire } from '@/i18n'
import type { EnLangue } from '@/lib/contenu'
import { jourEtMois } from '@/lib/dates'
import type { CodeLangue } from '@/lib/langues'
import type { Evenement } from '@/payload-types'

/**
 * Agenda du territoire sur fond profond (spec § 2) : la date en
 * --accent-sur-profond est réservée au texte large (taille minimale ≥ 24 px,
 * ou ≥ 18,66 px en gras, respectée par .section-agenda__date). Le jour et le
 * mois sont balisés à part pour qu'un gabarit compose la date en deux
 * tailles ; l'année reste dans `datetime`. Règle 2 pour les événements
 * repliés en français (marqués `lang`).
 */
export function Agenda({
  titre,
  toutVoir,
  langue,
  evenements,
  lien,
  t,
}: {
  titre: string
  toutVoir: string
  langue: CodeLangue
  evenements: EnLangue<Evenement>[]
  lien: (chemin: string) => string
  t: Dictionnaire
}) {
  return (
    <section data-section="agenda" className="section-agenda">
      <div className="entete-section">
        <h2>{titre}</h2>
        <a href={lien('/agenda')}>{toutVoir}</a>
      </div>
      <ol>
        {evenements.map(({ doc, langue: langueDoc }) => {
          const { jour, mois } = jourEtMois(doc.dateDebut, langue)
          return (
            <li key={doc.id} lang={langueDoc !== langue ? langueDoc : undefined}>
              {/* Les dates sont de l'interface : toujours dans la langue affichée. */}
              <p className="section-agenda__date" lang={langue}>
                <time dateTime={doc.dateDebut}>
                  <b className="section-agenda__jour">{jour}</b>{' '}
                  <span className="section-agenda__mois">{mois}</span>
                </time>
              </p>
              <h3>{doc.titre}</h3>
              {doc.lieu && <p className="section-agenda__lieu">{t.lieu(doc.lieu)}</p>}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
