import type { Endpoint } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'
import { ecrire } from '../hooks/journaliser'
import { MESSAGES_MESURE } from '../hooks/mesureAudience'
import { effacerHistorique, UmamiIndisponible } from '../lib/umami/client'

/**
 * POST /api/communes/:id/mesure/effacer — réservé à l'admin de la commune et
 * à l'opérateur.
 *
 * I12 face à une action externe irréversible : l'intention est journalisée
 * et VALIDÉE avant l'appel à Umami (hors transaction : `req` d'un point
 * d'accès n'en ouvre pas), puis le résultat est journalisé. Un journal refusé
 * empêche l'effacement. Quoi qu'il arrive ensuite (Umami sans réponse, panne
 * de pdlm, réponse perdue par le navigateur), l'entrée « demandé » reste : une
 * demande sans entrée « effacé » ni « refusé » signale un état incertain.
 */
export const effacerHistoriqueMesure: Endpoint = {
  path: '/:id/mesure/effacer',
  method: 'post',
  handler: async (req) => {
    const id = Number(req.routeParams?.id)
    if (!req.user || !(isOperateur(req.user) || aRoleSur(req.user, id, 'admin'))) {
      return Response.json(
        { message: 'Action réservée à l’administrateur de la commune.' },
        { status: 403 },
      )
    }
    const commune = await req.payload
      .findByID({ collection: 'communes', id, overrideAccess: true, req })
      .catch(() => null)
    const site = commune?.mesure?.siteUmami
    if (!commune || !site) {
      return Response.json(
        { message: 'Cette commune n’a pas d’historique de mesure.' },
        { status: 404 },
      )
    }
    const journaliser = (message: string) =>
      ecrire(req, 'commune', `${message} — ${commune.nom}`, commune.id, commune.nom)

    try {
      await journaliser(MESSAGES_MESURE.effacementDemande)
    } catch (erreur) {
      req.payload.logger.error({ err: erreur }, 'Journal refusé : effacement non tenté')
      return Response.json(
        { message: 'Le journal n’a pas pu être écrit ; rien n’a été effacé.' },
        { status: 500 },
      )
    }

    try {
      await effacerHistorique(site)
    } catch (erreur) {
      req.payload.logger.error({ err: erreur }, 'Effacement de l’historique de mesure impossible')
      if (erreur instanceof UmamiIndisponible && erreur.sansReponse) {
        return Response.json(
          {
            message:
              'Le service de mesure d’audience n’a pas confirmé l’effacement ; il a peut-être eu lieu. Réessayez : un nouvel effacement est sans effet s’il est déjà fait.',
          },
          { status: 504 },
        )
      }
      await journaliser(MESSAGES_MESURE.effacementRefuse)
      return Response.json(
        {
          message:
            'Le service de mesure d’audience a refusé l’effacement ; rien n’a été effacé. Réessayez plus tard.',
        },
        { status: 503 },
      )
    }

    try {
      await journaliser(MESSAGES_MESURE.effacee)
    } catch (erreur) {
      // L'effacement a eu lieu : le dire, même si le journal ne garde que la demande.
      req.payload.logger.error({ err: erreur }, 'Effacement confirmé, journal final impossible')
      return Response.json({
        message:
          'Historique effacé par le service de mesure ; la confirmation n’a pas pu être écrite au journal, qui garde la demande.',
      })
    }
    return Response.json({ message: 'Historique effacé.' })
  },
}
