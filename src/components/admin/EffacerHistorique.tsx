'use client'

import { Button, useConfig, useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

type Etape = 'repos' | 'confirmation' | 'envoi' | 'fait' | 'erreur'

/**
 * « Supprimer l’historique » : confirmation en deux temps qui dit ce qui sera
 * effacé, puis appel du point d'accès (les droits y sont vérifiés, pas ici).
 */
export function EffacerHistorique() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const [etape, setEtape] = useState<Etape>('repos')
  const [message, setMessage] = useState('')

  async function effacer() {
    setEtape('envoi')
    try {
      const reponse = await fetch(
        `${config.serverURL ?? ''}${config.routes.api}/communes/${id}/mesure/effacer`,
        { method: 'POST', credentials: 'include' },
      )
      const corps = (await reponse.json().catch(() => ({}))) as { message?: string }
      setMessage(corps.message ?? '')
      setEtape(reponse.ok ? 'fait' : 'erreur')
    } catch {
      // La demande a pu partir : ne jamais affirmer que rien n'a été effacé.
      setMessage(
        'Le serveur n’a pas répondu ; l’effacement a peut-être eu lieu. Consultez le journal ou réessayez.',
      )
      setEtape('erreur')
    }
  }

  return (
    <div className="field-type">
      <p className="field-label">Historique de mesure d’audience</p>
      {etape === 'repos' && (
        <Button buttonStyle="secondary" onClick={() => setEtape('confirmation')}>
          Supprimer l’historique
        </Button>
      )}
      {etape === 'confirmation' && (
        <div role="alert">
          <p>
            Toutes les visites enregistrées pour cette commune seront effacées définitivement. Le
            site de mesure et le lien de partage du maire sont conservés.
          </p>
          <Button onClick={effacer}>Confirmer l’effacement</Button>{' '}
          <Button buttonStyle="secondary" onClick={() => setEtape('repos')}>
            Annuler
          </Button>
        </div>
      )}
      {etape === 'envoi' && <p aria-live="polite">Effacement en cours…</p>}
      {(etape === 'fait' || etape === 'erreur') && <p role="status">{message}</p>}
    </div>
  )
}
