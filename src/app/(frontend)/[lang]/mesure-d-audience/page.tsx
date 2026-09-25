import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { cheminLangue } from '@/lib/adresses'
import { alternatesRubrique, contexteLangue } from '@/lib/langue-courante'
import { siteMesure } from '@/lib/mesure/etat'
import { COOKIE_OPPOSITION, estOppose } from '@/lib/mesure/opposition'

interface Props {
  params: Promise<{ lang: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  return ctx
    ? {
        title: ctx.t.mesureAudience,
        alternates: await alternatesRubrique(ctx, '/mesure-d-audience'),
      }
    : {}
}

/**
 * Page fixe, rendue depuis la fiche commune : l'agent n'a rien à rédiger et
 * rien ne peut la casser. Texte à valider par l'opérateur et son délégué à la
 * protection des données (ce n'est pas un avis juridique).
 *
 * Écart n° 7 : le texte (information RGPD) reste en français, présenté comme
 * un contenu non traduit (mention dans la langue affichée, conteneur
 * lang="fr") ; le formulaire renvoie ici dans la même langue (`retour`).
 */
export default async function PageMesureAudience({ params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { commune } = ctx.site
  const mesuree = siteMesure(commune) !== null
  const oppose = estOppose((await cookies()).get(COOKIE_OPPOSITION)?.value)

  return (
    <ContenuEnLangue langueContenu="fr" langue={ctx.langue} t={ctx.t}>
      <section className="bloc bloc-texte">
        <h1>Mesure d’audience</h1>
        {!mesuree ? (
          <p>Ce site ne mesure pas son audience.</p>
        ) : (
          <>
            <h2>Qui mesure, et pourquoi</h2>
            <p>
              La commune de {commune.nom}, responsable du traitement, compte les visites de ce site
              pour connaître la fréquentation de ses pages et l’améliorer. L’hébergeur du site agit
              pour son compte, comme sous-traitant.
            </p>
            <h2>Ce qui est collecté</h2>
            <ul>
              <li>la page vue et la page d’origine ;</li>
              <li>
                le navigateur, le système, le type d’appareil, la taille d’écran et la langue ;
              </li>
              <li>
                le pays, la région et la ville approximatifs, déduits d’une adresse IP tronquée
                avant tout enregistrement.
              </li>
            </ul>
            <h2>Ce qui ne l’est pas</h2>
            <p>
              Ni votre adresse IP complète, ni cookie de mesure, ni identifiant durable, ni suivi
              d’un site à l’autre, ni enregistrement de vos gestes sur la page.
            </p>
            <h2>Durée de conservation</h2>
            <p>Les données de mesure sont supprimées au bout de 25 mois.</p>
            <h2>Votre choix</h2>
            <p role="status">
              {oppose
                ? 'Vous vous êtes opposé à la mesure : vos visites ne sont pas comptées.'
                : 'Vos visites sont comptées de façon anonyme.'}
            </p>
            <form method="post" action="/mesure/opposition">
              <input type="hidden" name="choix" value={oppose ? 'accepte' : 'refus'} />
              <input
                type="hidden"
                name="retour"
                value={cheminLangue('/mesure-d-audience', ctx.langue, ctx.site.langueRacine)}
              />
              <button type="submit" className="bouton bouton--primaire">
                {oppose ? 'Accepter la mesure' : 'Refuser la mesure'}
              </button>
            </form>
            <p>
              Votre choix est gardé par un cookie qui ne sert qu’à cela, pendant 13 mois au plus. Le
              signal « Ne pas me suivre » de votre navigateur est aussi respecté.
            </p>
          </>
        )}
      </section>
    </ContenuEnLangue>
  )
}
