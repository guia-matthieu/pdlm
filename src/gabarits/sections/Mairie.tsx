import type { Dictionnaire } from '@/i18n'
import type { TexteEnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import { lienTelephone } from '@/lib/telephone'
import type { Commune } from '@/payload-types'

/**
 * Carte mairie : téléphone, horaires, adresse, courriel — dans la langue
 * affichée (règle 3 pour les horaires, texte commun). I30 : l'appelant ne
 * rend la section que si au moins une donnée existe.
 */
export function Mairie({
  titre,
  coordonnees,
  horaires,
  langue,
  t,
}: {
  titre: string
  coordonnees: Commune['coordonnees']
  horaires: TexteEnLangue | null
  langue: CodeLangue
  t: Dictionnaire
}) {
  const arobase = coordonnees?.email.lastIndexOf('@') ?? -1
  return (
    <section data-section="mairie" className="section-mairie">
      <h2>{titre}</h2>
      {coordonnees?.telephone && (
        <a className="mairie__tel" href={lienTelephone(coordonnees.telephone)}>
          {coordonnees.telephone}
        </a>
      )}
      {horaires && (
        <p>
          <strong>{t.horaires}</strong>{' '}
          <span lang={horaires.langue !== langue ? horaires.langue : undefined}>
            {horaires.texte}
          </span>
        </p>
      )}
      {coordonnees?.adresse && (
        <p>
          {coordonnees.adresse}
          <br />
          {coordonnees.codePostal} {coordonnees.ville}
        </p>
      )}
      {coordonnees?.email && (
        <p>
          {/* Le courriel ne se replie qu'après l'arobase : chaque partie est
              insécable (règle des thèmes), le wbr est la seule coupure. */}
          <a className="mairie__courriel" href={`mailto:${coordonnees.email}`}>
            <span>{coordonnees.email.slice(0, arobase + 1)}</span>
            <wbr />
            <span>{coordonnees.email.slice(arobase + 1)}</span>
          </a>
        </p>
      )}
    </section>
  )
}
