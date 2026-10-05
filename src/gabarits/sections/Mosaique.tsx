import { MediaImage } from '@/components/MediaImage'
import type { AccueilEnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Media } from '@/payload-types'

import type { Illustrations } from '../types'

type Tuile = AccueilEnLangue['mosaique'][number]

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
}: {
  titre: string
  langue: CodeLangue
  tuiles: Tuile[]
  photos: Array<(Media & { langueAlt: CodeLangue }) | null>
  illustrations: Illustrations
}) {
  return (
    <section data-section="mosaique" className="section-mosaique">
      <div className="entete-section">
        <h2>{titre}</h2>
      </div>
      <ul className="mosaique">
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
                    __html: illustrations.scene(tuile.illustration, 480, 600),
                  }}
                />
              )}
              <span className="mosaique__libelle" lang={tuile.langue !== langue ? tuile.langue : undefined}>
                {tuile.libelle}
              </span>
            </>
          )
          return (
            <li key={tuile.id ?? i}>
              {tuile.lien ? <a href={tuile.lien}>{corps}</a> : <div className="mosaique__tuile">{corps}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
