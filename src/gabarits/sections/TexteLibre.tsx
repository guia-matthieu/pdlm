import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { RenduBlocs } from '@/components/RenduBlocs'
import type { Dictionnaire } from '@/i18n'
import type { EnLangue } from '@/lib/contenu'
import type { CodeLangue } from '@/lib/langues'
import type { Page } from '@/payload-types'

/**
 * Texte libre : les blocs de la page publiée de slug « accueil », rendus par
 * RenduBlocs — c'est la part du rédacteur dans l'accueil composé. I30 :
 * page absente ou sans bloc → l'appelant ne rend pas la section.
 */
export function TexteLibre({
  contenu,
  langue,
  t,
  lien,
}: {
  contenu: EnLangue<Page>
  langue: CodeLangue
  t: Dictionnaire
  lien: (chemin: string) => string
}) {
  return (
    <section data-section="texteLibre" className="section-texte-libre">
      <ContenuEnLangue langueContenu={contenu.langue} langue={langue} t={t}>
        <RenduBlocs blocs={contenu.doc.blocs ?? []} lien={lien} />
      </ContenuEnLangue>
    </section>
  )
}
