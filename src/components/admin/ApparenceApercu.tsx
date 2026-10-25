'use client'

import { useAuth, useDocumentInfo, useField, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import type { UtilisateurAcces } from '@/access/roles'
import { peutApercevoir } from '@/lib/apercu-acces'
import { accords, DEFAUTS, deriver, type CleForcee, type Forcees } from '@/lib/couleurs'

/** I24 : la seule écriture d’une couleur acceptée (même forme que Communes.ts). */
const FORMAT_COULEUR = /^#[0-9a-fA-F]{6}$/

/** Mêmes clés que CLES_FORCEES de lib/apercu.ts (non exporté là-bas). */
const CLES_FORCEES = [
  'texte',
  'pale',
  'profond',
  'picto1',
  'picto2',
  'picto3',
  'picto4',
  'picto5',
  'picto6',
] as const satisfies readonly CleForcee[]

/** Une couleur valide, en minuscules (I29) ; sinon rien. */
function couleur(v: unknown): string | null {
  return typeof v === 'string' && FORMAT_COULEUR.test(v) ? v.toLowerCase() : null
}

/** `4,53` — même arrondi que format2 de lib/couleurs.ts (non exporté). */
function ratio(n: number): string {
  return (Math.floor(n * 100) / 100).toFixed(2).replace('.', ',')
}

const CSS = `
#apercu-apparence .outils-apercu { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 0.75rem; }
#apercu-apparence .accords { display: flex; align-items: center; flex-wrap: wrap; gap: 0.375rem; }
#apercu-apparence .accords .field-label { margin: 0 0.25rem 0 0; }
#apercu-apparence [data-accord] { width: 1.5rem; height: 1.5rem; padding: 0; border-radius: 50%; border: 1px solid var(--theme-elevation-150); cursor: pointer; }
#apercu-apparence [data-accord]:hover, #apercu-apparence [data-accord]:focus-visible { outline: 2px solid var(--theme-elevation-350); outline-offset: 1px; }
#apercu-apparence .viseurs { display: flex; gap: 0.25rem; }
#apercu-apparence .viseurs button[aria-pressed='true'] { font-weight: bold; }
#apercu-apparence .viseur-apercu { display: flex; justify-content: center; margin-bottom: 0.75rem; border: 1px solid var(--theme-elevation-150); background: var(--theme-elevation-100); }
#apercu-apparence .viseur-apercu iframe { width: 100%; height: 36rem; border: 0; display: block; background: #fff; }
#apercu-apparence .viseur-apercu[data-largeur='390'] iframe { width: 390px; }
#apercu-apparence .contrastes ul { list-style: none; margin: 0.25rem 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr)); gap: 0.25rem 1rem; }
#apercu-apparence .contrastes li { display: flex; align-items: center; gap: 0.5rem; }
#apercu-apparence .contrastes .echantillon { flex: none; width: 2.25rem; text-align: center; border-radius: 0.25rem; font-weight: bold; }
#apercu-apparence .contrastes .insuffisant { color: var(--theme-error-500, #b3261e); }
#apercu-apparence .contrastes .forcee { font-size: 0.75rem; border: 1px solid var(--theme-elevation-150); border-radius: 0.25rem; padding: 0 0.25rem; }
`

/**
 * Aperçu en direct du site public : l’accueil tel que le gabarit le composera,
 * encadré ici, redessiné à chaque réglage sans enregistrer. Champ `ui` :
 * aucune donnée, aucune migration — il lit l’état du formulaire et construit
 * l’adresse de /apercu/apparence (paramètres validés par la page, I29).
 */
export function ApparenceApercu() {
  // Tout l’état du formulaire, comme FriseApercu : une frappe ne met à jour
  // que son sous-chemin, il faut voir tous les champs d’apparence.
  const champs = useFormFields(([fields]) => fields)
  const { setValue: poserAccent } = useField({ path: 'apparence.couleurAccent' })
  const { user } = useAuth()
  // L’identifiant du document vient du contexte, pas du form state : il n’y
  // est pas (constaté en e2e) et absent en création il n’y a rien à apercevoir.
  const { id: idDocument } = useDocumentInfo()
  const id = typeof idDocument === 'number' || typeof idDocument === 'string' ? String(idDocument) : null
  const gabaritBrut = champs['apparence.gabarit']?.value
  const gabarit = typeof gabaritBrut === 'string' && gabaritBrut !== '' ? gabaritBrut : null

  // Seules les couleurs valides partent dans l’adresse (la page revalide de
  // toute façon — I29 ; une saisie en cours hors format ne casse rien).
  const principale = couleur(champs['apparence.couleurPrincipale']?.value)
  const accent = couleur(champs['apparence.couleurAccent']?.value)
  const terre = couleur(champs['apparence.couleurTerre']?.value)
  const forcees: Forcees = {}
  for (const cle of CLES_FORCEES) {
    const valeur = couleur(champs[`apparence.couleursForcees.${cle}`]?.value)
    if (valeur !== null) forcees[cle] = valeur
  }

  // I23 : la bande de contrôle recalcule la dérivation à chaque rendu, comme
  // le site public le fera. Une saisie hors format vaut le défaut (I24).
  const { controles, avertissements } = deriver({ principale, accent, terre }, forcees)

  const urlVoulue = (() => {
    if (id === null) return null
    const params = new URLSearchParams({ commune: id })
    if (gabarit !== null) params.set('gabarit', gabarit)
    if (principale !== null) params.set('principale', principale)
    if (accent !== null) params.set('accent', accent)
    if (terre !== null) params.set('terre', terre)
    for (const [cle, valeur] of Object.entries(forcees)) {
      if (typeof valeur === 'string') params.set(cle, valeur)
    }
    return `/apercu/apparence?${params.toString()}`
  })()

  // Anti-rebond : chaque frappe recalcule l’adresse, l’iframe ne recharge
  // que 300 ms après la dernière. La valeur de `urlVoulue` est une chaîne :
  // identique d’un rendu à l’autre, l’effet ne redéclenche pas.
  const [urlApresRebond, setUrlApresRebond] = useState<string | null>(null)
  useEffect(() => {
    const minuteur = setTimeout(() => setUrlApresRebond(urlVoulue), 300)
    return () => clearTimeout(minuteur)
  }, [urlVoulue])

  const [largeur, setLargeur] = useState<1440 | 390>(1440)

  // Le user rendu par useAuth porte bien tenants (plugin multi-tenant) ; le
  // type ClientUser de Payload ne les connaît pas, d’où le cast.
  const autorise = peutApercevoir(user as UtilisateurAcces | null | undefined, id)

  return (
    <div className="field-type" id="apercu-apparence">
      <p className="field-label">Aperçu du site public</p>
      <style>{CSS}</style>

      {id === null && (
        <p className="field-description">Enregistrez la commune pour voir l’aperçu.</p>
      )}
      {id !== null && !autorise && (
        <p className="field-description">
          L’aperçu en direct est réservé à l’opérateur et à l’administrateur de la commune.
        </p>
      )}
      {id !== null && autorise && (
        <>
          <div className="outils-apercu">
            <div className="accords">
              <span className="field-label">Accents proposés</span>
              {accords(principale ?? DEFAUTS.principale).map((c) => (
                <button
                  key={c}
                  type="button"
                  data-accord={c}
                  aria-label={`Accent proposé ${c}`}
                  title={`Accent proposé ${c}`}
                  onClick={() => poserAccent(c)}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="viseurs" role="group" aria-label="Largeur de l’aperçu">
              <button
                type="button"
                aria-pressed={largeur === 1440}
                onClick={() => setLargeur(1440)}
              >
                Ordinateur 1440 px
              </button>
              <button type="button" aria-pressed={largeur === 390} onClick={() => setLargeur(390)}>
                Mobile 390 px
              </button>
            </div>
          </div>
          <div className="viseur-apercu" data-largeur={largeur}>
            {urlApresRebond !== null && (
              // Pas d'allow-scripts : l'aperçu est rendu côté serveur.
              <iframe src={urlApresRebond} title="Aperçu du site public" sandbox="allow-same-origin" />
            )}
          </div>
          <p className="field-description">
            Photo d’accueil et contenus : visibles après enregistrement.
          </p>
        </>
      )}

      <div className="contrastes">
        <p className="field-label">Contrastes dérivés</p>
        <ul>
          {controles.map((c) => (
            <li
              key={c.role}
              data-role={c.role}
              className={c.contraste < c.seuil ? 'insuffisant' : undefined}
            >
              <span className="echantillon" style={{ color: c.couleur, background: c.fond }}>
                Aa
              </span>
              <span>
                {`${c.role} : ${ratio(c.contraste)}:1 (seuil ${ratio(c.seuil)}:1)`}
                {c.force ? ' — forcée, sous votre responsabilité' : ''}
              </span>
            </li>
          ))}
        </ul>
        {avertissements.length > 0 && (
          <ul>
            {avertissements.map((a) => (
              <li key={a} role="alert">
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
