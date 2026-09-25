import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { RichText } from '@/components/RichText'
import { evenementsCommune, versionsEnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import { alternatesRubrique, contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  return ctx ? { title: ctx.t.agenda, alternates: await alternatesRubrique(ctx, '/agenda') } : {}
}

/**
 * Agenda : événements à venir ou en cours (D9 — un événement en cours reste
 * affiché). Règle 2 : chaque événement dans sa langue, marqué s'il est en repli.
 */
export default async function PageAgenda({ params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { t } = ctx
  const res = await evenementsCommune(ctx.site.commune.id)
  const evenements = await versionsEnLangue('evenements', res.docs, ctx.langue)
  const date = (d: string) => formaterDate(d, ctx.langue, { dateStyle: 'full', timeStyle: 'short' })

  return (
    <section className="bloc bloc-texte">
      <h1>{t.agenda}</h1>
      {evenements.length === 0 ? (
        <p>{t.aucunEvenement}</p>
      ) : (
        <ul className="liste-evenements">
          {evenements.map(({ doc: evenement, langue }) => (
            <li
              key={evenement.id}
              className="carte-evenement"
              lang={langue !== ctx.langue ? langue : undefined}
            >
              {/* Les dates sont de l'interface : toujours dans la langue affichée. */}
              <p className="carte-evenement__quand" lang={ctx.langue}>
                <time dateTime={evenement.dateDebut}>{date(evenement.dateDebut)}</time>
                {' — '}
                <time dateTime={evenement.dateFin}>{date(evenement.dateFin)}</time>
              </p>
              <h2>{evenement.titre}</h2>
              {evenement.lieu && (
                // Le lieu (contenu) domine la phrase : elle garde la langue de l'événement.
                <p className="carte-evenement__lieu">{t.lieu(evenement.lieu)}</p>
              )}
              <RichText data={evenement.description} />
              {evenement.inscription?.actif && evenement.inscription?.lien && (
                <p lang={ctx.langue}>
                  <a className="bouton bouton--primaire" href={evenement.inscription.lien}>
                    {t.sInscrire}
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
