import { expect, type Page } from '@playwright/test'

/** Millisecondes par jour : les événements de test sont datés depuis maintenant. */
export const JOUR = 24 * 3600_000

export type EvenementTest = { titre: string; lieu: string; jours: number }

/* Appel API depuis le navigateur (cookie de session + en-têtes propres,
 * acceptés par la protection CSRF) — même raison que les api() des specs. */
async function appel(page: Page, chemin: string, init?: RequestInit) {
  return page.evaluate(
    async ({ chemin, init }) => {
      const reponse = await fetch(chemin, { credentials: 'include', ...init })
      return { ok: reponse.ok, statut: reponse.status, corps: await reponse.text() }
    },
    { chemin, init },
  )
}

/**
 * Crée des événements à venir pour la commune (jours comptés depuis
 * maintenant) : la spec qui les demande ne dépend ainsi jamais des
 * événements de démonstration, figés à la date de l'amorçage.
 */
export async function creerEvenements(
  page: Page,
  idCommune: number,
  evenements: EvenementTest[],
): Promise<number[]> {
  const ids: number[] = []
  for (const e of evenements) {
    const debut = Date.now() + e.jours * JOUR
    const r = await appel(page, '/api/evenements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: idCommune,
        titre: e.titre,
        dateDebut: new Date(debut).toISOString(),
        dateFin: new Date(debut + 3 * 3600_000).toISOString(),
        lieu: e.lieu,
      }),
    })
    expect(r.ok, `création « ${e.titre} » → ${r.statut} : ${r.corps.slice(0, 300)}`).toBe(true)
    ids.push(JSON.parse(r.corps).doc.id)
  }
  return ids
}

/**
 * Supprime les événements portant ces titres (un passage interrompu laisse
 * les siens en base) et vérifie par GET que chacun est bien parti : la base
 * ne garde aucun événement de test après la spec.
 */
export async function supprimerEvenements(page: Page, titres: string[]): Promise<void> {
  const filtre = titres
    .map((t, i) => `where[titre][in][${i}]=${encodeURIComponent(t)}`)
    .join('&')
  const r = await appel(page, `/api/evenements?${filtre}&limit=100&depth=0&draft=true`)
  expect(r.ok, `recherche par titre → ${r.statut} : ${r.corps.slice(0, 300)}`).toBe(true)
  for (const { id, titre } of JSON.parse(r.corps).docs as Array<{ id: number; titre: string }>) {
    const d = await appel(page, `/api/evenements/${id}`, { method: 'DELETE' })
    expect(d.ok, `suppression « ${titre} » → ${d.statut}`).toBe(true)
    const g = await appel(page, `/api/evenements/${id}`)
    expect(
      g.statut,
      `« ${titre} » (id ${id}) devait disparaître, GET renvoie ${g.statut}`,
    ).toBe(404)
  }
}
