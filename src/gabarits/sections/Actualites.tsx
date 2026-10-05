import { MediaImage } from '@/components/MediaImage'
import type { EnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import type { CodeLangue } from '@/lib/langues'
import type { Actualite, Media } from '@/payload-types'

import type { Illustrations, Scene, Variante } from '../types'

/**
 * Une actualité n'a pas de champ `illustration` : sans image, la scène du kit
 * vient de son rang (I30 — jamais un emplacement vide). Ordre de la maquette
 * Village.
 */
const SCENES_PAR_RANG: Scene[] = ['ecole', 'patrimoine', 'associations', 'sentiers']

/**
 * Dernières actualités, chacune avec son visuel : l'image de l'actualité,
 * sinon une scène du kit (I30). Variante « une » : la première est la une
 * (visuel 4:3), les suivantes des brèves (vignette carrée). Règle 2 : chaque
 * actualité dans la langue affichée si traduite, sinon en français (marquée
 * `lang`). Les dates sont de l'interface : toujours dans la langue affichée.
 */
export function Actualites({
  titre,
  toutVoir,
  langue,
  actus,
  images,
  illustrations,
  variante,
  lien,
}: {
  titre: string
  toutVoir: string
  langue: CodeLangue
  actus: EnLangue<Actualite>[]
  images: Array<(Media & { langueAlt: CodeLangue }) | null>
  illustrations: Illustrations
  variante?: Variante
  lien: (chemin: string) => string
}) {
  const une = variante === 'une'
  return (
    <section
      data-section="actualites"
      className={`section-actualites${une ? ' section-actualites--une' : ''}`}
    >
      <div className="entete-section">
        <h2>{titre}</h2>
        <a href={lien('/actualites')}>{toutVoir}</a>
      </div>
      <ul>
        {actus.map(({ doc, langue: langueDoc }, i) => {
          const image = images[i]
          const [largeur, hauteur] = !une ? [480, 360] : i === 0 ? [800, 600] : [400, 400]
          return (
            <li key={doc.id} className="actu" lang={langueDoc !== langue ? langueDoc : undefined}>
              <div className="actu__visuel">
                {image ? (
                  <MediaImage media={image} taille="card" langueAffichee={langue} />
                ) : (
                  // I30/I27 : sans image, la scène du kit — SVG intégré au HTML.
                  <div
                    className="actu__scene"
                    dangerouslySetInnerHTML={{
                      __html: illustrations.scene(
                        SCENES_PAR_RANG[i % SCENES_PAR_RANG.length],
                        largeur,
                        hauteur,
                      ),
                    }}
                  />
                )}
              </div>
              <div className="actu__texte">
                {doc.datePublication && (
                  <p className="section-actualites__date" lang={langue}>
                    <time dateTime={doc.datePublication}>
                      {formaterDate(doc.datePublication, langue, { dateStyle: 'long' })}
                    </time>
                  </p>
                )}
                <h3>
                  <a href={lien(`/actualites/${doc.slug}`)}>{doc.titre}</a>
                </h3>
                {doc.resume && <p>{doc.resume}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
