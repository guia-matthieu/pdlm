import { MediaImage } from '@/components/MediaImage'
import type { TexteEnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Media } from '@/payload-types'

import type { Gabarit, Illustrations } from '../types'

/**
 * Héros de l'accueil : photo de la commune ou grande scène du kit (I30),
 * H1 = nom de la commune, frise du territoire en bas — remplacée par un
 * fondu quand elle est vide (spec § 1).
 */
export function Heros({
  nom,
  langue,
  photo,
  frise,
  illustrations,
  cadrage,
}: {
  nom: TexteEnLangue
  langue: CodeLangue
  photo: (Media & { langueAlt: CodeLangue }) | null
  frise: string | null
  illustrations: Illustrations
  cadrage: Gabarit['cadrageHeros']
}) {
  return (
    <section data-section="heros" className={`section-heros section-heros--${cadrage}`}>
      {photo ? (
        <MediaImage
          media={photo}
          taille="hero"
          className="section-heros__image"
          prioritaires
          langueAffichee={langue}
        />
      ) : (
        // I30/I27 : sans photo, l'illustration du kit — SVG intégré au HTML.
        <div
          className="section-heros__scene"
          dangerouslySetInnerHTML={{ __html: illustrations.heros(1600, 660) }}
        />
      )}
      <div className="section-heros__texte">
        <h1 lang={nom.langue !== langue ? nom.langue : undefined}>{nom.texte}</h1>
      </div>
      {frise ? (
        <div className="section-heros__frise" dangerouslySetInnerHTML={{ __html: frise }} />
      ) : (
        <div className="section-heros__fondu" aria-hidden="true" />
      )}
    </section>
  )
}
