# Conformité RPNT — lot 1 : mandats (opérateur / mandataire / commune) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une organisation (EPCI, ville voisine, prestataire) peut agir pour les seules communes qui l'ont mandatée — voir, rédiger, publier — sans jamais décider à la place de la commune (I36), et tout mandat accordé ou retiré est journalisé.

**Architecture:** Deux nouvelles collections : `organisations` (tenue par l'opérateur) et `mandats` (organisation × commune × dates, accordé par l'admin de la commune ou l'opérateur). Un utilisateur rattaché à une organisation reçoit, **à chaque lecture de son compte** (donc à chaque authentification), une ligne `{ tenant, roles: ['mandataire'] }` par mandat actif : le plugin multi-tenant et nos fonctions d'accès la voient comme un rôle par commune ordinaire. Ces lignes ne sont jamais écrites en base. Un mandat retiré ou échu disparaît donc à la requête suivante, sans tâche de synchronisation.

**Tech Stack:** Payload 3.90.1 (Postgres, `@payloadcms/plugin-multi-tenant` 3.90.1), Next 16.3.3, Vitest 4 + Playwright 1.58.

**Spec:** `docs/superpowers/specs/2026-10-01-conformite-rpnt-design.md`, **section 8** et invariant **I36** (lire avant toute tâche). Les sections 1 à 7 et 9 relèvent des lots suivants (voir fin de ce plan).

## Pourquoi les lignes de mandat sont calculées et non stockées

Vérifié dans le code installé le 01/10 :

- Le plugin lit les communes d'un utilisateur **uniquement** dans `req.user.tenants` (`plugin-multi-tenant/dist/utilities/getUserTenantIDs.js`), de façon synchrone. Un mandataire doit donc avoir ses communes dans ce tableau, sinon le plugin lui ferme tout.
- `req.user` est chargé par `payload.findByID(...)` dans la stratégie JWT (`payload/dist/auth/strategies/jwt.js`, l. ~99) : les hooks `afterRead` de la collection `users` s'appliquent à chaque requête authentifiée.
- Dans une opération `update`, `originalDoc` passe par l'`afterRead` **des champs** seulement (`collections/operations/utilities/update.js` l. 54), pas par les hooks de collection ; et les hooks `beforeChange` de collection tournent **avant** la validation des champs (même fichier, l. 155-197). Un hook `beforeChange` peut donc retirer les lignes calculées avant toute écriture ou validation.

Stocker les lignes (synchronisation à chaque changement de mandat) aurait laissé un mandat échu actif jusqu'au passage d'une tâche planifiée, et créé une seconde vérité à tenir cohérente.

## Décisions prises par ce plan (la spec ne les tranche pas — à contester avant exécution)

- **D1 — Le mandataire ne supprime pas de contenu.** Il crée, modifie, publie et dépublie ; la suppression reste à l'admin de la commune et à l'opérateur (« entre le rédacteur et l'admin »).
- **D2 — Le mandataire ne modifie pas la fiche commune** (coordonnées, horaires, logo, apparence). La spec ne la range ni dans ce qu'il peut, ni dans ce qu'il ne peut pas ; la fiche porte l'interrupteur de mesure d'audience, réservé à la commune. À rouvrir si le terrain le demande.
- **D3 — Le mandataire ne lit pas les comptes des agents de la commune** (minimisation des données personnelles). Il ne voit que son propre compte.
- **D4 — Retirer un mandat = poser sa date de fin** (à maintenant ou plus tôt). Un mandat retiré ne se rouvre pas : on en accorde un nouveau. Seul l'opérateur supprime un mandat. Un mandat dont la date de fin future arrive à échéance cesse d'agir sans nouvelle entrée de journal : la décision a été journalisée quand la date a été posée.
- **D5 — SIRET : contrôle de format seulement** (14 chiffres, espaces tolérés à la saisie). Pas de clé de Luhn : la règle d'exception de La Poste n'a pas été vérifiée à une source primaire pour ce plan.
- **D6 — Un utilisateur qui a déjà un rôle réel sur une commune n'y reçoit pas de ligne mandataire en plus** : le rôle réel prime.
- **D7 — Le mandat ne passe pas par le plugin multi-tenant** (champ `commune`, pas `tenant`) : sa lecture obéit à deux règles (commune administrée **ou** organisation de l'utilisateur) que le filtre du plugin ne sait pas exprimer.

## Global Constraints

- **Lire le guide Next** concerné dans `node_modules/next/dist/docs/` avant d'écrire une route ou une page (AGENTS.md). Ce lot n'en écrit pas, sauf le test e2e.
- **Message d'erreur montré à l'agent : `throw new APIError(message, 400, null, true)`** (import `APIError` depuis `payload`). Une `Error` simple n'est pas publique hors mode debug (`payload/dist/utilities/isErrorPublic.js`).
- Textes d'interface en français, apostrophe typographique ’, tiret cadratin — dans les messages de journal.
- Journal (I12, I36), type `mandat`, messages exacts : « Mandat accordé — <organisation> pour <commune> », « Mandat retiré — <organisation> pour <commune> », « Mandat modifié — <organisation> pour <commune> », « Mandat supprimé — <organisation> pour <commune> ».
- Invariant I36 cité en commentaire au point du code qui le garantit, comme I6, I12.
- La valeur de rôle est `mandataire`, exactement (spec section 8).
- Tests d'intégration : un utilisateur se charge **comme l'authentification le charge** — `payload.findByID({ collection: 'users', id, overrideAccess: true })` puis `collection: 'users'` ajouté à l'objet. Sans `collection`, le plugin n'applique pas son filtre par commune (`withTenantAccess.js`) et le test ne prouve que la moitié de l'accès.
- Commits : message en français, préfixe `Conformité RPNT — `, pied `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. `git add` par fichiers nommés, jamais `git add -A`. Ne pas committer `src/payload-types.ts` ni un `.json` de migration existant s'ils ne diffèrent que par la mise en forme.

## Review Focus

1. **Mandat échu pendant une session ouverte** : un mandataire connecté dont le mandat atteint sa date de fin perd l'accès à la requête suivante, sans se déconnecter. Test : tâche 4, « mandat échu : aucune ligne » (date de fin passée) et tâche 5, « retrait : accès coupé à la requête suivante ».
2. **L'opérateur enregistre la fiche d'un mandataire depuis l'admin** : le formulaire renvoie les lignes `mandataire` qu'il a affichées ; elles ne doivent jamais être écrites en base. Test : tâche 4, « lignes mandataire jamais écrites ».
3. **Mandataire qui est aussi rédacteur d'une autre commune** (agent d'une ville qui agit pour ses voisines) : il garde ses rôles réels et gagne les communes mandatées, sans que l'un écrase l'autre. Test : tâche 4, « rôle réel + mandat sur une autre commune ».
4. **Requête forgée par le mandataire** (`PATCH /api/communes/:id` avec `mesure.active`, `POST /api/domaines`, `POST /api/mandats`) : refusée, même pour une commune qu'il sert. Tests : tâche 5, matrice I36.
5. **Suppression d'une organisation ou d'une commune encore liée par un mandat** : refus explicite en français, pas d'erreur Postgres brute (même règle que la décision f pour les domaines). Tests : tâche 3, « commune liée par un mandat », tâche 2, « organisation encore rattachée ».

---

## Avant de commencer

- [ ] **Branche et arbre de travail**

```bash
cd ~/Projects/glm.conformite
git branch --show-current    # attendu : spec-conformite-rpnt
git status --short           # attendu : vide
git switch -c conformite-mandats
```

- [ ] **Dépendances** (le worktree n'a pas de `node_modules` au 01/10)

```bash
npm ci
```

- [ ] **Base de test disponible et suite verte**

```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pdlm_test'" | grep -q 1 \
  || docker compose -f docker-compose.dev.yml exec -T postgres createdb -U postgres pdlm_test
npm run test:unit && npm run test:int
```

Attendu : tout passe avant la première modification. Sinon, s'arrêter et le signaler.

## Carte des fichiers

| Fichier | Rôle |
|---|---|
| `src/access/roles.ts` | Rôle `mandataire`, ensembles `ROLES_REDACTION` et `ROLES_PUBLICATION` |
| `src/access/index.ts` | Fonctions d'accès des contenus, mandataire placé entre rédacteur et admin |
| `src/lib/siret.ts` | Normalisation et contrôle de format du SIRET (D5) |
| `src/collections/Organisations.ts` | Organisations mandataires (opérateur seul) |
| `src/collections/Mandats.ts` | Mandats : accès, champs |
| `src/hooks/mandats.ts` | Préparation (figer, doublon, dates) et journal des mandats |
| `src/hooks/lignesMandat.ts` | Lignes `mandataire` calculées à la lecture d'un compte, retirées à l'écriture |
| `tests/unit/roles-mandataire.spec.ts`, `tests/unit/siret.spec.ts` | Tests unitaires |
| `tests/int/organisations.int.spec.ts`, `tests/int/mandats.int.spec.ts`, `tests/int/lignes-mandat.int.spec.ts`, `tests/int/mandataire-i36.int.spec.ts` | Tests d'intégration |
| `tests/e2e/mandataire.e2e.spec.ts` | Connexion réelle d'un mandataire |

Fichiers modifiés : `src/payload.config.ts`, `src/collections/{Users,Communes,Journal,Media,Documents,Alertes,Evenements,Menus}.ts`, `src/hooks/{bloquerPublication,figerPrivileges,journaliser}.ts`, `src/seed/index.ts`, migrations générées.

---

### Task 1: Rôle `mandataire` dans les fonctions d'accès des contenus

**Files:**
- Modify: `src/access/roles.ts`
- Modify: `src/access/index.ts`
- Modify: `src/hooks/bloquerPublication.ts`
- Modify: `src/collections/Media.ts`, `src/collections/Documents.ts`, `src/collections/Alertes.ts`, `src/collections/Evenements.ts`, `src/collections/Menus.ts` (import renommé)
- Modify: `src/payload.config.ts` (option de rôle)
- Test: `tests/unit/roles-mandataire.spec.ts`

**Interfaces:**
- Produces: `ROLES_COMMUNE = ['admin', 'redacteur', 'mandataire']` ; `ROLES_REDACTION = ['admin', 'redacteur', 'mandataire']` ; `ROLES_PUBLICATION = ['admin', 'mandataire']` ; `creerPublication`, `majPublication` (renomment `creerAdmin`, `majAdmin`) ; `UtilisateurAcces.organisation?: unknown`.

- [ ] **Step 1: Write the failing test**

`tests/unit/roles-mandataire.spec.ts` :

```ts
import type { PayloadRequest } from 'payload'

import { describe, expect, it } from 'vitest'

import {
  creerContenu,
  creerPublication,
  majContenu,
  majPublication,
  supprimerContenu,
} from '@/access'
import { aRoleSur, communesAvecRole } from '@/access/roles'
import { Communes } from '@/collections/Communes'
import { Domaines } from '@/collections/Domaines'
import { bloquerPublication } from '@/hooks/bloquerPublication'

/**
 * I36 — le mandataire agit (rédige, publie), la commune décide.
 * Ligne `mandataire` telle que la produit `ajouterLignesMandat` (tâche 4).
 */
const mandataire = { id: 99, tenants: [{ tenant: 7, roles: ['mandataire'] }] }
const req = (user: unknown, context: Record<string, unknown> = {}) =>
  ({ user, context }) as unknown as PayloadRequest
const args = (data?: Record<string, unknown>) =>
  ({ req: req(mandataire), data }) as unknown as Parameters<typeof creerContenu>[0]

describe('mandataire — contenus de la commune mandante', () => {
  it('crée un brouillon sur sa commune, pas sur une autre', () => {
    expect(creerContenu(args({ tenant: 7 }))).toBe(true)
    expect(creerContenu(args({ tenant: 8 }))).toBe(false)
  })

  it('modifie les contenus de sa commune', () => {
    expect(majContenu(args())).toEqual({ tenant: { in: ['7'] } })
  })

  it('crée et modifie les contenus publiés immédiatement (médias, alertes…)', () => {
    expect(creerPublication(args({ tenant: 7 }))).toBe(true)
    expect(majPublication(args())).toEqual({ tenant: { in: ['7'] } })
  })

  it('D1 : ne supprime rien', () => {
    expect(supprimerContenu(args())).toBe(false)
  })

  it('publie une page de sa commune', () => {
    const hook = () =>
      bloquerPublication({
        collection: { slug: 'pages' },
        req: req(mandataire),
        originalDoc: undefined,
        data: { tenant: 7, _status: 'published' },
      } as unknown as Parameters<typeof bloquerPublication>[0])
    expect(hook).not.toThrow()
  })
})

describe('mandataire — ce qui reste à la commune (I36)', () => {
  it('n’est jamais admin', () => {
    expect(aRoleSur(mandataire, 7, 'admin')).toBe(false)
    expect(communesAvecRole(mandataire, 'admin')).toEqual([])
  })

  it('D2 : ne modifie pas la fiche commune', () => {
    const update = Communes.access!.update as (a: unknown) => unknown
    expect(update({ req: req(mandataire) })).toBe(false)
  })

  it('ne crée ni ne modifie de domaine', () => {
    const create = Domaines.access!.create as (a: unknown) => unknown
    const update = Domaines.access!.update as (a: unknown) => unknown
    expect(create({ req: req(mandataire) })).toBe(false)
    expect(update({ req: req(mandataire) })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/roles-mandataire.spec.ts`
Expected: FAIL — `creerPublication` n'est pas exporté par `@/access`.

- [ ] **Step 3: Implement**

`src/access/roles.ts` — remplacer la déclaration de `ROLES_COMMUNE` et compléter `UtilisateurAcces` :

```ts
/** Forme minimale d'un utilisateur Payload telle qu'utilisée par les contrôles d'accès. */
export interface UtilisateurAcces {
  id?: string | number
  role?: string | null
  /** Organisation mandataire de l'utilisateur (spec RPNT section 8), ID ou objet peuplé. */
  organisation?: unknown
  tenants?: Array<{ tenant?: unknown; roles?: readonly string[] | null } | null> | null
}

/**
 * Rôles par commune (champ `tenants[].roles` injecté par le plugin multi-tenant).
 * `mandataire` n'est jamais écrit en base : il est calculé à la lecture du
 * compte depuis les mandats actifs de son organisation (hooks/lignesMandat.ts).
 */
export const ROLES_COMMUNE = ['admin', 'redacteur', 'mandataire'] as const
export type RoleCommune = (typeof ROLES_COMMUNE)[number]

/** Rôles qui rédigent (brouillons des collections à workflow). */
export const ROLES_REDACTION: readonly RoleCommune[] = ['admin', 'redacteur', 'mandataire']

/**
 * Rôles qui écrivent dans la version publique. I36 : le mandataire publie
 * (c'est le travail que les mairies ne font pas), mais n'est jamais admin —
 * utilisateurs, domaine, activation et interrupteurs restent à `admin`.
 */
export const ROLES_PUBLICATION: readonly RoleCommune[] = ['admin', 'mandataire']
```

`src/access/index.ts` — remplacer le fichier à partir de l'import de `./roles` :

```ts
import { communesAvecRole, isOperateur, ROLES_PUBLICATION, ROLES_REDACTION } from './roles'

/** Collections avec workflow drafts (pages, actualites) : l'anonyme ne lit que le publié. */
export const lirePublieOuAuthentifie: Access = ({ req }) =>
  isOperateur(req.user) || Boolean(req.user) || { _status: { equals: 'published' } }

/** Collections immédiatement publiques (media, documents, menus, evenements, alertes) : I5/D9. */
export const lirePublic: Access = () => true

const cibleDe = (data: unknown): string =>
  data && typeof data === 'object' && 'tenant' in data
    ? String((data as { tenant?: unknown }).tenant ?? '')
    : ''

/** Contenu rédigeable (brouillons) : opérateur, admin, rédacteur ou mandataire de la commune visée. */
export const creerContenu: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_REDACTION)
  const cible = cibleDe(data)
  return ids.length > 0 && cible !== '' && ids.includes(cible)
}

export const majContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_REDACTION)
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Suppression : opérateur ou admin de la commune uniquement (D1 : pas le mandataire). */
export const supprimerContenu: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, 'admin')
  return ids.length > 0 ? { tenant: { in: ids } } : false
}

/** Collections publiées dès l'écriture (sans workflow) : opérateur, admin ou mandataire (I3, I36). */
export const creerPublication: Access = ({ req, data }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_PUBLICATION)
  const cible = cibleDe(data)
  return ids.length > 0 && cible !== '' && ids.includes(cible)
}

export const majPublication: Access = ({ req }) => {
  if (isOperateur(req.user)) return true
  const ids = communesAvecRole(req.user, ...ROLES_PUBLICATION)
  return ids.length > 0 ? { tenant: { in: ids } } : false
}
```

Dans `Media.ts`, `Documents.ts`, `Alertes.ts`, `Evenements.ts`, `Menus.ts` : remplacer `creerAdmin` par `creerPublication` et `majAdmin` par `majPublication` (import et bloc `access`). Vérifier qu'il ne reste aucun usage :

```bash
grep -rn "creerAdmin\|majAdmin" src tests
```
Expected: aucune ligne.

`src/hooks/bloquerPublication.ts` — importer `ROLES_PUBLICATION` depuis `../access/roles` et remplacer le contrôle final :

```ts
    if (!isOperateur(req.user) && !aRoleSur(req.user, commune, ...ROLES_PUBLICATION)) {
      throw new Error(
        'Seul un administrateur de la commune, un mandataire ou un opérateur peut publier ou dépublier.',
      )
    }
```

Mettre à jour le commentaire d'en-tête du hook : « l'état publié d'un contenu est du ressort de l'opérateur, des admins de la commune et de ses mandataires (I36) ». Puis :

```bash
grep -rn "Seul un administrateur de la commune ou un opérateur" tests
```
Toute assertion trouvée prend le nouveau message.

`src/payload.config.ts` — dans `tenantsArrayField.rowFields[0].options`, ajouter après « Rédacteur » :

```ts
              {
                // Jamais enregistré : calculé depuis les mandats actifs (hooks/lignesMandat.ts).
                label: 'Mandataire (par mandat)',
                value: 'mandataire',
              },
```

- [ ] **Step 4: Run tests**

Run: `npm run test:unit && npm run typecheck`
Expected: PASS, typecheck sans erreur.

- [ ] **Step 5: Commit**

```bash
git add src/access/roles.ts src/access/index.ts src/hooks/bloquerPublication.ts \
  src/collections/Media.ts src/collections/Documents.ts src/collections/Alertes.ts \
  src/collections/Evenements.ts src/collections/Menus.ts src/payload.config.ts \
  tests/unit/roles-mandataire.spec.ts
git commit -m "Conformité RPNT — rôle mandataire dans l'accès aux contenus

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Ajouter au `git add` tout fichier de test dont le message de publication a été mis à jour.)

---

### Task 2: Organisations et rattachement d'un compte

**Files:**
- Create: `src/lib/siret.ts`
- Create: `src/collections/Organisations.ts`
- Modify: `src/collections/Users.ts` (champ `organisation`)
- Modify: `src/hooks/figerPrivileges.ts`
- Modify: `src/payload.config.ts` (collection)
- Test: `tests/unit/siret.spec.ts`, `tests/int/organisations.int.spec.ts`

**Interfaces:**
- Consumes: `isOperateur` (`src/access/roles.ts`).
- Produces: collection `organisations` { `nom`: text requis, `nature`: `'epci' | 'commune' | 'prestataire' | 'opsn' | 'autre'` requis, `siret`: text requis unique (14 chiffres) } ; champ `users.organisation` (relation `organisations`, opérateur seul) ; `normaliserSiret(brut: string): string` ; `validerSiret(v: string | null | undefined): true | string`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/siret.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { normaliserSiret, validerSiret } from '@/lib/siret'

describe('SIRET (D5 : format seulement)', () => {
  it('retire les espaces de saisie', () => {
    expect(normaliserSiret(' 200 022 000 00000 ')).toBe('20002200000000')
  })
  it('accepte 14 chiffres', () => {
    expect(validerSiret('20002200000000')).toBe(true)
  })
  it('refuse 9 chiffres (un SIREN)', () => {
    expect(validerSiret('200022000')).toBe('Le SIRET compte 14 chiffres.')
  })
  it('refuse une lettre', () => {
    expect(validerSiret('2000220000000A')).toBe('Le SIRET compte 14 chiffres.')
  })
  it('refuse le vide', () => {
    expect(validerSiret('')).toBe('Le SIRET compte 14 chiffres.')
  })
})
```

`tests/int/organisations.int.spec.ts` :

```ts
import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

/** Spec RPNT section 8 — organisations mandataires, tenues par l'opérateur. */

let payload: Payload
let operateur: Record<string, unknown>
let simple: Record<string, unknown>
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@orga.pdlm.invalid'
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest

beforeAll(async () => {
  payload = await getPayloadClient()
  operateur = await payload.create({
    collection: 'users',
    data: { email: `op${DOMAINE}`, password: MDP_TEST, role: 'operateur' },
    overrideAccess: true,
  })
  simple = await payload.create({
    collection: 'users',
    data: { email: `simple${DOMAINE}`, password: MDP_TEST },
    overrideAccess: true,
  })
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', where: { siret: { like: '2000' } }, overrideAccess: true })
  } catch {
    // base jetable
  }
})

