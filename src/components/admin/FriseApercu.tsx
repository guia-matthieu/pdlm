'use client'

import { useFormFields } from '@payloadcms/ui'

import { composerFrise, type LigneFrise } from '@/gabarits/frise'
import { GABARITS, type NomGabarit } from '@/gabarits/registre'
import type { Taille } from '@/gabarits/types'

/**
 * Aperçu en direct de la frise du territoire, au-dessus des pièces : chaque
 * frappe redessine le SVG que `composerFrise()` produira sur le site public.
 * Champ `ui` : aucune donnée, aucune migration — il lit l'état du formulaire.
 */
export function FriseApercu() {
  // Tout l'état, pas seulement `apparence.frise` : la valeur du champ array
  // en FormState est le nombre de lignes (fieldReducer.js, ADD_ROW :
  // `value: rows.length`) et une frappe dans une pièce ne met à jour que le
  // sous-chemin de cette pièce (case `UPDATE`, même fichier). Les lignes se
  // lisent donc dans les sous-chemins `apparence.frise.N.*`.
  const champs = useFormFields(([fields]) => fields)

  const gabaritBrut = champs['apparence.gabarit']?.value
  const nomGabarit = typeof gabaritBrut === 'string' && gabaritBrut !== '' ? gabaritBrut : 'village'

  const lignes: { index: number; ligne: LigneFrise }[] = []
  for (const chemin of Object.keys(champs)) {
    const vu = /^apparence\.frise\.(\d+)\.piece$/.exec(chemin)
    if (!vu) continue
    const pieceBrute = champs[chemin]?.value
    if (typeof pieceBrute !== 'string' || pieceBrute.trim() === '') continue
    const tailleBrute = champs[`apparence.frise.${vu[1]}.taille`]?.value
    const ecartBrut = champs[`apparence.frise.${vu[1]}.ecart`]?.value
    lignes.push({
      index: Number(vu[1]),
      ligne: {
        piece: pieceBrute.trim(),
        taille: tailleBrute === 'petite' || tailleBrute === 'grande' ? tailleBrute : 'moyenne',
        ecart: typeof ecartBrut === 'number' && Number.isFinite(ecartBrut) ? ecartBrut : null,
      },
    })
  }
  // L'ordre des clés suit l'insertion, pas l'index : un déplacement de ligne
  // reconstruit l'état, l'ordre explicite ne dépend pas de ce détail.
  lignes.sort((a, b) => a.index - b.index)
  const saisies = lignes.map((l) => l.ligne)

  // `hasOwn` coupe les noms hérités (`constructor`, …) — même garde que
  // `gabaritDe` dans registre.ts. Un gabarit sans entrée au registre
  // (Littoral avant la tâche 8, décision 18) n'a aucune pièce connue :
  // tout est ignoré, l'avertissement le dit sans erreur (I30).
  const entree = Object.hasOwn(GABARITS, nomGabarit)
    ? GABARITS[nomGabarit as NomGabarit]
    : undefined
  const { svg, ignorees } = entree
    ? composerFrise(entree.kit, saisies)
    : { svg: null, ignorees: saisies.map((ligne) => ligne.piece) }
  const nomAffiche = entree
    ? entree.gabarit.libelle
    : nomGabarit.charAt(0).toUpperCase() + nomGabarit.slice(1)

  return (
    <div className="field-type" id="frise-apercu">
      <p className="field-label">Aperçu de la frise</p>
      <style>{'#frise-apercu svg { display: block; width: 100%; height: auto; }'}</style>
      {svg ? (
        // Sûr : ce SVG ne vient que de `composerFrise` — des chemins calculés
        // à partir du kit, jamais de la saisie (précédent : PiedDePage.tsx).
        <div
          className="frise-apercu"
          style={{ maxWidth: '42rem' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : (
        saisies.length === 0 && (
          <p className="field-description">
            Frise vide : ajoutez des pièces ci-dessous pour composer l’aperçu.
          </p>
        )
      )}
      {ignorees.length > 0 && (
        <p role="alert">{`Pièces absentes du gabarit ${nomAffiche}, ignorées : ${ignorees.join(', ')}`}</p>
      )}
    </div>
  )
}
