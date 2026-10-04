import type { Dictionnaire } from '@/i18n'
import type { CodeLangue } from '@/lib/langues'

/**
 * Règle 1 : un contenu non traduit s'affiche ENTIER en français, dans un
 * conteneur lang="fr", précédé d'une mention écrite dans la langue affichée
 * (RGAA 8.7 ; l'inverse de l'anti-modèle qui déclare breton du français).
 */
export function ContenuEnLangue({
  langueContenu,
  langue,
  t,
  children,
}: {
  langueContenu: CodeLangue
  langue: CodeLangue
  t: Dictionnaire
  children: React.ReactNode
}) {
  if (langueContenu === langue) return <>{children}</>
  return (
    <>
      <p className="mention-non-traduit" lang={langue}>
        {t.nonTraduit}
      </p>
      <div lang={langueContenu}>{children}</div>
    </>
  )
}
