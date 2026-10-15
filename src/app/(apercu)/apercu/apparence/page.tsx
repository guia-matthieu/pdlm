import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

import { Accueil } from '@/gabarits/Accueil'
import { adressesGabarit } from '@/gabarits/fichiers'
import { gabaritDe, type NomGabarit } from '@/gabarits/registre'
import { dictionnaire } from '@/i18n'
import { idCommune, lireParametresApercu, peutApercevoir } from '@/lib/apercu'
import { deriver } from '@/lib/couleurs'
import { getPayloadClient } from '@/lib/payload'
import type { Commune } from '@/payload-types'

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Aperçu de l’apparence (spec gabarits-couleurs § 4) : l’accueil tel que le
 * gabarit le composerait avec ces paramètres d’adresse, servi à l’opérateur
 * et à l’admin de la commune (I28) sous le domaine de la plateforme seule
 * (décision 13). Les paramètres sont validés par `lireParametresApercu`
 * (I29) : rien de l’adresse ne passe tel quel.
 */
export default async function PageApercuApparence({ searchParams }: Props) {
  // URLSearchParams depuis l’objet de Next : `append` conserve l’ordre des
  // occurrences, `get()` rend la première — même lecture que la lib.
  const params = new URLSearchParams()
  for (const [nom, valeur] of Object.entries(await searchParams)) {
    const occurrences = Array.isArray(valeur) ? valeur : valeur === undefined ? [] : [valeur]
    for (const occurrence of occurrences) params.append(nom, occurrence)
  }

  // I28 avant tout accès aux données : sans identifiant lisible, la réponse
  // est un 404 — l’aperçu n’existe pas pour ce visiteur.
  const id = idCommune(params)
  if (id === null) notFound()
  const payload = await getPayloadClient()
  const { user } = await payload.auth({ headers: await headers() })
  if (!peutApercevoir(user, id)) notFound()

  // L’accès est déjà prouvé par peutApercevoir : lecture directe, comme le
  // front public (overrideAccess, depth par défaut).
  const commune = await payload
    .findByID({ collection: 'communes', id, overrideAccess: true })
    .catch(() => null)
  if (!commune) notFound()

  const apercu = lireParametresApercu(params, {
    gabarit: commune.apparence?.gabarit ?? null,
    choix: {
      principale: commune.apparence?.couleurPrincipale,
      accent: commune.apparence?.couleurAccent,
      terre: commune.apparence?.couleurTerre,
    },
    forcees: commune.apparence?.couleursForcees ?? null,
  })

  // I23 : dérivées recalculées au rendu, exactement comme le layout public.
  const { variables } = deriver(apercu.choix, apercu.forcees)

  // La commune servie à l’accueil : mêmes données, apparence remplacée par
  // les paramètres validés. Accueil relit gabarit et contenus depuis
  // commune.id, inchangé — seules les couleurs et le gabarit basculent.
  const communeApercu: Commune = {
    ...commune,
    apparence: {
      ...commune.apparence,
      // Sorti de la liste close de lireParametresApercu (Object.hasOwn sur le
      // registre) : c’est un NomGabarit, le type de la lib reste large.
      gabarit: apercu.gabarit as NomGabarit,
      couleurPrincipale: apercu.choix.principale,
      couleurAccent: apercu.choix.accent,
      couleurTerre: apercu.choix.terre,
      couleursForcees: apercu.forcees,
    },
  }

  const { gabarit } = gabaritDe(apercu.gabarit)
  const fichiers = adressesGabarit(gabarit)

  return (
    // Le layout racine du groupe ne voit pas les paramètres d’adresse : les
    // variables sont posées ici, et .canevas-apercu y déclare les alias que
    // styles.css pose sur body (la substitution s’y résout de la même façon).
    <div className="canevas-apercu" lang={apercu.lang} style={variables as React.CSSProperties}>
      {/* `precedence` : React hisse la feuille dans le <head>, après styles.css. */}
      <link rel="stylesheet" href={fichiers.feuille} precedence="gabarit" />
      {fichiers.polices.map((police) => (
        <link
          key={police}
          rel="preload"
          href={police}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      ))}
      {/* Identité : la navigation dans l’iframe n’a pas de sens — les liens
          de l’aperçu ne mènent nulle part, l’admin agit dans l’onglet. */}
      <Accueil
        commune={communeApercu}
        langue={apercu.lang}
        t={dictionnaire(apercu.lang)}
        lien={(chemin) => chemin}
      />
    </div>
  )
}
