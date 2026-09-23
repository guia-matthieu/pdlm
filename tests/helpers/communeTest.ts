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

/** Domaines d'abord : une commune encore rattachée ne se supprime pas (décision f). */
export async function supprimerCommuneTest(payload: Payload, id: number): Promise<void> {
  await payload.delete({
    collection: 'domaines',
    where: { commune: { equals: id } },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'communes', id, overrideAccess: true })
}
