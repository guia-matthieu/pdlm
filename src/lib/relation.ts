/**
 * L'identifiant d'une relation Payload, qu'elle soit lue non peuplée
 * (`depth: 0` : l'identifiant) ou peuplée (`depth ≥ 1` : le document).
 * Fonction pure, sans base.
 */
export function idRelation(ref: unknown): string | number | null {
  if (typeof ref === 'string') return ref === '' ? null : ref
  if (typeof ref === 'number') return ref
  if (typeof ref === 'object' && ref !== null) {
    const id = (ref as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}
