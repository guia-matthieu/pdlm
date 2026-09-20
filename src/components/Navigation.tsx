import type { Menu, Page } from '@/payload-types'

interface EnteteNav {
  label: string
  href: string
  enfants: Array<{ label: string; href: string }>
}

/**
 * Navigation publique depuis le menu de la commune : les items « page » sont
 * résolus uniquement si la page est publiée et appartient à la commune (I4 —
 * pagesDuMenu côté serveur).
 */
export function Navigation({ menu, pages }: { menu: Menu | null; pages: Map<number, Page> }) {
  const entetes: EnteteNav[] = (menu?.items ?? [])
    .map((item) => {
      const page = typeof item.page === 'number' ? pages.get(item.page) : null
      const href = page ? `/${page.slug}` : (item.url ?? '')
      if (!href) return null
      return {
        label: item.label,
        href,
        enfants: (item.enfants ?? [])
          .map((enfant) => {
            const pageEnfant = typeof enfant.page === 'number' ? pages.get(enfant.page) : null
            const hrefEnfant = pageEnfant ? `/${pageEnfant.slug}` : (enfant.url ?? '')
            if (!hrefEnfant) return null
            return { label: enfant.label, href: hrefEnfant }
          })
          .filter((e): e is { label: string; href: string } => Boolean(e)),
      }
    })
    .filter((e): e is EnteteNav => Boolean(e))

  return (
    <nav aria-label="Menu principal" id="menu-principal">
      <ul className="nav-principale">
        <li>
          <a href="/">Accueil</a>
        </li>
        {entetes.map((entete) => (
          <li key={entete.href + entete.label}>
            {entete.enfants.length > 0 ? (
              <details className="nav-deroulant">
                <summary>{entete.label}</summary>
                <ul>
                  {entete.enfants.map((enfant) => (
                    <li key={enfant.href + enfant.label}>
                      <a href={enfant.href}>{enfant.label}</a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <a href={entete.href}>{entete.label}</a>
            )}
          </li>
        ))}
        <li>
          <a href="/actualites">Actualités</a>
        </li>
        <li>
          <a href="/agenda">Agenda</a>
        </li>
        <li>
          <a href="/documents">Documents</a>
        </li>
      </ul>
    </nav>
  )
}
