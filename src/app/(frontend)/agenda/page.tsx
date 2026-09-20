import type { Metadata } from 'next'

import { RichText } from '@/components/RichText'
import { resolveCommune } from '@/lib/commune'
import { evenementsCommune } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'Agenda',
}

/** Agenda : événements à venir ou en cours (D9 — un événement en cours reste affiché). */
export default async function PageAgenda() {
  const commune = await resolveCommune()
  if (!commune) return null
  const res = await evenementsCommune(commune.id)

  return (
    <section className="bloc bloc-texte">
      <h1>Agenda</h1>
      {res.docs.length === 0 ? (
        <p>Aucun événement à venir.</p>
      ) : (
        <ul className="liste-evenements">
          {res.docs.map((evenement) => (
            <li key={evenement.id} className="carte-evenement">
              <p className="carte-evenement__quand">
                <time dateTime={evenement.dateDebut}>
                  {formaterDate(evenement.dateDebut, { dateStyle: 'full', timeStyle: 'short' })}
                </time>
                {' — '}
                <time dateTime={evenement.dateFin}>
                  {formaterDate(evenement.dateFin, { dateStyle: 'full', timeStyle: 'short' })}
                </time>
              </p>
              <h2>{evenement.titre}</h2>
              {evenement.lieu && <p className="carte-evenement__lieu">Lieu : {evenement.lieu}</p>}
              <RichText data={evenement.description} />
              {evenement.inscription?.actif && evenement.inscription?.lien && (
                <p>
                  <a className="bouton bouton--primaire" href={evenement.inscription.lien}>
                    S’inscrire
                  </a>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
