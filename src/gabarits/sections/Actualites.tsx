import type { EnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import type { CodeLangue } from '@/lib/langues'
import type { Actualite } from '@/payload-types'

/**
 * Dernières actualités. Règle 2 : chaque actualité dans la langue affichée
 * si traduite, sinon en français (marquée `lang`). Les dates sont de
 * l'interface : toujours dans la langue affichée.
 */
export function Actualites({
  titre,
  toutVoir,
  langue,
  actus,
  lien,
}: {
  titre: string
  toutVoir: string
  langue: CodeLangue
  actus: EnLangue<Actualite>[]
  lien: (chemin: string) => string
}) {
  return (
    <section data-section="actualites" className="section-actualites">
      <div className="entete-section">
        <h2>{titre}</h2>
        <a href={lien('/actualites')}>{toutVoir}</a>
      </div>
      <ul>
        {actus.map(({ doc, langue: langueDoc }) => (
          <li key={doc.id} lang={langueDoc !== langue ? langueDoc : undefined}>
            <h3>
              <a href={lien(`/actualites/${doc.slug}`)}>{doc.titre}</a>
            </h3>
            {doc.datePublication && (
              <p className="section-actualites__date" lang={langue}>
                <time dateTime={doc.datePublication}>
                  {formaterDate(doc.datePublication, langue, { dateStyle: 'long' })}
                </time>
              </p>
            )}
            {doc.resume && <p>{doc.resume}</p>}
          </li>
        ))}
      </ul>
    </section>
  )
}
