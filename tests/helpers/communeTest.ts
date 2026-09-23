import type { Payload } from 'payload'

/**
 * Commune active avec un domaine propre canonique : c'est ce qui la rend
 * résoluble par `communeDuHost` (I6 exige le domaine avant l'activation).
 */
export async function creerCommuneActive(
  payload: Payload,
  prefixe: string,
): Promise<{ id: number; host: string }> {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const host = `${prefixe}-${suffixe}.test`
  const { id } = await payload.create({
    collection: 'communes',
    data: { nom: `${prefixe} ${suffixe}`, slug: `${prefixe}-${suffixe}`, actif: false },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'domaines',
    data: { hostname: host, commune: id, canonique: true },
    overrideAccess: true,
  })
  await payload.update({ collection: 'communes', id, data: { actif: true }, overrideAccess: true })
  return { id, host }
}

/**
 * Commune désactivée d'abord : I6 interdit de retirer le dernier domaine
 * canonique d'une commune active (`Domaines.ts`, `beforeDelete`). Domaines
 * ensuite, commune enfin — une commune encore rattachée ne se supprime pas
 * (décision f). La suppression en masse (`where`) avale les erreurs par
 * document au lieu de les relancer (`deleteOperation`, contrairement à
 * `deleteByIDOperation`) : on vérifie donc explicitement qu'il ne reste
 * aucun domaine avant de supprimer la commune elle-même.
 */
export async function supprimerCommuneTest(payload: Payload, id: number): Promise<void> {
  await payload.update({ collection: 'communes', id, data: { actif: false }, overrideAccess: true })
  await payload.delete({
    collection: 'domaines',
    where: { commune: { equals: id } },
    overrideAccess: true,
  })
  const restants = await payload.count({
    collection: 'domaines',
    where: { commune: { equals: id } },
    overrideAccess: true,
  })
  if (restants.totalDocs > 0) {
    throw new Error(
      `supprimerCommuneTest : ${restants.totalDocs} domaine(s) encore rattaché(s) à la commune ${id} (suppression en masse silencieusement refusée).`,
    )
  }
  await payload.delete({ collection: 'communes', id, overrideAccess: true })
}
