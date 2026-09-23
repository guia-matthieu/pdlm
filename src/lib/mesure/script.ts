const UNE_HEURE_MS = 3_600_000

/** Copie en mémoire du script d'Umami : il suit la version installée, sans copie dans le dépôt. */
let copie: { texte: string; expire: number } | null = null

/** Pour les tests. */
export function viderCacheScript(): void {
  copie = null
}

/** Le script d'Umami, gardé une heure ; une copie périmée vaut mieux que rien. Null : indisponible. */
export async function scriptUmami(): Promise<string | null> {
  const umami = process.env.UMAMI_URL
  if (!umami) return null
  if (!copie || copie.expire < Date.now()) {
    try {
      const reponse = await fetch(`${umami.replace(/\/$/, '')}/script.js`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!reponse.ok) throw new Error(`statut ${reponse.status}`)
      copie = { texte: await reponse.text(), expire: Date.now() + UNE_HEURE_MS }
    } catch {
      if (!copie) return null
    }
  }
  return copie.texte
}
