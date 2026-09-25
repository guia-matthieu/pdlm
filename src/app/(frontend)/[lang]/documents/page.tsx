import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { cheminLangue } from '@/lib/adresses'
import { documentsCommune, versionsEnLangue } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'
import { alternatesRubrique, contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string }>
  searchParams: Promise<{ categorie?: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  return ctx
    ? { title: ctx.t.documents, alternates: await alternatesRubrique(ctx, '/documents') }
    : {}
}

/**
 * Documents administratifs publics, filtrables par catégorie. Règle 2 : le
 * titre de chaque document dans sa langue, marqué s'il est en repli. Le lien
 * du fichier (/api/…) n'est pas une page : jamais préfixé.
 */
export default async function PageDocuments({ params, searchParams }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { t } = ctx
  const lien = (c: string) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)
  const { categorie } = await searchParams
  const res = await documentsCommune(ctx.site.commune.id, { categorie })
  const documents = await versionsEnLangue('documents', res.docs, ctx.langue)
  const categories: Record<string, string> = t.categories

  return (
    <section className="bloc bloc-texte">
      <h1>{t.documents}</h1>
      <nav aria-label={t.filtrerCategorie} className="filtres-documents">
        <a href={lien('/documents')} className={!categorie ? 'actif' : undefined}>
          {t.toutes}
        </a>
        {Object.entries(categories).map(([valeur, libelle]) => (
          <a
            key={valeur}
            href={lien(`/documents?categorie=${valeur}`)}
            className={categorie === valeur ? 'actif' : undefined}
          >
            {libelle}
          </a>
        ))}
      </nav>
      {documents.length === 0 ? (
        <p>{t.aucunDocument}</p>
      ) : (
        <ul className="liste-documents">
          {documents.map(({ doc, langue }) => (
            <li key={doc.id}>
              <a
                href={doc.url ?? '#'}
                target="_blank"
                rel="noopener"
                lang={langue !== ctx.langue ? langue : undefined}
              >
                {doc.titre}
              </a>{' '}
              <span className="liste-documents__meta">
                ({categories[doc.categorie] ?? doc.categorie})
                {doc.dateDocument
                  ? ` — ${formaterDate(doc.dateDocument, ctx.langue, { dateStyle: 'long' })}`
                  : ''}
                {doc.dureeConservation ? ` — ${t.conservation(doc.dureeConservation)}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
