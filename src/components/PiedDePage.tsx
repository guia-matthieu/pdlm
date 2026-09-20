import type { Commune } from '@/payload-types'

/** Pied de page : coordonnées de la commune + liens légaux obligatoires. */
export function PiedDePage({ commune }: { commune: Commune }) {
  const c = commune.coordonnees
  const annee = new Date().getFullYear()
  return (
    <footer className="pied-page">
      <div className="pied-page__colonnes">
        <div>
          <h2>{commune.nom}</h2>
          {c?.adresse && (
            <p>
              {c.adresse}
              <br />
              {c.codePostal} {c.ville}
            </p>
          )}
          {commune.horaires && (
            <p>
              <strong>Horaires :</strong> {commune.horaires}
            </p>
          )}
        </div>
        <div>
          <h2>Contact</h2>
          {c?.telephone && (
            <p>
              Téléphone : <a href={`tel:${c.telephone.replace(/\s/g, '')}`}>{c.telephone}</a>
            </p>
          )}
          {c?.email && (
            <p>
              Courriel : <a href={`mailto:${c.email}`}>{c.email}</a>
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
          <h2>Informations</h2>
          <ul>
            <li>
              <a href="/mentions-legales">Mentions légales</a>
            </li>
            <li>
              <a href="/confidentialite">Politique de confidentialité</a>
            </li>
            <li>
              <a href="/accessibilite">Accessibilité</a>
            </li>
          </ul>
        </div>
      </div>
      <p className="pied-page__mentions">
        © {annee} {commune.nom} — Site propulsé par <a href="https://github.com/">glm</a> (logiciel
        libre).
      </p>
    </footer>
  )
}
