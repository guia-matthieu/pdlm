import type { Dictionnaire } from '@/i18n'
import {
  accueilEnLangue,
  actualitesCommune,
  communeEnLangue,
  evenementsCommune,
  mediaDe,
  pageAccueil,
  versionEnLangue,
  versionsEnLangue,
} from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Commune, Media } from '@/payload-types'

import { composerFrise } from './frise'
import { gabaritDe } from './registre'
import { Actualites } from './sections/Actualites'
import { Agenda } from './sections/Agenda'
import { Demarches } from './sections/Demarches'
import { Heros } from './sections/Heros'
import { Mairie } from './sections/Mairie'
import { Mosaique } from './sections/Mosaique'
import { TexteLibre } from './sections/TexteLibre'
import type { NomSection } from './types'

/**
 * L'accueil composé par le gabarit de la commune : les sections communes
 * dans l'ordre de `gabarit.accueil`, chacune remplie de ses données. I30 :
 * une section sans élément n'est pas rendue — la page n'affiche jamais
 * d'emplacement vide. Les sections vides du plan (variante) arriveront avec
 * les gabarits complets (tâches 5 et 8).
 */
export async function Accueil({
  commune,
  langue,
  t,
  lien,
}: {
  commune: Commune
  langue: CodeLangue
  t: Dictionnaire
  lien: (chemin: string) => string
}) {
  const { gabarit, kit, illustrations } = gabaritDe(commune.apparence?.gabarit)
  const veut = (section: NomSection) => gabarit.accueil.some((e) => e.section === section)
  const id = commune.id

  const identite = await communeEnLangue(commune, langue)
  const accueil = await accueilEnLangue(commune, langue)
  const [photo, page, actusFr, evenementsFr] = await Promise.all([
    mediaDe(id, commune.apparence?.photoAccueil, langue),
    veut('texteLibre') ? pageAccueil(id) : null,
    veut('actualites') ? actualitesCommune(id, { limite: 4 }) : null,
    veut('agenda') ? evenementsCommune(id, { limite: 4 }) : null,
  ])
  const [texteLibre, actus, evenements, photosMosaique] = await Promise.all([
    page && (page.blocs?.length ?? 0) > 0 ? versionEnLangue('pages', id, page, langue) : null,
    actusFr ? versionsEnLangue('actualites', id, actusFr.docs, langue) : Promise.resolve([]),
    evenementsFr ? versionsEnLangue('evenements', id, evenementsFr.docs, langue) : Promise.resolve([]),
    veut('mosaique')
      ? Promise.all(accueil.mosaique.map((tuile) => mediaDe(id, tuile.photo, langue)))
      : Promise.resolve([] as Array<(Media & { langueAlt: CodeLangue }) | null>),
  ])
  // I30 : une démarche sans lien n'est pas rendue.
  const demarches = accueil.demarches.filter((d) => d.lien)
  // Frise vide = pas de frise (le héros se termine sur un fondu).
  const { svg: frise } = composerFrise(
    kit,
    (commune.apparence?.frise ?? []).map((ligne) => ({
      piece: ligne.piece,
      taille: ligne.taille ?? 'moyenne',
      ecart: ligne.ecart,
    })),
  )
  const carteMairie = commune.coordonnees || identite.horaires

  return (
    <>
      {gabarit.accueil.map(({ section }) => {
        switch (section) {
          case 'heros':
            return (
              <Heros
                key={section}
                nom={identite.nom}
                langue={langue}
                photo={photo}
                frise={frise}
                illustrations={illustrations}
                cadrage={gabarit.cadrageHeros}
              />
            )
          case 'demarches':
            return demarches.length > 0 ? (
              <Demarches key={section} titre={t.accueil.demarches} langue={langue} demarches={demarches} />
            ) : null
          case 'mairie':
            return carteMairie ? (
              <Mairie
                key={section}
                titre={t.accueil.mairie}
                coordonnees={commune.coordonnees}
                horaires={identite.horaires}
                langue={langue}
                t={t}
              />
            ) : null
          case 'texteLibre':
            return texteLibre ? (
              <TexteLibre key={section} contenu={texteLibre} langue={langue} t={t} lien={lien} />
            ) : null
          case 'actualites':
            return actus.length > 0 ? (
              <Actualites
                key={section}
                titre={t.accueil.actualites}
                toutVoir={t.accueil.toutesActualites}
                langue={langue}
                actus={actus}
                lien={lien}
              />
            ) : null
          case 'agenda':
            return evenements.length > 0 ? (
              <Agenda
                key={section}
                titre={t.accueil.agenda}
                toutVoir={t.accueil.toutAgenda}
                langue={langue}
                evenements={evenements}
                lien={lien}
                t={t}
              />
            ) : null
          case 'mosaique':
            return accueil.mosaique.length > 0 ? (
              <Mosaique
                key={section}
                titre={t.accueil.mosaique(identite.nom.texte)}
                langue={langue}
                tuiles={accueil.mosaique}
                photos={photosMosaique}
                illustrations={illustrations}
              />
            ) : null
          default:
            return null
        }
      })}
    </>
  )
}