describe('organisations', () => {
  it('l’opérateur crée une organisation, SIRET normalisé', async () => {
    const o = await payload.create({
      collection: 'organisations',
      data: { nom: 'CC du Val', nature: 'epci', siret: '200 033 000 00007' },
      req: req(operateur),
      overrideAccess: false,
    })
    expect(o.siret).toBe('20003300000007')
  })

  it('un non-opérateur ne crée pas d’organisation', async () => {
    await expect(
      payload.create({
        collection: 'organisations',
        data: { nom: 'Pirate', nature: 'autre', siret: '20004400000004' },
        req: req(simple),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('un SIRET mal formé est refusé', async () => {
    await expect(
      payload.create({
        collection: 'organisations',
        data: { nom: 'Mal formé', nature: 'autre', siret: '123' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/14 chiffres/)
  })

  it('seul l’opérateur rattache un compte à une organisation', async () => {
    const o = await payload.create({
      collection: 'organisations',
      data: { nom: 'Prestataire', nature: 'prestataire', siret: '20004400000004' },
      overrideAccess: true,
    })
    // L'utilisateur tente de se rattacher lui-même : figé par figerPrivileges.
    const apres = await payload.update({
      collection: 'users',
      id: simple.id as number,
      data: { organisation: o.id },
      req: req(simple),
      overrideAccess: false,
    })
    expect(apres.organisation ?? null).toBeNull()

    const parOperateur = await payload.update({
      collection: 'users',
      id: simple.id as number,
      data: { organisation: o.id },
      req: req(operateur),
      overrideAccess: false,
    })
    expect(parOperateur.organisation).toBeTruthy()
  })

  it('organisation encore rattachée : suppression refusée en clair', async () => {
    const o = await payload.find({
      collection: 'organisations',
      where: { siret: { equals: '20004400000004' } },
      overrideAccess: true,
    })
    await expect(
      payload.delete({ collection: 'organisations', id: o.docs[0].id, overrideAccess: true }),
    ).rejects.toThrow(/compte\(s\) sont encore rattaché\(s\)/)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/siret.spec.ts tests/int/organisations.int.spec.ts`
Expected: FAIL — module `@/lib/siret` introuvable ; collection `organisations` inconnue.

- [ ] **Step 3: Implement**

`src/lib/siret.ts` :

```ts
/**
 * SIRET d'une organisation mandataire (spec RPNT section 8) : il préparera le
 * rattachement par ProConnect, qui identifie un agent par le SIRET de son
 * organisation. D5 : contrôle de format seulement.
 */
export function normaliserSiret(brut: string): string {
  return brut.replace(/\s+/g, '')
}

export function validerSiret(v: string | null | undefined): true | string {
  return typeof v === 'string' && /^\d{14}$/.test(normaliserSiret(v))
    ? true
    : 'Le SIRET compte 14 chiffres.'
}
```

`src/collections/Organisations.ts` :

```ts
import { APIError, type CollectionConfig } from 'payload'

import { isOperateur } from '../access/roles'
import { normaliserSiret, validerSiret } from '../lib/siret'

/**
 * Spec RPNT section 8 — organisation qui agit pour le compte d'une ou de
 * plusieurs communes (services d'un EPCI, d'une ville, prestataire). Tenue par
 * l'opérateur ; lisible par tout compte authentifié, pour que l'admin d'une
 * commune choisisse à qui il accorde un mandat (nom et SIRET sont publics).
 */
export const Organisations: CollectionConfig = {
  slug: 'organisations',
  labels: { singular: 'Organisation', plural: 'Organisations' },
  admin: { useAsTitle: 'nom', defaultColumns: ['nom', 'nature', 'siret'] },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => isOperateur(req.user),
    update: ({ req }) => isOperateur(req.user),
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.siret === 'string') data.siret = normaliserSiret(data.siret)
        return data
      },
    ],
    // Même règle que la décision (f) : refuser avant que Postgres ne le fasse.
    beforeDelete: [
      async ({ req, id }) => {
        const comptes = await req.payload.count({
          collection: 'users',
          where: { organisation: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (comptes.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${comptes.totalDocs} compte(s) sont encore rattaché(s) à cette organisation.`,
            400,
            null,
            true,
          )
        }
      },
    ],
  },
  fields: [
    { name: 'nom', type: 'text', required: true, label: 'Nom' },
    {
      name: 'nature',
      type: 'select',
      required: true,
      label: 'Nature',
      options: [
        { label: 'EPCI (intercommunalité)', value: 'epci' },
        { label: 'Commune', value: 'commune' },
        { label: 'Prestataire', value: 'prestataire' },
        { label: 'Opérateur public de services numériques (OPSN)', value: 'opsn' },
        { label: 'Autre', value: 'autre' },
      ],
    },
    {
      name: 'siret',
      type: 'text',
      required: true,
      unique: true,
      label: 'SIRET',
      validate: validerSiret,
    },
  ],
}
```

`src/collections/Users.ts` — ajouter le champ après `role` :

```ts
    {
      name: 'organisation',
      type: 'relationship',
      relationTo: 'organisations',
      label: 'Organisation mandataire',
      admin: {
        description:
          'Le compte agit pour les communes qui ont mandaté cette organisation (collection « Mandats »). Réglé par l’opérateur.',
      },
      access: {
        create: ({ req }) => isOperateur(req.user),
        update: ({ req }) => isOperateur(req.user),
      },
    },
```

`src/hooks/figerPrivileges.ts` — dans le bloc `if (originalDoc)`, ajouter :

```ts
    ;(data as Record<string, unknown>).organisation = originalDoc.organisation
```

et compléter le commentaire : « seul un opérateur peut modifier `role`, `organisation` et `tenants[].roles` ».

`src/payload.config.ts` — importer `Organisations` et l'ajouter à `collections` après `Users`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/siret.spec.ts tests/int/organisations.int.spec.ts && npm run typecheck`
Expected: PASS. (La base de test est créée par `push` : pas de migration nécessaire avant la tâche 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/siret.ts src/collections/Organisations.ts src/collections/Users.ts \
  src/hooks/figerPrivileges.ts src/payload.config.ts \
  tests/unit/siret.spec.ts tests/int/organisations.int.spec.ts
git commit -m "Conformité RPNT — organisations mandataires

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Collection `mandats` et journal

**Files:**
- Create: `src/collections/Mandats.ts`
- Create: `src/hooks/mandats.ts`
- Modify: `src/hooks/journaliser.ts` (type `mandat`)
- Modify: `src/collections/Journal.ts` (option `mandat`)
- Modify: `src/collections/Communes.ts` (`beforeDelete`)
- Modify: `src/collections/Organisations.ts` (`beforeDelete`)
- Modify: `src/payload.config.ts` (collection)
- Test: `tests/int/mandats.int.spec.ts`

**Interfaces:**
- Consumes: `ecrire(req, type, message, commune?, communeNom?)` (`src/hooks/journaliser.ts`) ; `communesAvecRole`, `idDe`, `isOperateur` ; collection `organisations` (tâche 2).
- Produces: collection `mandats` { `organisation` (relation requise), `commune` (relation requise), `dateDebut` (date, défaut maintenant), `dateFin` (date, facultative), `accordePar` (relation `users`, lecture seule) } ; `whereMandatsActifs(maintenant: Date): Where` ; `TypeJournal` inclut `'mandat'`.

- [ ] **Step 1: Write the failing test**

`tests/int/mandats.int.spec.ts` :

```ts
import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/** Spec RPNT section 8, I36 — accorder, retirer, journaliser un mandat. */

let payload: Payload
let communeA: number
let communeB: number
let organisation: number
let operateur: Record<string, unknown>
let adminA: Record<string, unknown>
let adminB: Record<string, unknown>
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@mandats.pdlm.invalid'
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const ilYA = (ms: number) => new Date(Date.now() - ms).toISOString()
const dans = (ms: number) => new Date(Date.now() + ms).toISOString()
const idDeRef = (r: unknown) => (r && typeof r === 'object' ? (r as { id: number }).id : r)

const mkUser = (nom: string, data: Record<string, unknown>) =>
  payload.create({
    collection: 'users',
    data: { email: `${nom}${DOMAINE}`, password: MDP_TEST, ...data },
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'mandat-a')).id
  communeB = (await creerCommuneActive(payload, 'mandat-b')).id
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC Mandats', nature: 'epci', siret: '20003300000007' },
      overrideAccess: true,
    })
  ).id
  operateur = await mkUser('op', { role: 'operateur' })
  adminA = await mkUser('admin-a', { tenants: [{ tenant: communeA, roles: ['admin'] }] })
  adminB = await mkUser('admin-b', { tenants: [{ tenant: communeB, roles: ['admin'] }] })
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    await supprimerCommuneTest(payload, communeA)
    await supprimerCommuneTest(payload, communeB)
  } catch {
    // base jetable
  }
})

describe('accorder un mandat', () => {
  it('l’admin de A accorde un mandat sur A ; accordePar est figé sur lui', async () => {
    const m = await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(m.id).toBeDefined()
    expect(String(idDeRef(m.accordePar))).toBe(String(adminA.id))
    expect(m.dateDebut).toBeTruthy()

    const journal = await payload.find({
      collection: 'journal',
      where: { and: [{ type: { equals: 'mandat' } }, { commune: { equals: communeA } }] },
      overrideAccess: true,
    })
    expect(journal.docs.map((e) => e.message)).toContain(
      `Mandat accordé — CC Mandats pour ${(await payload.findByID({ collection: 'communes', id: communeA, overrideAccess: true })).nom}`,
    )
  })

  it('l’admin de B ne peut pas accorder un mandat sur A', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(adminB),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('doublon actif refusé', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(operateur),
        overrideAccess: false,
      }),
    ).rejects.toThrow('Cette organisation est déjà mandataire de cette commune.')
  })

  it('date de fin avant la date de début refusée', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeB, dateDebut: dans(86_400_000), dateFin: ilYA(0) },
        req: req(operateur),
        overrideAccess: false,
      }),
    ).rejects.toThrow('La date de fin précède la date de début.')
  })
})

describe('lire les mandats', () => {
  it('l’admin de B ne voit pas les mandats de A', async () => {
    const res = await payload.find({
      collection: 'mandats',
      where: { commune: { equals: communeA } },
      req: req(adminB),
      overrideAccess: false,
    })
    expect(res.totalDocs).toBe(0)
  })
})

describe('retirer un mandat (D4)', () => {
  it('l’admin pose la date de fin : « Mandat retiré » au journal ; organisation et commune restent figées', async () => {
    const [m] = (
      await payload.find({
        collection: 'mandats',
        where: { and: [{ organisation: { equals: organisation } }, { commune: { equals: communeA } }] },
        overrideAccess: true,
      })
    ).docs
    const apres = await payload.update({
      collection: 'mandats',
      id: m.id,
      data: { dateFin: ilYA(1000), commune: communeB },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(idDeRef(apres.commune)).toBe(communeA)

    const journal = await payload.find({
      collection: 'journal',
      where: { and: [{ type: { equals: 'mandat' } }, { message: { like: 'Mandat retiré — CC Mandats' } }] },
      overrideAccess: true,
    })
    expect(journal.totalDocs).toBe(1)
  })

  it('un mandat retiré ne se rouvre pas', async () => {
    const [m] = (
      await payload.find({
        collection: 'mandats',
        where: { and: [{ organisation: { equals: organisation } }, { commune: { equals: communeA } }] },
        overrideAccess: true,
      })
    ).docs
    await expect(
      payload.update({
        collection: 'mandats',
        id: m.id,
        data: { dateFin: null },
        req: req(adminA),
        overrideAccess: false,
      }),
    ).rejects.toThrow('Un mandat retiré ne se rouvre pas : accordez un nouveau mandat.')
  })

  it('après retrait, un nouveau mandat peut être accordé', async () => {
    const m = await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      req: req(adminA),
      overrideAccess: false,
    })
    expect(m.id).toBeDefined()
  })

  it('seul l’opérateur supprime un mandat', async () => {
    const [m] = (
      await payload.find({ collection: 'mandats', where: { commune: { equals: communeA } }, overrideAccess: true })
    ).docs
    await expect(
      payload.delete({ collection: 'mandats', id: m.id, req: req(adminA), overrideAccess: false }),
    ).rejects.toThrow()
  })
})

describe('suppressions liées', () => {
  it('commune liée par un mandat : suppression refusée en clair', async () => {
    await payload.update({ collection: 'communes', id: communeA, data: { actif: false }, overrideAccess: true })
    await payload.delete({ collection: 'domaines', where: { commune: { equals: communeA } }, overrideAccess: true })
    await expect(
      payload.delete({ collection: 'communes', id: communeA, overrideAccess: true }),
    ).rejects.toThrow(/mandat\(s\) sont encore rattaché\(s\) à cette commune/)
  })

  it('organisation liée par un mandat : suppression refusée en clair', async () => {
    await expect(
      payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true }),
    ).rejects.toThrow(/mandat\(s\) sont encore rattaché\(s\) à cette organisation/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mandats.int.spec.ts`
Expected: FAIL — collection `mandats` inconnue.

- [ ] **Step 3: Implement**

`src/hooks/journaliser.ts` — étendre le type :

```ts
export type TypeJournal = 'commune' | 'utilisateur' | 'domaine' | 'mandat'
```

`src/collections/Journal.ts` — ajouter l'option `{ label: 'Mandat', value: 'mandat' }` au champ `type`, et « mandats » à la description de la collection.

`src/hooks/mandats.ts` :

```ts
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type PayloadRequest,
  type Where,
} from 'payload'

import { idDe } from '../access/roles'
import { ecrire } from './journaliser'

const temps = (v: unknown): number | null =>
  typeof v === 'string' && v !== '' ? new Date(v).getTime() : null

/** Un mandat agit entre sa date de début (incluse) et sa date de fin (exclue). */
export function whereMandatsActifs(maintenant: Date): Where {
  const iso = maintenant.toISOString()
  return {
    and: [
      { dateDebut: { less_than_equal: iso } },
      { or: [{ dateFin: { exists: false } }, { dateFin: { greater_than: iso } }] },
    ],
  }
}

const refus = (message: string) => new APIError(message, 400, null, true)

/**
 * I36 — un mandat lie une organisation à une commune. Après création, seule la
 * date de fin bouge (D4) ; un mandat retiré ne se rouvre pas.
 */
export const preparerMandat: CollectionBeforeChangeHook = async ({
  req,
  data,
  originalDoc,
  operation,
}) => {
  const maintenant = new Date()
  if (operation === 'create') {
    data.accordePar = req.user ? idDe(req.user.id) : null
    data.dateDebut = data.dateDebut ?? maintenant.toISOString()
    const organisation = idDe(data.organisation)
    const commune = idDe(data.commune)
    if (organisation === undefined || commune === undefined) {
      throw refus('Un mandat lie une organisation à une commune.')
    }
    const actifs = await req.payload.count({
      collection: 'mandats',
      where: {
        and: [
          { organisation: { equals: organisation } },
          { commune: { equals: commune } },
          { or: [{ dateFin: { exists: false } }, { dateFin: { greater_than: maintenant.toISOString() } }] },
        ],
      },
      overrideAccess: true,
      req,
    })
    if (actifs.totalDocs > 0) throw refus('Cette organisation est déjà mandataire de cette commune.')
  } else if (originalDoc) {
    data.organisation = idDe(originalDoc.organisation)
    data.commune = idDe(originalDoc.commune)
    data.dateDebut = originalDoc.dateDebut
    data.accordePar = idDe(originalDoc.accordePar) ?? null
    const finAvant = temps(originalDoc.dateFin)
    if (
      finAvant !== null &&
      finAvant <= maintenant.getTime() &&
      temps(data.dateFin) !== finAvant
    ) {
      throw refus('Un mandat retiré ne se rouvre pas : accordez un nouveau mandat.')
    }
  }
  const debut = temps(data.dateDebut)
  const fin = temps(data.dateFin)
  if (debut !== null && fin !== null && fin < debut) {
    throw refus('La date de fin précède la date de début.')
  }
  return data
}

async function libelle(req: PayloadRequest, doc: Record<string, unknown>) {
  const organisation = await req.payload.findByID({
    collection: 'organisations',
    id: idDe(doc.organisation)!,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const commune = await req.payload.findByID({
    collection: 'communes',
    id: idDe(doc.commune)!,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return { texte: `${organisation.nom} pour ${commune.nom}`, communeId: commune.id, communeNom: commune.nom }
}

/** I36 : tout mandat accordé ou retiré est journalisé (I12). */
export const journaliserMandat: CollectionAfterChangeHook = async ({
  req,
  doc,
  previousDoc,
  operation,
}) => {
  const maintenant = Date.now()
  const finAvant = temps(previousDoc?.dateFin)
  const finApres = temps(doc.dateFin)
  const verbe =
    operation === 'create'
      ? 'Mandat accordé'
      : finApres !== null && finApres <= maintenant && (finAvant === null || finAvant > maintenant)
        ? 'Mandat retiré'
        : 'Mandat modifié'
  const { texte, communeId, communeNom } = await libelle(req, doc)
  await ecrire(req, 'mandat', `${verbe} — ${texte}`, communeId, communeNom)
  return doc
}

export const journaliserSuppressionMandat: CollectionAfterDeleteHook = async ({ req, doc }) => {
  const { texte, communeId, communeNom } = await libelle(req, doc)
  await ecrire(req, 'mandat', `Mandat supprimé — ${texte}`, communeId, communeNom)
  return doc
}
```

`src/collections/Mandats.ts` :

```ts
import type { CollectionConfig, Where } from 'payload'

import { communesAvecRole, idDe, isOperateur } from '../access/roles'
import { journaliserMandat, journaliserSuppressionMandat, preparerMandat } from '../hooks/mandats'

/**
 * Spec RPNT section 8, I36 — une organisation agit pour le compte d'une
 * commune. Accorder et retirer relèvent de l'admin de la commune ou de
 * l'opérateur ; l'organisation voit les mandats qu'elle détient. D7 : hors du
 * plugin multi-tenant, la lecture suit ces deux règles à la fois.
 */
export const Mandats: CollectionConfig = {
  slug: 'mandats',
  labels: { singular: 'Mandat', plural: 'Mandats' },
  admin: {
    defaultColumns: ['organisation', 'commune', 'dateDebut', 'dateFin'],
    description:
      'Organisations qui agissent pour le compte d’une commune : elles rédigent, publient et suivent la conformité ; la commune garde ses utilisateurs, son domaine et ses réglages.',
  },
  access: {
    read: ({ req }) => {
      if (isOperateur(req.user)) return true
      if (!req.user) return false
      const conditions: Where[] = []
      const administrees = communesAvecRole(req.user, 'admin')
      if (administrees.length > 0) conditions.push({ commune: { in: administrees } })
      const organisation = idDe((req.user as { organisation?: unknown }).organisation)
      if (organisation !== undefined) conditions.push({ organisation: { equals: organisation } })
      return conditions.length > 0 ? { or: conditions } : false
    },
    create: ({ req, data }) => {
      if (isOperateur(req.user)) return true
      const cible = idDe((data as { commune?: unknown } | undefined)?.commune)
      return cible !== undefined && communesAvecRole(req.user, 'admin').includes(String(cible))
    },
    update: ({ req }) => {
      if (isOperateur(req.user)) return true
      const administrees = communesAvecRole(req.user, 'admin')
      return administrees.length > 0 ? { commune: { in: administrees } } : false
    },
    delete: ({ req }) => isOperateur(req.user),
  },
  hooks: {
    beforeChange: [preparerMandat],
    afterChange: [journaliserMandat],
    afterDelete: [journaliserSuppressionMandat],
  },
  fields: [
    {
      name: 'organisation',
      type: 'relationship',
      relationTo: 'organisations',
      required: true,
      index: true,
      label: 'Organisation mandataire',
    },
    {
      name: 'commune',
      type: 'relationship',
      relationTo: 'communes',
      required: true,
      index: true,
      label: 'Commune',
    },
    {
      name: 'dateDebut',
      type: 'date',
      label: 'Début',
      admin: { date: { pickerAppearance: 'dayAndTime' }, description: 'Par défaut : maintenant.' },
    },
    {
      name: 'dateFin',
      type: 'date',
      label: 'Fin',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description:
          'Pour retirer le mandat tout de suite, choisir maintenant. Un mandat retiré ne se rouvre pas : en accorder un nouveau.',
      },
    },
    {
      name: 'accordePar',
      type: 'relationship',
      relationTo: 'users',
      label: 'Accordé par',
      admin: { readOnly: true },
    },
  ],
}
```

`src/collections/Communes.ts` — dans `hooks.beforeDelete`, après le contrôle des comptes :

```ts
        const mandats = await req.payload.count({
          collection: 'mandats',
          where: { commune: { equals: id } },
          overrideAccess: true,
        })
        if (mandats.totalDocs > 0) {
          throw new Error(
            `Suppression impossible : ${mandats.totalDocs} mandat(s) sont encore rattaché(s) à cette commune. Demandez à l’opérateur de les supprimer, ou désactivez la commune plutôt que de la supprimer.`,
          )
        }
```

`src/collections/Organisations.ts` — dans `beforeDelete`, après le contrôle des comptes :

```ts
        const mandats = await req.payload.count({
          collection: 'mandats',
          where: { organisation: { equals: id } },
          overrideAccess: true,
          req,
        })
        if (mandats.totalDocs > 0) {
          throw new APIError(
            `Suppression impossible : ${mandats.totalDocs} mandat(s) sont encore rattaché(s) à cette organisation.`,
            400,
            null,
            true,
          )
        }
```

`src/payload.config.ts` — importer `Mandats` et l'ajouter à `collections` après `Organisations`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mandats.int.spec.ts tests/int/journal.int.spec.ts tests/int/communes-suppression.int.spec.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/Mandats.ts src/hooks/mandats.ts src/hooks/journaliser.ts \
  src/collections/Journal.ts src/collections/Communes.ts src/collections/Organisations.ts \
  src/payload.config.ts tests/int/mandats.int.spec.ts
git commit -m "Conformité RPNT — mandats accordés, retirés, journalisés

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Lignes `mandataire` calculées à la lecture d'un compte

**Files:**
- Create: `src/hooks/lignesMandat.ts`
- Modify: `src/collections/Users.ts` (hooks, accès en lecture)
- Test: `tests/int/lignes-mandat.int.spec.ts`

**Interfaces:**
- Consumes: `whereMandatsActifs(maintenant: Date): Where` (tâche 3) ; `communesAvecRole`, `idDe`, `isOperateur`.
- Produces: `ajouterLignesMandat: CollectionAfterReadHook` ; `retirerLignesMandat: CollectionBeforeChangeHook`. Tout compte lu porte, dans `tenants`, une ligne `{ tenant: <id commune>, roles: ['mandataire'] }` par mandat actif de son organisation, sauf sur une commune où il a déjà un rôle réel (D6).

- [ ] **Step 1: Write the failing test**

`tests/int/lignes-mandat.int.spec.ts` :

```ts
import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/**
 * Spec RPNT section 8 — les utilisateurs d'une organisation héritent du rôle
 * `mandataire` sur chaque commune qui l'a mandatée, tant que le mandat est actif.
 */

let payload: Payload
let communes: number[] = []
let organisation: number
let agent: Record<string, unknown>
let operateur: Record<string, unknown>
let adminA: Record<string, unknown>
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@lignes.pdlm.invalid'
const ilYA = (ms: number) => new Date(Date.now() - ms).toISOString()
const dans = (ms: number) => new Date(Date.now() + ms).toISOString()
const req = (user: unknown) => ({ user }) as unknown as PayloadRequest
const idDeRef = (r: unknown) => (r && typeof r === 'object' ? (r as { id: number }).id : r)

/** Comme l'authentification charge `req.user`. */
const charger = async (id: unknown) => ({
  ...(await payload.findByID({ collection: 'users', id: id as number, overrideAccess: true })),
  collection: 'users',
})
const lignes = (u: Record<string, unknown>) =>
  ((u.tenants ?? []) as Array<{ tenant: unknown; roles: string[] }>).map((l) => ({
    tenant: idDeRef(l.tenant),
    roles: l.roles,
  }))

const mandater = (commune: number, data: Record<string, unknown> = {}) =>
  payload.create({
    collection: 'mandats',
    data: { organisation, commune, ...data },
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getPayloadClient()
  for (const p of ['lig-a', 'lig-b', 'lig-c', 'lig-d', 'lig-e']) {
    communes.push((await creerCommuneActive(payload, p)).id)
  }
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC Lignes', nature: 'epci', siret: '20004400000004' },
      overrideAccess: true,
    })
  ).id
  operateur = await payload.create({
    collection: 'users',
    data: { email: `op${DOMAINE}`, password: MDP_TEST, role: 'operateur' },
    overrideAccess: true,
  })
  adminA = await payload.create({
    collection: 'users',
    data: { email: `admin-a${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communes[0], roles: ['admin'] }] },
    overrideAccess: true,
  })
  // Agent d'une ville qui agit pour ses voisines : rédacteur réel de E.
  agent = await payload.create({
    collection: 'users',
    data: {
      email: `agent${DOMAINE}`,
      password: MDP_TEST,
      organisation,
      tenants: [{ tenant: communes[4], roles: ['redacteur'] }],
    },
    overrideAccess: true,
  })
  await mandater(communes[0]) // A : actif
  await mandater(communes[1], { dateDebut: ilYA(86_400_000), dateFin: ilYA(1000) }) // B : échu
  await mandater(communes[2], { dateDebut: dans(86_400_000) }) // C : futur
  await mandater(communes[4]) // E : rôle réel déjà présent (D6)
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    for (const c of communes) await supprimerCommuneTest(payload, c)
  } catch {
    // base jetable
  }
})

describe('lignes mandataire', () => {
  it('mandat actif : une ligne mandataire', async () => {
    expect(lignes(await charger(agent.id))).toContainEqual({ tenant: communes[0], roles: ['mandataire'] })
  })

  it('mandat échu : aucune ligne', async () => {
    expect(lignes(await charger(agent.id)).map((l) => l.tenant)).not.toContain(communes[1])
  })

  it('mandat futur : aucune ligne', async () => {
    expect(lignes(await charger(agent.id)).map((l) => l.tenant)).not.toContain(communes[2])
  })

  it('rôle réel + mandat sur une autre commune : les deux, le rôle réel intact (D6)', async () => {
    const l = lignes(await charger(agent.id))
    expect(l.filter((x) => x.tenant === communes[4])).toEqual([{ tenant: communes[4], roles: ['redacteur'] }])
    expect(l.map((x) => x.tenant)).toContain(communes[0])
  })

  it('compte sans organisation : inchangé', async () => {
    expect(lignes(await charger(adminA.id))).toEqual([{ tenant: communes[0], roles: ['admin'] }])
  })

  it('lignes mandataire jamais écrites (enregistrement par l’opérateur depuis l’admin)', async () => {
    const affiche = await charger(agent.id)
    await payload.update({
      collection: 'users',
      id: agent.id as number,
      data: { name: 'Agent renommé', tenants: affiche.tenants },
      req: req(operateur),
      overrideAccess: false,
    })
    // Lecture brute de la base, sans hook : seule la ligne réelle existe.
    const brut = await payload.db.findOne({
      collection: 'users',
      where: { id: { equals: agent.id } },
    })
    expect(lignes(brut as Record<string, unknown>)).toEqual([{ tenant: communes[4], roles: ['redacteur'] }])
  })

  it('D3 : le mandataire ne lit pas les comptes de la commune mandante, mais lit le sien', async () => {
    const moi = await charger(agent.id)
    const res = await payload.find({ collection: 'users', req: req(moi), overrideAccess: false })
    const emails = res.docs.map((u) => u.email)
    expect(emails).toContain(`agent${DOMAINE}`)
    expect(emails).not.toContain(`admin-a${DOMAINE}`)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/lignes-mandat.int.spec.ts`
Expected: FAIL sur « mandat actif : une ligne mandataire » (aucune ligne calculée) et sur D3.

- [ ] **Step 3: Implement**

`src/hooks/lignesMandat.ts` :

```ts
import type { CollectionAfterReadHook, CollectionBeforeChangeHook } from 'payload'

import { idDe } from '../access/roles'
import { whereMandatsActifs } from './mandats'

type Ligne = { tenant?: unknown; roles?: string[] | null } | null

/**
 * I36 — les utilisateurs d'une organisation mandataire héritent du rôle
 * `mandataire` sur chaque commune qui l'a mandatée. `req.user` est chargé par
 * `findByID` à chaque requête authentifiée (stratégie JWT) : la ligne apparaît
 * et disparaît avec le mandat, sans rien stocker. Le plugin multi-tenant et
 * `communesAvecRole` la lisent comme un rôle par commune ordinaire.
 * D6 : une commune où le compte a déjà un rôle réel ne reçoit pas de ligne.
 */
export const ajouterLignesMandat: CollectionAfterReadHook = async ({ doc, req }) => {
  const organisation = idDe(doc.organisation)
  if (organisation === undefined) return doc
  const { docs } = await req.payload.find({
    collection: 'mandats',
    where: { and: [{ organisation: { equals: organisation } }, whereMandatsActifs(new Date())] },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const reelles = ((doc.tenants ?? []) as Ligne[]).filter(Boolean)
  const dejaLa = new Set(reelles.map((l) => String(idDe(l!.tenant))))
  const ajouts: Ligne[] = []
  for (const mandat of docs) {
    const commune = idDe(mandat.commune)
    if (commune === undefined || dejaLa.has(String(commune))) continue
    dejaLa.add(String(commune))
    ajouts.push({ tenant: commune, roles: ['mandataire'] })
  }
  return ajouts.length > 0 ? { ...doc, tenants: [...reelles, ...ajouts] } : doc
}

/**
 * Les lignes `mandataire` ne sont jamais écrites : le formulaire de l'admin
 * renvoie celles qu'il a affichées. Hook de collection `beforeChange` : il
 * tourne avant la validation des champs (operations/utilities/update.js).
 * Dernier de la liste, après `figerPrivileges` qui peut recopier `tenants`.
 */
export const retirerLignesMandat: CollectionBeforeChangeHook = ({ data }) => {
  const lignes = (data as { tenants?: Ligne[] }).tenants
  if (!Array.isArray(lignes)) return data
  ;(data as { tenants?: Ligne[] }).tenants = lignes
    .filter((l): l is NonNullable<Ligne> => Boolean(l))
    .flatMap((l) => {
      const roles = l.roles ?? []
      if (!roles.includes('mandataire')) return [l]
      const reels = roles.filter((r) => r !== 'mandataire')
      return reels.length > 0 ? [{ ...l, roles: reels }] : []
    })
  return data
}
```

`src/collections/Users.ts` :

- importer `communesAvecRole` depuis `../access/roles` et `ajouterLignesMandat`, `retirerLignesMandat` depuis `../hooks/lignesMandat` ;
- `hooks.beforeChange: [figerPrivileges, retirerLignesMandat]` ;
- `hooks.afterRead: [ajouterLignesMandat]` ;
- remplacer l'accès en lecture :

```ts
    // D3 : un compte ne lit que lui-même et les comptes des communes où il a
    // un rôle réel. Les lignes `mandataire` n'en ouvrent aucun : un EPCI ne
    // voit pas les agents des mairies qu'il sert (données personnelles).
    // Le plugin y ajoute son propre filtre par commune (ET logique).
    read: ({ req }) => {
      if (isOperateur(req.user)) return true
      if (!req.user) return false
      const ids = communesAvecRole(req.user, 'admin', 'redacteur')
      return ids.length > 0
        ? { or: [{ id: { equals: req.user.id } }, { 'tenants.tenant': { in: ids } }] }
        : { id: { equals: req.user.id } }
    },
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config ./vitest.config.mts tests/int/lignes-mandat.int.spec.ts tests/int/isolation.int.spec.ts tests/int/users-suppression.int.spec.ts && npm run typecheck`
Expected: PASS — l'isolation existante ne bouge pas (rôles réels inchangés).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/lignesMandat.ts src/collections/Users.ts tests/int/lignes-mandat.int.spec.ts
git commit -m "Conformité RPNT — rôle mandataire hérité des mandats actifs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Matrice I36 — le mandataire agit, la commune décide

**Files:**
- Test: `tests/int/mandataire-i36.int.spec.ts`
- Modify (seulement si un test échoue) : la fonction d'accès ou le hook que le test désigne.

**Interfaces:**
- Consumes: tout ce qui précède. Ne produit rien de nouveau : cette tâche prouve les sept lignes de la spec (section 8, « Il ne peut pas » et « Le mandataire peut ») de bout en bout, avec le filtre du plugin actif (`collection: 'users'`).

- [ ] **Step 1: Write the test**

`tests/int/mandataire-i36.int.spec.ts` :

```ts
import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

/** I36 — matrice de la spec RPNT section 8, avec le filtre du plugin actif. */

let payload: Payload
let communeA: number
let communeC: number
let organisation: number
let mandatA: number
let agentId: number
let adminA: Record<string, unknown>
let pageA: number
const MDP_TEST = ['motdepasse', '1234'].join('-')
const DOMAINE = '@i36.pdlm.invalid'
const req = (user: unknown) => ({ user, context: {} }) as unknown as PayloadRequest
const charger = async (id: number) => ({
  ...(await payload.findByID({ collection: 'users', id, overrideAccess: true })),
  collection: 'users',
})
const contenuVide = {
  root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
}
const page = (titre: string, tenant: number): any => ({
  titre,
  tenant,
  blocs: [{ blockType: 'texteRiche', contenu: contenuVide }],
})

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'i36-a')).id
  communeC = (await creerCommuneActive(payload, 'i36-c')).id
  organisation = (
    await payload.create({
      collection: 'organisations',
      data: { nom: 'CC I36', nature: 'epci', siret: '20002200000000' },
      overrideAccess: true,
    })
  ).id
  adminA = await payload.create({
    collection: 'users',
    data: { email: `admin-a${DOMAINE}`, password: MDP_TEST, tenants: [{ tenant: communeA, roles: ['admin'] }] },
    overrideAccess: true,
  })
  agentId = (
    await payload.create({
      collection: 'users',
      data: { email: `agent${DOMAINE}`, password: MDP_TEST, organisation },
      overrideAccess: true,
    })
  ).id
  mandatA = (
    await payload.create({
      collection: 'mandats',
      data: { organisation, commune: communeA },
      overrideAccess: true,
    })
  ).id
  pageA = (
    await payload.create({ collection: 'pages', data: page('Page A', communeA), overrideAccess: true })
  ).id
})

afterAll(async () => {
  try {
    await payload.delete({ collection: 'pages', where: { tenant: { in: [communeA, communeC] } }, overrideAccess: true })
    await payload.delete({ collection: 'mandats', where: { organisation: { equals: organisation } }, overrideAccess: true })
    await payload.delete({ collection: 'users', where: { email: { like: DOMAINE } }, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
    await supprimerCommuneTest(payload, communeA)
    await supprimerCommuneTest(payload, communeC)
  } catch {
    // base jetable
  }
})

describe('le mandataire peut', () => {
  it('voir la commune mandante, et elle seule', async () => {
    const res = await payload.find({ collection: 'communes', req: req(await charger(agentId)), overrideAccess: false })
    expect(res.docs.map((c) => c.id)).toEqual([communeA])
  })

  it('créer et publier une page sur la commune mandante', async () => {
    const p = await payload.create({
      collection: 'pages',
      data: { ...page('Publiée par le mandataire', communeA), _status: 'published' },
      req: req(await charger(agentId)),
      overrideAccess: false,
    })
    expect(p._status).toBe('published')
  })

  it('ne lister que les pages de la commune mandante', async () => {
    const res = await payload.find({ collection: 'pages', req: req(await charger(agentId)), overrideAccess: false })
    const tenants = res.docs.map((d) => (typeof d.tenant === 'object' ? (d.tenant as { id: number }).id : d.tenant))
    expect(new Set(tenants)).toEqual(new Set([communeA]))
  })
})

describe('le mandataire ne peut pas (I36)', () => {
  it('écrire sur une commune qui ne l’a pas mandaté', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: page('Intrus', communeC),
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('D1 : supprimer une page', async () => {
    await expect(
      payload.delete({ collection: 'pages', id: pageA, req: req(await charger(agentId)), overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('activer ou désactiver la commune, ni toucher à la mesure d’audience', async () => {
    for (const data of [{ actif: false }, { mesure: { active: true } }, { coordonnees: { telephone: '0102030405' } }]) {
      await expect(
        payload.update({
          collection: 'communes',
          id: communeA,
          data,
          req: req(await charger(agentId)),
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    }
  })

  it('changer le domaine canonique', async () => {
    await expect(
      payload.create({
        collection: 'domaines',
        data: { hostname: `autre-${Date.now()}.test`, commune: communeA, canonique: false },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('gérer les utilisateurs de la commune', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: adminA.id as number,
        data: { name: 'Renommé par le mandataire' },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('accorder un mandat, même sur la commune qu’il sert', async () => {
    await expect(
      payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})

describe('retrait', () => {
  it('retrait : accès coupé à la requête suivante, trace au journal', async () => {
    await payload.update({
      collection: 'mandats',
      id: mandatA,
      data: { dateFin: new Date(Date.now() - 1000).toISOString() },
      req: req(adminA),
      overrideAccess: false,
    })
    await expect(
      payload.create({
        collection: 'pages',
        data: page('Après retrait', communeA),
        req: req(await charger(agentId)),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const journal = await payload.count({
      collection: 'journal',
      where: { and: [{ type: { equals: 'mandat' } }, { message: { like: 'Mandat retiré — CC I36' } }] },
      overrideAccess: true,
    })
    expect(journal.totalDocs).toBe(1)
  })
})
```

Avant de lancer : vérifier la forme minimale d'une page dans `tests/int/isolation.int.spec.ts` (`pageMin`) et dans `src/collections/Pages.ts` ; si le bloc s'appelle autrement que `texteRiche` ou si un champ requis manque, aligner `page()` sur `pageMin`.

- [ ] **Step 2: Run the test**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mandataire-i36.int.spec.ts`
Expected: PASS. Si un test échoue, c'est un trou d'accès réel : corriger la fonction d'accès ou le hook concerné (jamais le test), relancer, et nommer le trou dans le message de commit.

- [ ] **Step 3: Run the whole suite**

Run: `npm run test:unit && npm run test:int && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/int/mandataire-i36.int.spec.ts
git commit -m "Conformité RPNT — preuve I36 : le mandataire agit, la commune décide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(Ajouter au `git add` tout fichier source corrigé à l'étape 2.)

---

### Task 6: Migration, types, compte de démonstration, connexion réelle

**Files:**
- Generated: `src/migrations/<horodatage>_mandats.ts` + `.json`, `src/migrations/index.ts`, `src/payload-types.ts`
- Modify: `src/seed/index.ts`
- Test: `tests/e2e/mandataire.e2e.spec.ts`

**Interfaces:**
- Consumes: collections `organisations`, `mandats`, champ `users.organisation`, type de journal `mandat`, option de rôle `mandataire`.
- Produces: compte de démonstration `mandataire@cc-val.fr` (mot de passe `MOT_DE_PASSE_DEMO`), organisation « Communauté de communes du Val (démo) », mandat actif sur Saint-Exupéry-les-Bains.

- [ ] **Step 1: Generate migration and types**

```bash
npm run payload migrate:create mandats
npm run generate:types
```

Vérifier le SQL généré (`src/migrations/*_mandats.ts`). Il doit contenir, et rien d'autre :
- `CREATE TYPE "public"."enum_organisations_nature"` (5 valeurs) et la table `organisations` (`nom`, `nature`, `siret` unique) ;
- la table `mandats` (`organisation_id`, `commune_id`, `date_debut`, `date_fin`, `accorde_par_id`) avec leurs clés étrangères et index ;
- `ALTER TABLE "users" ADD COLUMN "organisation_id"` + clé étrangère ;
- `ALTER TYPE "public"."enum_users_tenants_roles" ADD VALUE 'mandataire'` ;
- `ALTER TYPE "public"."enum_journal_type" ADD VALUE 'mandat'` ;
- les colonnes `organisations_id` et `mandats_id` de `payload_locked_documents_rels`.

S'il touche à une autre table, s'arrêter et le signaler. Puis :

```bash
npm run payload migrate
npm run typecheck
```

Expected: migration appliquée ; typecheck sans erreur.

- [ ] **Step 2: Seed — compte de démonstration**

Dans `src/seed/index.ts`, élargir le type de `upsertUser` (`organisation?: number`) et, après la création de `redacteur@saint-ex.fr` :

```ts
  // Spec RPNT section 8 : une intercommunalité qui agit pour Saint-Exupéry.
  const ccVal =
    (
      await payload.find({
        collection: 'organisations',
        where: { siret: { equals: '20002200000000' } },
        limit: 1,
        overrideAccess: true,
      })
    ).docs[0] ??
    (await payload.create({
      collection: 'organisations',
      data: { nom: 'Communauté de communes du Val (démo)', nature: 'epci', siret: '20002200000000' },
      overrideAccess: true,
    }))
  await upsertUser(payload, {
    email: 'mandataire@cc-val.fr',
    name: 'Agent CC du Val',
    password: MOT_DE_PASSE_DEMO,
    organisation: ccVal.id,
  })
  const { totalDocs: mandatsSaintEx } = await payload.count({
    collection: 'mandats',
    where: { and: [{ organisation: { equals: ccVal.id } }, { commune: { equals: saintEx.id } }] },
    overrideAccess: true,
  })
  if (mandatsSaintEx === 0) {
    await payload.create({
      collection: 'mandats',
      data: { organisation: ccVal.id, commune: saintEx.id },
      overrideAccess: true,
    })
  }
```

Ajouter `mandataire@cc-val.fr` à la ligne « Comptes démo » du `console.log` final.

- [ ] **Step 3: Write the e2e test**

`tests/e2e/mandataire.e2e.spec.ts` :

```ts
import { expect, test } from '@playwright/test'

import { connecterAdmin } from '../helpers/login'

/**
 * Connexion réelle d'un mandataire (compte semé par `npm run seed`) : prouve
 * que la stratégie d'authentification charge bien les lignes calculées
 * (hooks/lignesMandat.ts) et que le plugin les applique.
 */
const MANDATAIRE = { email: 'mandataire@cc-val.fr', motDePasse: 'demo1234' }

test.describe('Admin Payload — mandataire', () => {
  test.beforeEach(async ({ page }) => {
    await connecterAdmin(page, MANDATAIRE)
  })

  test('voit la commune mandante et pas les autres', async ({ page }) => {
    await page.goto('/admin/collections/communes')
    const tableau = page.locator('table')
    await expect(tableau.getByRole('link', { name: 'Saint-Exupéry-les-Bains' })).toBeVisible()
    await expect(tableau.getByRole('link', { name: 'Valvert' })).toHaveCount(0)
  })

  test('ne voit que son propre compte (D3)', async ({ page }) => {
    await page.goto('/admin/collections/users')
    const tableau = page.locator('table')
    await expect(tableau.getByText(MANDATAIRE.email, { exact: true })).toBeVisible()
    await expect(tableau.getByText('admin@saint-ex.fr', { exact: true })).toHaveCount(0)
  })

  test('ouvre le formulaire de création de page', async ({ page }) => {
    await page.goto('/admin/collections/pages/create')
    await expect(page.locator('#field-titre')).toBeVisible()
  })
})
```

- [ ] **Step 4: Run e2e and the whole suite**

```bash
npm run seed
npm run test
```

Expected: PASS (unitaires, intégration, e2e).

- [ ] **Step 5: Commit**

```bash
git status --short   # vérifier que payload-types.ts et la migration diffèrent par du contenu, pas par la mise en forme
git add src/migrations/ src/payload-types.ts src/seed/index.ts tests/e2e/mandataire.e2e.spec.ts
git commit -m "Conformité RPNT — migration des mandats, compte de démonstration, connexion réelle

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Lots suivants (un plan chacun, après la fusion de ce lot)

Ordre imposé par la spec (« à planifier **avant** les sections 3 à 6, qui en dépendent ») puis par les dépendances de données :

1. **Lot 2 — Code INSEE et nom de domaine** (sections 1 et 2, I35) : champ `codeInsee`, générateur de nomenclature, signalement non bloquant. Indépendant des mandats.
2. **Lot 3 — État de l'État** (section 4, second paragraphe ; section 3) : téléchargement de `dpnt-quotidien.csv.gz`, rapprochement INSEE (test sur le fichier réel du 01/10), carte « Déclarer votre site » visible par l'admin, les mandataires et l'opérateur, relance à 7 jours, I32.
3. **Lot 4 — Mesure pdlm, tableau, alertes** (sections 4 à 6, I33) : tâche quotidienne de surveillance (depuis l'extérieur de la plateforme), tableau source + date, alertes vers admin + mandataires actifs + opérateur. Demande de trancher le **canal de notification** (aucun envoi de courriel n'existe dans le dépôt au 01/10).
4. **Lot 5 — Messagerie** (section 7) : requêtes DNS publiques, liens relus au moment de l'implémentation.
5. **Lot 6 — Titulaire du nom** (section 9, I34, I37) : RDAP, alertes d'expiration, **liste de vérification de fin de mandat** (s'appuie sur le retrait de ce lot). ⚠️ Lire les textes (charte Afnic, politiques `.bzh`/`.corsica`, art. L45-2 CPCE) avant toute aide en ligne ; accord de l'utilisateur avant toute exploitation des titulaires `.corsica` hors de pdlm.

## Self-review (faite à l'écriture)

- **Couverture section 8** : objet mandat (organisation nom/nature/SIRET, commune, dates, auteur) → tâches 2-3 ; héritage du rôle par les utilisateurs de l'organisation → tâche 4 ; « peut » / « ne peut pas » → tâches 1 et 5 ; accorder/retirer par admin ou opérateur + journal → tâche 3 ; cas couverts (EPCI opérateur sans mandat, ville qui agit pour ses voisines) → tâche 4 (« rôle réel + mandat ») ; destinataires des alertes → lot 4 (aucune alerte dans ce lot). Test de spec « un mandat retiré coupe l'accès immédiatement et laisse une trace » → tâche 5.
- **Noms** : `creerPublication`/`majPublication`, `ROLES_REDACTION`/`ROLES_PUBLICATION`, `whereMandatsActifs`, `ajouterLignesMandat`/`retirerLignesMandat` — mêmes noms dans toutes les tâches.
- **Hors de ce lot, assumé** : l'interface de l'admin pour le mandat est celle de Payload par défaut (liste et formulaire de la collection `mandats`) ; pas d'onglet « Mandats » sur la fiche commune.
