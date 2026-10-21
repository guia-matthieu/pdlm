'use client'

import { useConfig, useFormFields } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { departementDuCodeInsee, evaluerDomaine, formesRecommandees } from '@/lib/nomenclature'

type CommuneLégère = { nom?: string | null; codeInsee?: string | null }

// Critères I35, tels qu'affichés sous le hostname.
const CRITERES = {
  extension: 'extension hors liste souveraine du RPNT (.fr, .bzh, .corsica…)',
  idn: 'nom internationalisé (IDN), lisible ou en punycode xn--',
  forme: 'hostname illisible',
} as const

/**
 * Panneau indicatif sous `hostname` (Domaines) : formes recommandées par le
 * RPNT § 2 pour la commune choisie, et signalement I35 du hostname saisi —
 * jamais bloquant, le champ `ui` ne stocke rien.
 */
export function NomenclatureDomaines() {
  const champs = useFormFields(([fields]) => fields)
  const { config } = useConfig()
  // Communes déjà lues, indexées par id : pas de setState synchrone dans
  // l'effet, et un retour arrière sur le champ `commune` est immédiat.
  const [communes, setCommunes] = useState<Record<number, CommuneLégère>>({})

  const hostnameBrut = champs['hostname']?.value
  const hostname = typeof hostnameBrut === 'string' ? hostnameBrut.trim() : ''
  const bruteCommune = champs['commune']?.value
  const idCommune =
    typeof bruteCommune === 'number'
      ? bruteCommune
      : typeof bruteCommune === 'string' && /^\d+$/.test(bruteCommune)
        ? Number(bruteCommune)
        : null
  const commune = idCommune !== null ? communes[idCommune] : undefined

  // `nom` et `codeInsee` de la commune visée, par l'API REST du formulaire :
  // depth=0, la locale par défaut suffit (aucun champ traduit ici).
  useEffect(() => {
    if (idCommune === null || communes[idCommune]) return
    let annulé = false
    fetch(`${config.serverURL ?? ''}${config.routes.api}/communes/${idCommune}?depth=0`, {
      credentials: 'include',
      // Données vives du panneau : jamais servies par le cache navigateur.
      cache: 'no-store',
    })
      .then((r) => (r.ok ? (r.json() as Promise<CommuneLégère>) : null))
      .then((corps) => {
        if (!annulé && corps) {
          setCommunes((avant) => ({ ...avant, [idCommune]: corps }))
        }
      })
      .catch(() => {
        /* silencieux : panneau indicatif, pas une donnée du formulaire */
      })
    return () => {
      annulé = true
    }
  }, [idCommune, communes, config])

  const departement = departementDuCodeInsee(commune?.codeInsee ?? null)
  const rangs = commune?.nom ? formesRecommandees(commune.nom, departement, false) : []
  const homonymes = commune?.nom ? formesRecommandees(commune.nom, departement, true) : []
  const formeHomonyme = homonymes.length === 4 ? homonymes[3] : null

  const alerte = hostname !== '' ? evaluerDomaine(hostname) : null

  return (
    <div className="field-type">
      <p className="field-label">Nomenclature des domaines (RPNT § 2)</p>
      {idCommune === null ? (
        <p className="field-description">Choisissez d’abord la commune pour voir ses formes recommandées.</p>
      ) : !commune ? (
        <p className="field-description">Chargement des formes…</p>
      ) : rangs.length === 0 ? (
        <p className="field-description">
          Nom sans transcription ASCII : aucune forme recommandée, jamais d’IDN.
        </p>
      ) : (
        <ol style={{ margin: 0, paddingLeft: '1.25rem' }}>
          {rangs.map((rang, i) => (
            <li key={i}>{rang.join(' ou ')}</li>
          ))}
        </ol>
      )}
      {commune && formeHomonyme && (
        <p className="field-description">
          En cas d’homonymie nationale : {formeHomonyme.join(' ou ')} (dernier rang).
        </p>
      )}
      {commune && !departement && (
        <p className="field-description">
          Sans code INSEE sur la fiche de la commune : pas de geoTLD ni de forme homonyme proposés.
        </p>
      )}
      {alerte && !alerte.conforme && (
        <p role="alert">
          {`I35 — « ${hostname} » : ${CRITERES[alerte.critere]}. Signalement seul : l’enregistrement n’est pas bloqué.`}
        </p>
      )}
      {alerte?.conforme && (
        <p className="field-description">{`« ${hostname} » est conforme au § 1.2 (extension souveraine).`}</p>
      )}
      <p className="field-description">
        Référentiel complet :{' '}
        <a
          href="https://suiteterritoriale.anct.gouv.fr/conformite/referentiel"
          target="_blank"
          rel="noreferrer"
        >
          Suite territoriale ANCT — conformité
        </a>
        .
      </p>
    </div>
  )
}
