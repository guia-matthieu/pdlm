import { cheminLangue } from '@/lib/adresses'
import type { ElementMenu, TexteEnLangue } from '@/lib/contenu'
import type { ContexteLangue } from '@/lib/langue-courante'

/** Liens que Navigation affiche toujours, quel que soit le menu de la commune. */
const LIENS_FIXES = new Set(['/', '/actualites', '/agenda', '/documents'])

/**
 * Retire du menu de la commune les entrées simples qui pointent vers un lien
 * fixe : un éditeur qui ajoute « Documents » à son menu le verrait sinon deux
 * fois. Une entrée à sous-menu est gardée — c'est un déroulant, pas un doublon.
 */
export function sansLiensFixes(elements: ElementMenu[]): ElementMenu[] {
  return elements.filter(
    (e) => e.enfants.length > 0 || !LIENS_FIXES.has(e.href.replace(/(.)\/+$/, '$1')),
  )
}

/**
 * Navigation publique depuis le menu de la commune, dans la langue affichée.
 * Les items « page » sont résolus uniquement si la page est publiée et
 * appartient à la commune (I4 — pagesDuMenu, menuEnLangue côté serveur).
 *
 * Liens simples `<a>`, jamais next/link : un layout n'est pas re-rendu lors
 * d'une navigation client (le sélecteur de langue garderait les liens de la
 * page précédente), et un item du CMS peut être une URL externe que
 * next/link préchargerait.
 */
export function Navigation({ elements, ctx }: { elements: ElementMenu[]; ctx: ContexteLangue }) {
  const lien = (chemin: string) => cheminLangue(chemin, ctx.langue, ctx.site.langueRacine)
  const lang = (label: TexteEnLangue) => (label.langue !== ctx.langue ? label.langue : undefined)

  return (
    <nav aria-label={ctx.t.menuPrincipal} id="menu-principal">
      <ul className="nav-principale">
        <li>
          <a href={lien('/')}>{ctx.t.accueil.lien}</a>
        </li>
        {sansLiensFixes(elements).map((entete) => (
          <li key={entete.href + entete.label.texte}>
            {entete.enfants.length > 0 ? (
              <details className="nav-deroulant">
                <summary lang={lang(entete.label)}>{entete.label.texte}</summary>
                <ul>
                  {entete.enfants.map((enfant) => (
                    <li key={enfant.href + enfant.label.texte}>
                      <a href={lien(enfant.href)} lang={lang(enfant.label)}>
                        {enfant.label.texte}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : (
              <a href={lien(entete.href)} lang={lang(entete.label)}>
                {entete.label.texte}
              </a>
            )}
          </li>
        ))}
        <li>
          <a href={lien('/actualites')}>{ctx.t.actualites}</a>
        </li>
        <li>
          <a href={lien('/agenda')}>{ctx.t.agenda}</a>
        </li>
        <li>
          <a href={lien('/documents')}>{ctx.t.documents}</a>
        </li>
      </ul>
    </nav>
  )
}
