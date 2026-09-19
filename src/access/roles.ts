/**
 * Utilitaires de rôles — invariant I1 du plan.
 *
 * Toute vérification de rôle est contextualisée par commune : on calcule les IDs
 * de communes où l'utilisateur détient le rôle requis, puis on retourne une
 * contrainte `tenant: { in: [...] }`. Le sélecteur de commune de l'admin n'est
 * jamais une preuve d'autorisation.
 */

/** Forme minimale d'un utilisateur Payload telle qu'utilisée par les contrôles d'accès. */
export interface UtilisateurAcces {
  id?: string | number
  role?: string | null
  tenants?: Array<{ tenant?: unknown; roles?: readonly string[] | null } | null> | null
}

/** Rôles par commune (champ `tenants[].roles` injecté par le plugin multi-tenant). */
export const ROLES_COMMUNE = ['admin', 'redacteur'] as const
export type RoleCommune = (typeof ROLES_COMMUNE)[number]

/** Vrai si l'utilisateur est un opérateur (staff de l'organisation hébergeuse). */
export function isOperateur(user: UtilisateurAcces | null | undefined): boolean {
  return user?.role === 'operateur'
}

/**
 * IDs des communes où l'utilisateur détient au moins un des rôles donnés.
 * Un opérateur n'a pas de liste : les access functions le court-circuitent par `true`.
 */
export function communesAvecRole(
  user: UtilisateurAcces | null | undefined,
  ...roles: string[]
): string[] {
  if (!user) return []
  const resultat: string[] = []
  for (const ligne of user.tenants ?? []) {
    if (!ligne?.tenant) continue
    if ((ligne.roles ?? []).some((r) => roles.includes(r))) {
      resultat.push(String(ligne.tenant))
    }
  }
  return resultat
}

/** Extrait l'ID numérique d'une référence Payload (ID brut ou objet peuplé). */
export function idDe(ref: unknown): number | undefined {
  if (typeof ref === 'number') return ref
  if (ref && typeof ref === 'object' && 'id' in ref) {
    const id = (ref as { id: unknown }).id
    if (typeof id === 'number') return id
    if (typeof id === 'string' && id !== '') return Number(id)
  }
  return undefined
}

/** Vrai si l'utilisateur détient un des rôles donnés sur la commune indiquée. */
export function aRoleSur(
  user: UtilisateurAcces | null | undefined,
  commune: string | number | null | undefined,
  ...roles: string[]
): boolean {
  if (!commune) return false
  return communesAvecRole(user, ...roles).includes(String(commune))
}
