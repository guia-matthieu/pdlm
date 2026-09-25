import type { Metadata } from 'next'
import Link from 'next/link'

import { resolveCommune } from '@/lib/commune'
import { documentsCommune } from '@/lib/contenu'
import { formaterDate } from '@/lib/dates'

export const metadata: Metadata = {
  title: 'Documents',
}

const CATEGORIES: Record<string, string> = {
  deliberations: 'Délibérations',
  arretes: 'Arrêtés',
  budget: 'Budget',
  urbanisme: 'Urbanisme',
  autres: 'Autres',
}

/** Documents administratifs publics, filtrables par catégorie. */
export default async function PageDocuments({
  searchParams,
}: {
  searchParams: Promise<{ categorie?: string }>
}) {
  const commune = await resolveCommune()
  if (!commune) return null
  const { categorie } = await searchParams
  const res = await documentsCommune(commune.id, { categorie })

  return (
    <section className="bloc bloc-texte">
      <h1>Documents</h1>
      <nav aria-label="Filtrer par catégorie" className="filtres-documents">
        <Link href="/documents" className={!categorie ? 'actif' : undefined}>
          Toutes
        </Link>
        {Object.entries(CATEGORIES).map(([valeur, libelle]) => (
          <Link
            key={valeur}
            href={`/documents?categorie=${valeur}`}
            className={categorie === valeur ? 'actif' : undefined}
          >
            {libelle}
          </Link>
        ))}
      </nav>
      {res.docs.length === 0 ? (
        <p>Aucun document dans cette catégorie.</p>
      ) : (
        <ul className="liste-documents">
          {res.docs.map((doc) => (
            <li key={doc.id}>
              <a href={doc.url ?? '#'} target="_blank" rel="noopener">
                {doc.titre}
              </a>{' '}
              <span className="liste-documents__meta">
                ({CATEGORIES[doc.categorie] ?? doc.categorie})
                {doc.dateDocument
                  ? ` — ${formaterDate(doc.dateDocument, 'fr', { dateStyle: 'long' })}`
                  : ''}
                {doc.dureeConservation ? ` — conservation : ${doc.dureeConservation}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
