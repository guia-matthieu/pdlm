import { cheminLangue } from '@/lib/adresses'
import type { TexteEnLangue } from '@/lib/contenu'
import type { ContexteLangue } from '@/lib/langue-courante'
import { siteMesure } from '@/lib/mesure/etat'
import type { Commune } from '@/payload-types'

/** Pied de page : coordonnées de la commune + liens légaux obligatoires, dans la langue affichée. */
export function PiedDePage({
  commune,
  identite,
  ctx,
}: {
  commune: Commune
  identite: { nom: TexteEnLangue; horaires: TexteEnLangue | null }
  ctx: ContexteLangue
}) {
  const { t } = ctx
  const lien = (chemin: string) => cheminLangue(chemin, ctx.langue, ctx.site.langueRacine)
  const lang = (texte: TexteEnLangue) => (texte.langue !== ctx.langue ? texte.langue : undefined)
  const c = commune.coordonnees
  const annee = new Date().getFullYear()
  return (
    <footer className="pied-page">
      <div className="pied-page__colonnes">
        <div>
          <h2 lang={lang(identite.nom)}>{identite.nom.texte}</h2>
          {c?.adresse && (
            <p>
              {c.adresse}
              <br />
              {c.codePostal} {c.ville}
            </p>
          )}
          {identite.horaires && (
            <p>
              <strong>{t.horaires}</strong>{' '}
              <span lang={lang(identite.horaires)}>{identite.horaires.texte}</span>
            </p>
          )}
        </div>
        <div>
          <h2>{t.contact}</h2>
          {c?.telephone && (
            <p>
              {t.telephone} <a href={`tel:${c.telephone.replace(/\s/g, '')}`}>{c.telephone}</a>
            </p>
          )}
          {c?.email && (
            <p>
              {t.courriel} <a href={`mailto:${c.email}`}>{c.email}</a>
            </p>
          )}
          <ul className="liens-sociaux">
            {commune.reseaux?.facebook && (
              <li>
                <a href={commune.reseaux.facebook} rel="noopener noreferrer" target="_blank">
                  Facebook
                </a>
              </li>
            )}
            {commune.reseaux?.instagram && (
              <li>
                <a href={commune.reseaux.instagram} rel="noopener noreferrer" target="_blank">
                  Instagram
                </a>
              </li>
            )}
            {commune.reseaux?.youtube && (
              <li>
                <a href={commune.reseaux.youtube} rel="noopener noreferrer" target="_blank">
                  YouTube
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <h2>{t.informations}</h2>
          <ul>
            <li>
              <a href={lien('/mentions-legales')}>{t.mentionsLegales}</a>
            </li>
            <li>
              <a href={lien('/confidentialite')}>{t.confidentialite}</a>
            </li>
            <li>
              <a href={lien('/accessibilite')}>{t.accessibilite}</a>
            </li>
            {siteMesure(commune) && (
              <li>
                <a href={lien('/mesure-d-audience')}>{t.mesureAudience}</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <p className="pied-page__mentions">
        © {annee} <span lang={lang(identite.nom)}>{identite.nom.texte}</span> — {t.propulsePar}{' '}
        <a href="https://github.com/">pdlm</a> {t.logicielLibre}
      </p>
    </footer>
  )
}
