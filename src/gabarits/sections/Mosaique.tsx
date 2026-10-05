import { MediaImage } from '@/components/MediaImage'
import type { AccueilEnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Media } from '@/payload-types'

import type { Illustrations, Variante } from '../types'

type Tuile = AccueilEnLangue['mosaique'][number]

/**
 * Dimensions de la scène d'une tuile selon son rang : elle est dessinée au
 * format de sa case, sinon le recadrage coupe le soleil ou le sol. Variante
 * « une-haute » : formats de la maquette Village (grande, haute, simples).
 */
function formatScene(variante: Variante | undefined, rang: number): [number, number] {
  if (variante !== 'une-haute') return [480, 600]
  if (rang === 0) return [800, 640]
  if (rang === 1) return [400, 640]
  return [400, 320]
}

/**
 * Mosaïque « Vivre à {commune} ». I30 : sans lien la tuile n'est pas
 * cliquable mais garde son illustration ; sans photo, la scène du kit
 * désignée par `illustration` (repli « nature » si le kit ne la connaît pas).
 */
export function Mosaique({
  titre,
  langue,
  tuiles,
  photos,
  illustrations,
  variante,
}: {
  titre: string
  langue: CodeLangue
  tuiles: Tuile[]
  photos: Array<(Media & { langueAlt: CodeLangue }) | null>
  illustrations: Illustrations
  variante?: Variante
}) {
  return (
    <section data-section="mosaique" className="section-mosaique">
      <div className="entete-section">
        <h2>{titre}</h2>
      </div>
      <ul className={`mosaique${variante ? ` mosaique--${variante}` : ''}`}>
        {tuiles.map((tuile, i) => {
          const photo = photos[i]
          const corps = (
            <>
              {photo ? (
                <MediaImage media={photo} taille="card" langueAffichee={langue} />
              ) : (
                <div
                  className="mosaique__scene"
                  dangerouslySetInnerHTML={{
                    __html: illustrations.scene(tuile.illustration, ...formatScene(variante, i)),
                  }}
                />
              )}
              <span
                className="mosaique__libelle"
                lang={tuile.langue !== langue ? tuile.langue : undefined}
              >
                {tuile.libelle}
              </span>
            </>
          )
          return (
            <li key={tuile.id ?? i}>
              {tuile.lien ? (
                <a href={tuile.lien}>{corps}</a>
              ) : (
                <div className="mosaique__tuile">{corps}</div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
