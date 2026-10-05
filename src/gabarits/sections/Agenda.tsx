import type { Dictionnaire } from '@/i18n'
import type { EnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import type { CodeLangue } from '@/lib/langues'
import type { Evenement } from '@/payload-types'

/**
 * Agenda du territoire sur fond profond (spec § 2) : la date en
 * --accent-sur-profond est réservée au texte large (taille minimale ≥ 24 px
 * en gras, respectée par .section-agenda__date). Règle 2 pour les
 * événements repliés en français (marqués `lang`).
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
        {evenements.map(({ doc, langue: langueDoc }) => (
          <li key={doc.id} lang={langueDoc !== langue ? langueDoc : undefined}>
            {/* Les dates sont de l'interface : toujours dans la langue affichée. */}
            <p className="section-agenda__date" lang={langue}>
              <time dateTime={doc.dateDebut}>
                {formaterDate(doc.dateDebut, langue, { dateStyle: 'long' })}
              </time>
            </p>
            <h3>{doc.titre}</h3>
            {doc.lieu && <p className="section-agenda__lieu">{t.lieu(doc.lieu)}</p>}
          </li>
        ))}
      </ol>
    </section>
  )
}
