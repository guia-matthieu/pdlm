import type { Metadata } from 'next'
import Link from 'next/link'

import { resolveCommune } from '@/lib/commune'
import { actualitesCommune } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'Actualités',
}

/** Liste paginée des actualités publiées de la commune. */
export default async function ListeActualites({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const commune = await resolveCommune()
  if (!commune) return null
  const { page: pageParam } = await searchParams
  const numeroPage = Math.max(1, Number(pageParam ?? '1') || 1)
  const res = await actualitesCommune(commune.id, { page: numeroPage })

  return (
    <section className="bloc bloc-texte">
      <h1>Actualités</h1>
      {res.docs.length === 0 ? (
        <p>Aucune actualité pour le moment.</p>
      ) : (
        <ul className="liste-actus">
          {res.docs.map((actu) => (
            <li key={actu.id} className="carte-actu">
              <h2>
                <Link href={`/actualites/${actu.slug}`}>{actu.titre}</Link>
              </h2>
              {actu.datePublication && (
                <p className="carte-actu__date">
                  <time dateTime={actu.datePublication}>
                    {formaterDate(actu.datePublication, 'fr', { dateStyle: 'long' })}
                  </time>
                </p>
              )}
              <p>{actu.resume}</p>
            </li>
          ))}
        </ul>
      )}
      {res.totalPages > 1 && (
        <nav aria-label="Pagination" className="pagination">
          {(res.page ?? 1) > 1 && (
            <Link href={`/actualites?page=${(res.page ?? 1) - 1}`}>Précédent</Link>
          )}
          <span>
            Page {res.page ?? 1} / {res.totalPages}
          </span>
          {res.hasNextPage && <Link href={`/actualites?page=${(res.page ?? 1) + 1}`}>Suivant</Link>}
        </nav>
      )}
    </section>
  )
}
