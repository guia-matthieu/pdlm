import type { Page } from '@/payload-types'

import { MediaImage } from './MediaImage'
import { RichText } from './RichText'

type Blocs = NonNullable<Page['blocs']>

const identite = (chemin: string) => chemin

/**
 * Rendu des blocs d'une page — un renderer par type de bloc. `lien` : préfixe
 * de langue des liens éditoriaux internes (cheminLangue ; une URL externe
 * reste intacte).
 */
export function RenduBlocs({
  blocs,
  lien = identite,
}: {
  blocs: Blocs
  lien?: (chemin: string) => string
}) {
  return (
    <>
      {blocs.map((bloc, i) => {
        switch (bloc.blockType) {
          case 'hero':
            return (
              <section key={i} className="bloc bloc-hero">
                {bloc.image && typeof bloc.image === 'object' ? (
                  <MediaImage
                    media={bloc.image}
                    taille="hero"
                    className="bloc-hero__image"
                    prioritaires
                  />
                ) : null}
                <div className="bloc-hero__texte">
                  <h1>{bloc.titre}</h1>
                  {bloc.sousTitre && <p className="bloc-hero__sous-titre">{bloc.sousTitre}</p>}
                  {bloc.cta?.label && bloc.cta?.url && (
                    <p>
                      <a className="bouton bouton--primaire" href={lien(bloc.cta.url)}>
                        {bloc.cta.label}
                      </a>
                    </p>
                  )}
                </div>
              </section>
            )
          case 'texteRiche':
            return (
              <section key={i} className="bloc bloc-texte">
                <RichText data={bloc.contenu} lien={lien} />
              </section>
            )
          case 'image':
            return (
              <figure key={i} className={`bloc bloc-image bloc-image--${bloc.largeur ?? 'large'}`}>
                {bloc.media && typeof bloc.media === 'object' ? (
                  <MediaImage
                    media={bloc.media}
                    taille={bloc.largeur === 'pleine' ? 'hero' : 'card'}
                  />
                ) : null}
                {bloc.legende ? <figcaption>{bloc.legende}</figcaption> : null}
              </figure>
            )
          case 'galerie':
            return (
              <section key={i} className="bloc bloc-galerie">
                <ul>
                  {(bloc.images ?? []).map((image, j) => (
                    <li key={j}>
                      {image.media && typeof image.media === 'object' ? (
                        <figure>
                          <MediaImage media={image.media} taille="card" />
                          {image.legende ? <figcaption>{image.legende}</figcaption> : null}
                        </figure>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            )
          case 'accordeon':
            return (
              <section key={i} className="bloc bloc-accordeon">
                {(bloc.elements ?? []).map((element, j) => (
                  <details key={j} className="accordeon-element">
                    <summary>
                      <h2>{element.titre}</h2>
                    </summary>
                    <RichText data={element.contenu} lien={lien} />
                  </details>
                ))}
              </section>
            )
          case 'boutons':
            return (
              <section key={i} className="bloc bloc-boutons">
                {(bloc.boutons ?? []).map((bouton, j) => (
                  <a
                    key={j}
                    className={`bouton bouton--${bouton.variante ?? 'primaire'}`}
                    href={lien(bouton.url)}
                  >
                    {bouton.label}
                  </a>
                ))}
              </section>
            )
          case 'contact':
            return (
              <section key={i} className="bloc bloc-contact">
                {bloc.titre ? <h2>{bloc.titre}</h2> : null}
                {bloc.texte ? <p>{bloc.texte}</p> : null}
              </section>
            )
          default:
            return null
        }
      })}
    </>
  )
}
