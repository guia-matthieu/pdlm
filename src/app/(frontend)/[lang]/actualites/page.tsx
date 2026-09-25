import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { cheminLangue } from '@/lib/adresses'
import { actualitesCommune, versionsEnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import { alternatesRubrique, contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ page?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  return ctx
    ? { title: ctx.t.actualites, alternates: await alternatesRubrique(ctx, '/actualites') }
    : {}
}

/**
 * Liste paginée des actualités publiées de la commune. Règle 2 : chaque
 * actualité dans la langue affichée si traduite, sinon en français (marquée).
 */
export default async function ListeActualites({ params, searchParams }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { t } = ctx
  const { page: pageParam } = await searchParams
  const numeroPage = Math.max(1, Number(pageParam ?? '1') || 1)
  const res = await actualitesCommune(ctx.site.commune.id, { page: numeroPage })
  const actus = await versionsEnLangue('actualites', res.docs, ctx.langue)
  const lien = (c: string) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)
  const numero = res.page ?? 1

  return (
    <section className="bloc bloc-texte">
      <h1>{t.actualites}</h1>
      {actus.length === 0 ? (
        <p>{t.aucuneActualite}</p>
      ) : (
        <ul className="liste-actus">
          {actus.map(({ doc: actu, langue }) => (
            <li
              key={actu.id}
              className="carte-actu"
              lang={langue !== ctx.langue ? langue : undefined}
            >
              <h2>
                <a href={lien(`/actualites/${actu.slug}`)}>{actu.titre}</a>
              </h2>
              {actu.datePublication && (
                // La date est de l'interface : toujours dans la langue affichée.
                <p className="carte-actu__date" lang={ctx.langue}>
                  <time dateTime={actu.datePublication}>
                    {formaterDate(actu.datePublication, ctx.langue, { dateStyle: 'long' })}
                  </time>
                </p>
              )}
              <p>{actu.resume}</p>
            </li>
          ))}
        </ul>
      )}
      {res.totalPages > 1 && (
        <nav aria-label={t.pagination} className="pagination">
          {numero > 1 && <a href={lien(`/actualites?page=${numero - 1}`)}>{t.precedent}</a>}
          <span>{t.pageSur(String(numero), String(res.totalPages))}</span>
          {res.hasNextPage && <a href={lien(`/actualites?page=${numero + 1}`)}>{t.suivant}</a>}
        </nav>
      )}
    </section>
  )
}
