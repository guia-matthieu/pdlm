import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type PayloadRequest,
} from 'payload'

import { mesureInstallee } from '../lib/mesure/etat'
import { creerSiteCommune, supprimerSite } from '../lib/umami/client'
import { ecrire } from './journaliser'

/** I12 élargi : messages explicites, au lieu du seul « Modification — <commune> ». */
export const MESSAGES_MESURE = {
  activee: 'Mesure d’audience activée',
  desactivee: 'Mesure d’audience désactivée',
  effacee: 'Historique de mesure effacé',
  effacementDemande: 'Effacement de l’historique de mesure demandé',
  effacementRefuse: 'Effacement de l’historique de mesure refusé par le service de mesure',
} as const

interface Mesure {
  active?: boolean | null
  siteUmami?: string | null
  lienPartage?: string | null
}

const mesureDe = (doc: unknown): Mesure | undefined =>
  (doc as { mesure?: Mesure | null } | undefined)?.mesure ?? undefined

/** Domaine informatif du site Umami : le domaine canonique, sinon le sous-domaine de plateforme. */
async function domaineInformatif(
  req: PayloadRequest,
  communeId: number,
  slug: string,
): Promise<string> {
  const res = await req.payload.find({
    collection: 'domaines',
    where: { and: [{ commune: { equals: communeId } }, { canonique: { equals: true } }] },
    limit: 1,
    overrideAccess: true,
    req,
  })
  return res.docs[0]?.hostname ?? `${slug}.${process.env.PLATFORM_DOMAIN ?? 'localhost'}`
}

/**
 * Payload 3.90.1 : le parcours `beforeValidate` d'un champ `group` teste
 * `typeof siblingData[field.name] !== 'object'` pour décider de remplacer une
 * valeur absente par `{}` — or `typeof null === 'object'`, donc ce garde-fou
 * ne se déclenche pas pour `null`. Le parcours descend alors dans le groupe
 * avec `siblingData: null` et plante (`Cannot read properties of null`) en
 * tentant de lire ses champs enfants, avant même que `preparerMesure`
 * (beforeChange, plus tard dans le pipeline) ne s'exécute. Comme `mesure:
 * null` n'est de toute façon pas une demande de coupure dans notre modèle
 * (cf. `preparerMesure`), le plus simple et le plus sûr est de le retirer ici
 * — au tout début de l'opération, avant que Payload n'y touche — ce qui
 * revient à « rien envoyé pour ce groupe ».
 */
export const ignorerMesureNulle: CollectionBeforeOperationHook = ({ args, operation }) => {
  if (operation === 'create' || operation === 'update') {
    const data = (args as { data?: Record<string, unknown> }).data
    if (data && data.mesure === null) delete data.mesure
  }
  return args
}

/**
 * `siteUmami` et `lienPartage` ne sont écrits que par ce hook : la valeur
 * reçue du client est toujours remplacée par celle de la base, y compris
 * quand le client envoie `mesure: null`.
 *
 * Chaque passage de « coupée » à « active » vérifie le site dans Umami, même
 * s'il existe déjà : l'appel est idempotent (identifiant déterministe,
 * partage réutilisé) et répare le cas où le site a disparu d'Umami — par
 * exemple une suppression de commune dont Umami a exécuté le DELETE avant que
 * la transaction pdlm soit annulée. Un échec refuse l'enregistrement, la
 * mesure reste coupée.
 */
export const preparerMesure: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (data?.mesure === undefined) return data
  const avant = mesureDe(originalDoc)
  const mesure: Mesure = {
    // `mesure: null` n'est pas une demande de coupure : l'état actuel est gardé.
    ...(data.mesure ?? { active: avant?.active ?? false }),
    siteUmami: avant?.siteUmami ?? null,
    lienPartage: avant?.lienPartage ?? null,
  }
  data.mesure = mesure
  const activation = mesure.active === true && avant?.active !== true
  if (!activation) return data

  // À la création, la commune n'a pas encore d'identifiant (même piège que I6).
  if (operation === 'create') {
    throw new APIError('Activez la mesure d’audience une fois la commune créée.', 400, null, true)
  }
  if (!mesureInstallee()) {
    throw new APIError('Mesure d’audience non installée sur cette plateforme.', 400, null, true)
  }
  const id = Number(originalDoc.id)
  try {
    const site = await creerSiteCommune({
      id,
      nom: String(data.nom ?? originalDoc.nom),
      domaine: await domaineInformatif(req, id, String(originalDoc.slug)),
    })
    mesure.siteUmami = site.siteUmami
    mesure.lienPartage = site.lienPartage
  } catch (erreur) {
    req.payload.logger.error({ err: erreur }, 'Activation de la mesure d’audience impossible')
    throw new APIError(
      'Le service de mesure d’audience ne répond pas ; la mesure reste coupée. Réessayez plus tard.',
      503,
      null,
      true,
    )
  }
  return data
}

/** Journalise l'activation et la désactivation (I12). */
export const journaliserMesure: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc
  const avant = mesureDe(previousDoc)?.active === true
  const apres = mesureDe(doc)?.active === true
  if (avant !== apres) {
    const nom = String((doc as { nom?: unknown }).nom)
    await ecrire(
      req,
      'commune',
      `${apres ? MESSAGES_MESURE.activee : MESSAGES_MESURE.desactivee} — ${nom}`,
      Number(doc.id),
      nom,
    )
  }
  return doc
}

/**
 * Suppression d'une commune : son site Umami est supprimé dans la
 * transaction, en DERNIER (après le journal) : si Umami refuse, tout est
 * annulé, journal compris ; si le journal échoue, Umami n'est jamais appelé.
 * Reste un cas : Umami a supprimé, puis la validation de la transaction
 * échoue — la commune garde son `siteUmami`, et la prochaine activation
 * recrée le site sous le même identifiant (`preparerMesure` revérifie le site
 * à chaque activation ; vérifié : Umami accepte de recréer l'identifiant).
 *
 * Sans UMAMI_URL, la suppression est refusée : une variable perdue au
 * redéploiement ne prouve pas que les données de mesure ont disparu. Seule une
 * désinstallation déclarée (`UMAMI_DESINSTALLE=1`, après suppression de la
 * base `umami`, README) laisse passer, avec un avertissement.
 */
export const supprimerSiteMesure: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const site = mesureDe(doc)?.siteUmami
  if (!site) return doc
  if (!mesureInstallee()) {
    if (process.env.UMAMI_DESINSTALLE === '1') {
      req.payload.logger.warn(`Mesure d’audience désinstallée : site Umami ${site} non supprimé`)
      return doc
    }
    throw new APIError(
      'Cette commune a un historique de mesure d’audience, mais le service de mesure n’est pas configuré (UMAMI_URL) : la commune n’a pas été supprimée.',
      400,
      null,
      true,
    )
  }
  try {
    await supprimerSite(site)
  } catch (erreur) {
    req.payload.logger.error({ err: erreur }, 'Suppression du site de mesure impossible')
    throw new APIError(
      'Le service de mesure d’audience ne répond pas ; la commune n’a pas été supprimée. Réessayez plus tard.',
      503,
      null,
      true,
    )
  }
  return doc
}
