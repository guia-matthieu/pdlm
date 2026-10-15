import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import '../(frontend)/styles.css'

export const metadata: Metadata = {
  title: 'Aperçu de l’apparence',
}

/**
 * Racine propre du groupe `(apercu)` : le front public résout commune et
 * langue depuis le domaine — cette page n’a ni l’un ni l’autre, elle les
 * porte dans son adresse. Le corps reste nu : les variables de gabarit sont
 * posées par la page, qui seule connaît les paramètres validés.
 */
export default function LayoutApercu({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
