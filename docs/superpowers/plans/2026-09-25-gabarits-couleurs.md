# Gabarits, frise et couleurs étendues — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au site public de chaque commune un gabarit composé (Village, Littoral), une frise du territoire et des couleurs réglables à partir de 3 choix, lisibles quoi qu'on choisisse.

**Architecture:** Un module pur `src/lib/couleurs.ts` dérive toutes les variables CSS de 3 couleurs (OKLCH, garanties de contraste testées par propriété). Un gabarit est un dossier `src/gabarits/<nom>/` (données, `theme.css`, kit de frise, illustrations) qui compose l'accueil à partir de sections communes ; un contrat versionné et une suite de conformité commune rendent un gabarit tiers recevable. L'admin gagne un onglet « Apparence » avec un aperçu servi sous le domaine de l'admin.

**Tech Stack:** Next.js 16.3.3 (App Router, `proxy.ts`), Payload 3.90.1 (Postgres, plugin multi-tenant), React 19.2.6, Vitest 4.1.11, Playwright 1.58.2 ; ajouts : `fast-check` 4.10.2 (MIT), `@axe-core/playwright` (tâche 10).

**Spec:** `docs/superpowers/specs/2026-09-25-gabarits-couleurs-design.md` (sections 1-6, invariants I23-I31). Maquettes validées (hors dépôt, non versionnées) : `~/Projects/glm/docs/recherche/2026-09-25_front-beau/G-maquette-v2/` (Village) et `J-maquette-littoral/` (Littoral v2, dont `couleurs.py`).

---

## État d'exécution — à lire avant toute tâche

**Mis à jour le 04/10/2026 : la porte de déblocage est OUVERTE.** L'état « bloqué » décrit ici jusqu'au 03/10 est périmé.

| Tâche | Étape spec § 5 | Statut | Où |
|---|---|---|---|
| 1 — `couleurs.ts` + tests | 1 | **faite et relue** (25/09), verte après rebase (04/10) | branche `gabarits-couleurs`, worktree `~/Projects/glm.gabarits` |
| Porte de déblocage | — | **ouverte le 04/10** | `main` = `56d20a2` |
| 2 à 10 | 2 à 6 | **à faire, dans l'ordre**, une tâche à la fois | idem |

**Ce que `main` contient depuis le 04/10** (`56d20a2`) : la mesure d'audience, le **socle multilingue** (`src/i18n/`, routes `(frontend)/[lang]/`, `src/lib/champs-langue.ts`, `src/lib/langues.ts`) et les **mandats** (collections `organisations` et `mandats`, rôle `mandataire`, `src/hooks/verifierCommuneCreation.ts`). `gabarits-couleurs` est rebasée dessus (9 commits).

**État mesuré du worktree le 04/10, après rebase** : `typecheck` 0 erreur · `test:unit` 152/152 · `test:int` 193/193 · 6 migrations jouées sur base vierge, puis `migrate:create` répond « No schema changes detected ».

**Environnement du worktree** : `.env` posé le 04/10 (non versionné), bases dédiées `pdlm_gabarits_dev` (migrée et semée, sert à `npm run dev` et aux tests de bout en bout) et `pdlm_test_gabarits` (tests d'intégration). Démarrer les services : `docker compose -f docker-compose.dev.yml up -d postgres minio createbuckets`.
- ⚠️ **Après toute modification du schéma, le premier `npm run test:int` peut échouer** sur `CREATE TABLE … already exists` ou `CREATE TYPE … already exists` : plusieurs fichiers de test poussent le schéma en même temps. Ce n'est pas un défaut du code : relancer une fois. Un échec qui survit à la relance est réel.
- ⚠️ **`npm run lint` affiche 2 erreurs dans `.superpowers/`** (fichiers de sonde du 25/09, non versionnés). Elles ne sont pas à corriger. Le critère est : 0 erreur dans `src/` et `tests/`.
- ⛔ **Ne rien faire dans `~/Projects/glm`, `~/Projects/glm.conformite`, `~/Projects/glm.multilingue`** : autres checkouts. ⛔ Ne jamais pointer `DATABASE_URI` sur la base `pdlm` (base de démonstration).

**Chaque tâche commence par l'étape « re-vérifier les ancres »** : les fichiers et lignes cités ont été relevés le 25/09, avant le multilingue et les mandats. Une ancre qui a seulement changé de place se corrige dans la tâche (un commit sur le plan), puis on code. Une ancre dont le changement **remet en cause une décision** du plan : on s'arrête, voir « Porte bloqué » du brief.

## Global Constraints

- Français pour noms de champs, fonctions métier, messages et commentaires ; anglais pour les termes du framework (`CONTRIBUTING.md`).
- Un commentaire au-dessus d'une règle non évidente cite l'invariant protégé (`// I25 : …`).
- Avant d'écrire du code Next : lire le guide concerné dans `node_modules/next/dist/docs/` (`AGENTS.md`).
- TDD : le test qui échoue est écrit et exécuté **avant** le code.
- `src/payload-types.ts` et `src/app/(payload)/admin/importMap.js` sont générés (`npm run generate:types`, `npm run generate:importmap`), jamais reformatés à la main.
- Format couleur admis partout : `^#[0-9a-fA-F]{6}$` (I24) ; rien d'autre n'est refusé.
- Aucune couleur de l'État : ni `#000091`, ni `#e1000f`, ni Marianne (`tests/unit/identite-etat.spec.ts` scanne `src/`).
- Défauts : principale `#264653`, accent `#e2a72e`, terre `#b36b00`.
- Un gabarit n'ajoute ni script ni ressource tierce ; polices auto-hébergées ; SVG intégré au HTML (I27).
- Vérification avant tout « fini » : `npm run lint`, `npm run typecheck`, `npm run test:unit`, et selon la tâche `test:int` / `test:e2e` — sortie réelle collée, pas une paraphrase.

## Décisions tranchées dans ce plan (aucune tâche ne les rouvre)

Écrites ici pour qu'aucun exécutant ne les re-décide dans son coin.

1. **Pas de `culori`.** La spec (§ 2) le nomme ; ce plan porte à la place les conversions d'Ottosson du prototype `couleurs.py`, ligne à ligne. Motif : le résultat « 0 échec sur 3 000 tirages » a été obtenu avec cet algorithme de réduction de saturation (×0,93 jusqu'au gamut) ; la réduction de gamut de `culori` est un autre algorithme, le résultat ne se transférerait pas, et le module reste sans dépendance d'exécution. **Écart à la spec, validé par l'utilisateur le 25/09.**
2. **`--pale` à L = 0,965**, valeur du prototype validé à l'œil (la spec écrit 0,96). **Écart validé le 25/09.**
3. **Un gris reste un gris.** Le prototype rendait `#777777` → `#777676` (teinte parasite d'arrondi) ; `couleurs.ts` rend `#767676`. Seul écart volontaire au prototype.
4. **Variables produites = liste du contrat, rien d'autre** : `--principale-sure`, `--pale`, `--profond`, `--encre`, `--accent`, `--accent-sur-profond`, `--texte-sur-accent`, `--terre-sure`, `--picto-1`…`6`. Le prototype sortait aussi `--principale`, `--principale-fonce`, `--terre` : abandonnées ; `theme.css` de Village emploie `--principale-fonce`, remplacée par `--profond` au portage (tâche 5).
5. **`--alerte`, `--alerte-texte`, `--focus` sont fixes et vivent dans `styles.css` (`:root`)**, pas dans `deriver()`.
6. **Couleurs forcées** : `texte` remplace `--principale-sure`, `pale` → `--pale`, `profond` → `--profond`, `pictoN` → `--picto-N`. Les pictos non forcés dérivent des valeurs **dérivées** (pas des forcées). `--accent-sur-profond` se recalcule contre le profond **réellement servi** (forcé ou non). Une forcée hors format est ignorée.
7. **Message d'avertissement de contraste** : `« <Rôle> : 2,32:1, illisible »`, contraste **tronqué** à 2 décimales (jamais arrondi vers le haut : 4,499 s'affiche 4,49, pas 4,50).
8. **Harmonie** : distance euclidienne OKLab < 0,08 entre deux couleurs **saisies** → `« L’accent se confond avec la principale »`.
9. **`accords(principale)`** : 5 propositions à L = 0,78, chroma bornée [0,10 ; 0,16], teintes +30°, +120°, +150°, +180°, +210°.
10. **Préremplissage de `accueil`** par `defaultValue` des champs `array` (et non par un hook `beforeChange`) : même effet à la création, sans code d'accès aux données. Les communes existantes : par la migration (tâche 2).
11. **Onglet « Apparence » = onglet Payload non nommé** (`type: 'tabs'`, onglet sans `name`) : la forme des données (`apparence`, `accueil` à la racine) ne change pas.
12. **I4 sur les nouvelles relations** : `validerRelationsTenant` n'accepte qu'un `champMedia` par appel ; on pose **un hook par champ** (`apparence.photoAccueil`, `accueil.mosaique`), à côté de celui du logo.
13. **Ajout à la spec, défense en profondeur** : `proxy.ts` répond 404 à `/apercu/*` hors du domaine de la plateforme, comme il le fait déjà pour `/api/*`. I28 reste la garantie ; ceci retire la route des domaines communaux. **Ajout validé le 25/09.**

14. **Textes de l'accueil et langues (ajout du 04/10, précisé le même jour après la relecture de la tâche 2).** Sont traduisibles (`localized: true`) : `accueil.demarches[].titre` et `accueil.mosaique[].libelle`, avec `validate: requisEnFrancais` (comme `Communes.nom`), et `accueil.demarches[].precision`, facultatif dans toutes les langues. **Ce que la règle R4 protège hors du français : la structure des listes, c'est-à-dire les mêmes lignes dans le même ordre** (ajout, retrait, réordonnancement refusés) — même portée que `structureEnFrancais` dans `src/collections/Menus.ts`. Les champs non traduits d'une ligne (`picto`, `lien`, `illustration`, `photo`) sont communs à toutes les langues : les modifier depuis une autre langue modifie le site entier, comme `page` et `url` d'un élément de menu ; le hook ne les compare pas. Les valeurs par défaut et la migration écrivent le français. Aucun autre champ d'`apparence` n'est traduit (couleurs, gabarit, frise, photo). **Une migration est figée** : elle porte ses valeurs de préremplissage en littéraux, elle n'importe rien de `src/lib/`.
15. **Mandataire et apparence (rappel, décision D2 du plan des mandats).** Le mandataire ne modifie pas la fiche commune, donc ni l'apparence ni l'accueil. L'accès `update` de `Communes` n'est **pas** modifié par ce plan : opérateur et admin de la commune, comme aujourd'hui ; `gabarit` et `frise` restent à l'opérateur seul.

16. **Historique des versions d'une commune : accès posé après le plugin (ajout du 04/10, suite au blocage B10 de la tâche 2).** Constat mesuré : `@payloadcms/plugin-multi-tenant` enveloppe `readVersions` de la collection des communes avec la contrainte `version.id in [communes de l'utilisateur]`, qui ne désigne pas la commune parente ; un admin de commune lit donc 0 version de sa commune. Le plugin **combine par ET** l'accès de la collection et sa propre contrainte (`withTenantAccess.js`), et n'offre aucun `accessResultOverride` pour la collection des communes (`index.js`, bloc « Modify tenants collection ») : poser `access.readVersions` dans `Communes.ts` **ne suffit pas**. Décision : un petit plugin local, placé **après** `multiTenantPlugin` dans `plugins` de `src/payload.config.ts`, remplace `access.readVersions` de la collection `communes` par : opérateur → `true` ; sinon les communes où l'utilisateur a le rôle `admin` (`communesAvecRole(req.user, 'admin')`) → `{ parent: { in: ids } }` ; sinon `false`. Même grain que l'accès `update` : ni le rédacteur ni le mandataire (D2) ne lisent l'historique. `useTenantsCollectionAccess` n'est **pas** désactivé : les autres accès enveloppés par le plugin (`read`, `update`, `delete`) restent tels quels.

17. **Quelle couleur de texte sur quel fond (ajout du 05/10, suite à la relecture de la tâche 3).** La spec § 2 garantit `--principale-sure` à ≥ 4,5:1 **sur le blanc**, et `--encre` à ≥ 4,5:1 **sur `--pale`** ; elle ne garantit pas `--principale-sure` sur `--pale`. Mesuré le 05/10 sur 3 000 couleurs tirées au hasard (graine fixe) : `--principale-sure` sur `--pale` passe sous 4,5:1 dans **69,6 %** des cas (minimum 4,02:1) ; `--encre` sur `--pale` : 0 cas, minimum 14,76:1 ; les couleurs par défaut tiennent (9,17:1). Règle d'emploi, pour `styles.css` aujourd'hui et pour le contrat des gabarits (tâche 4) : **sur un fond `--pale` (alias `--couleur-fond-alt`), le texte, les titres et les liens sont en `--encre`** (lien souligné) ; `--principale-sure` (alias `--couleur-principale`) ne sert de couleur de texte que sur fond blanc, et de fond que sous du texte blanc. `deriver()`, la spec et ses cas nommés ne changent pas. La suite de conformité de la tâche 4 mesure cette paire dans la page rendue.

18. **Tâche 4 : un seul gabarit dans le registre, provisoire (ajout du 05/10).** À la tâche 4, `GABARITS` ne contient que `village`, en version minimale (sections seules, sans `theme.css` propre, kit et illustrations réduits au strict nécessaire pour que la suite de conformité tourne). `gabaritDe()` replie sur `village` toute autre valeur, **y compris `littoral`**, que le champ `apparence.gabarit` accepte déjà : Littoral n'entre au registre qu'à la tâche 8. La suite de conformité est paramétrée par `Object.keys(GABARITS)` dès maintenant, pour que Village (tâche 5) et Littoral (tâche 8) y passent sans la modifier. Les points de la suite qui lisent `theme.css` ou `polices/` (3 et 8) sont écrits et **passent à vide** tant que le gabarit provisoire n'a ni l'un ni l'autre : le dire dans le test par un commentaire, ne pas les sauter par `skip`. Textes corses des nouvelles clés d'interface : proposés par l'exécutant, **marqués « à faire relire »** dans les notes, jamais présentés comme validés.

## Questions tranchées par l'utilisateur le 25/09 (ex-questions ouvertes)

- **Q1 — Illustrations Village inexistantes (tâche 5).** `G-maquette-v2/frise.py` n'a ni tailles (`petite|moyenne|grande`), ni scènes, ni héros illustré : sa composition est codée en dur (`composer()`, positions au pixel). Les 7 scènes de Village et son héros illustré sont **à dessiner**, pas à porter. Proposition : les dessiner sur le modèle de `frise_littoral.py` (`_scene`, `SCENES`) et les faire valider en capture avant fusion.
  **→ Tranché 25/09 : modèle Littoral, captures validées par Matthieu avant fusion. Reconfirmé après avoir vu les captures (Village photo, Littoral photo, Littoral illustré) : Village reçoit une version illustrée complète (héros + 7 scènes), dans le trait de sa silhouette ; elle ne sert que quand une photo manque (I30).**
- **Q2 — Scènes manquantes dans les deux kits (tâches 5, 8).** La spec liste 7 scènes (`sentiers`, `patrimoine`, `commerces`, `associations`, `ecole`, `mer`, `nature`) ; `frise_littoral.py` n'en a que 4 (`SCENES`, l. 140-145). `ecole`, `mer`, `nature` sont à dessiner pour les deux kits.
  **→ Tranché 25/09 : les 3 scènes sont dessinées pour les deux kits (7 scènes chacun), captures validées par Matthieu.**
- **Q3 — Ornements propres à un gabarit (tâche 4, contrat).** Littoral emploie `mer()`, `maree()`, `courbe_marees()`, `sable()` en plus de `horizon()` ; le contrat de la spec (§ 6) ne prévoit que `horizon()`. Proposition : le contrat autorise un export libre `ornements` dans `frise.ts`, soumis aux mêmes règles (SVG seul, couleurs par variables).
  **→ Tranché 25/09 : accepté. Le contrat v1 (`CONTRAT.md`) inclut l'export `ornements`.**

## Review Focus

Les cinq entrées que la spec implique et qu'un utilisateur rencontrera, les plus probables d'abord ; chacune a son test dans la tâche qui possède le code.

1. **Saisie hors format ou en majuscules** (`#7FC8A0`, `#fff`, vide, `red`) — attendu : majuscules acceptées à l'identique ; tout autre format vaut le défaut, jamais une erreur de rendu. → tâche 1 (« une saisie hors format vaut le défaut », « les majuscules… »).
2. **Couleur forcée illisible** (mairie qui force un gris clair pour les liens) — attendu : utilisée telle quelle, site en ligne, avertissement lisible dans l'admin, jamais un refus. → tâche 1 (« une forcée est utilisée telle quelle… »), tâche 9 (bande de contrôle).
3. **Commune qui démarre** (ni photo, ni lien, ni frise, page « accueil » absente) — attendu : aucun emplacement vide, illustrations partout, pas de section vide. → tâche 4 (suite de conformité, point 6).
4. **Changement de gabarit** avec des pièces de frise ou des scènes absentes du nouveau kit — attendu : rien de perdu en base, pièces ignorées au rendu et listées en avertissement, scène absente → `nature`. → tâches 7 et 8.
5. **URL d'aperçu trafiquée** (`principale=javascript:…`, `commune` d'une autre commune, anonyme) — attendu : 404 hors droits, paramètre invalide remplacé par la valeur en base, rien d'écrit tel quel dans le HTML. → tâche 9.

---

### Task 1: Dérivation des couleurs (`src/lib/couleurs.ts`)

**Statut : fait et relu le 25/09.**

**Files:**
- Create: `src/lib/couleurs.ts`
- Test: `tests/unit/couleurs.spec.ts`
- Modify: `package.json`, `package-lock.json` (dépendance de dev `fast-check`)

**Interfaces:**
- Consumes: rien.
- Produces (utilisé par les tâches 3, 4, 9) :
  - `type Choix = { principale?: string | null; accent?: string | null; terre?: string | null }`
  - `type CleForcee = 'texte' | 'pale' | 'profond' | 'picto1' … 'picto6'` ; `type Forcees = Partial<Record<CleForcee, string | null>>`
  - `interface Controle { role: string; couleur: string; fond: string; contraste: number; seuil: number; force: boolean }`
  - `deriver(choix: Choix, forcees?: Forcees): { variables: Record<string, string>; controles: Controle[]; avertissements: string[] }`
  - `accords(principale: string): string[]` (5 éléments)
  - `contraste(a: string, b: string): number`, `vers_oklch(h: string): [L, C, H]`
  - `DEFAUTS`, `VARIABLES_CONTRAT` (tableau `as const` des 14 noms)

- [ ] **Step 1: Ajouter la dépendance de test**

```bash
cd ~/Projects/glm.gabarits
git branch --show-current   # attendu : gabarits-couleurs
npm install
npm install --save-dev --save-exact fast-check@4.10.2
```

Si npm échoue sur `Cannot read properties of null (reading 'edgesOut')` (vu le 25/09 avec npm 10.9.2 dans un dossier vierge), relancer avec `--legacy-peer-deps` et le noter dans le message de commit.

- [ ] **Step 2: Écrire le test qui échoue**

Créer `tests/unit/couleurs.spec.ts` :

```ts
import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { accords, contraste, DEFAUTS, deriver, VARIABLES_CONTRAT } from '@/lib/couleurs'

const HEX = /^#[0-9a-f]{6}$/
const BLANC = '#ffffff'

/** Couleur valide quelconque, tirée sur tout l'espace sRGB 8 bits. */
const hexQuelconque = fc
  .integer({ min: 0, max: 0xffffff })
  .map((n) => `#${n.toString(16).padStart(6, '0')}`)

/** Écart de teinte OKLCH en degrés (plus court chemin sur le cercle). */
function ecartTeinte(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180)
}

describe('deriver — garanties (I25)', () => {
  // I25 : chaque garantie du tableau de la section 2 tient pour toute couleur
  // choisie valide. Graine fixe : un échec se rejoue à l'identique.
  it('toutes les garanties tiennent sur 3 000 tirages', () => {
    fc.assert(
      fc.property(hexQuelconque, hexQuelconque, hexQuelconque, (principale, accent, terre) => {
        const { variables: v, controles } = deriver({ principale, accent, terre })
        for (const c of controles) {
          expect(c.contraste, `${c.role} : ${c.couleur} sur ${c.fond}`).toBeGreaterThanOrEqual(
            c.seuil,
          )
        }
        // Les garanties sont recalculées ici, indépendamment de `controles` :
        // une ligne oubliée dans `controles` ne doit pas masquer un échec.
        expect(contraste(v['--principale-sure'], BLANC)).toBeGreaterThanOrEqual(4.5)
        expect(contraste(v['--encre'], v['--pale'])).toBeGreaterThanOrEqual(4.5)
        expect(contraste(BLANC, v['--profond'])).toBeGreaterThanOrEqual(7)
        expect(contraste(v['--accent-sur-profond'], v['--profond'])).toBeGreaterThanOrEqual(3)
        expect(contraste(v['--texte-sur-accent'], v['--accent'])).toBeGreaterThanOrEqual(4.5)
        expect(contraste(BLANC, v['--terre-sure'])).toBeGreaterThanOrEqual(3)
        for (let i = 1; i <= 6; i++) {
          expect(contraste(BLANC, v[`--picto-${i}`])).toBeGreaterThanOrEqual(3)
        }
      }),
      { seed: 25, numRuns: 3000 },
    )
  })

  it('produit exactement les variables du contrat, toutes au format #rrggbb', () => {
    fc.assert(
      fc.property(hexQuelconque, hexQuelconque, hexQuelconque, (principale, accent, terre) => {
        const { variables } = deriver({ principale, accent, terre })
        expect(Object.keys(variables).sort()).toEqual([...VARIABLES_CONTRAT].sort())
        for (const valeur of Object.values(variables)) expect(valeur).toMatch(HEX)
      }),
      { seed: 25, numRuns: 300 },
    )
  })

  it('les 4 tons de pictos ajoutés s’écartent d’au moins 30° des deux premiers', () => {
    const { variables: v } = deriver({ principale: '#2a7f9e', terre: '#d2462f' })
    const tons = [3, 4, 5, 6].map((i) => v[`--picto-${i}`])
    expect(new Set(tons).size).toBe(4)
  })
})

describe('deriver — cas nommés de la spec', () => {
  it('#2f7d5b (4,99:1) ressort inchangée', () => {
    expect(deriver({ principale: '#2f7d5b' }).variables['--principale-sure']).toBe('#2f7d5b')
  })

  it('#7fc8a0 (1,97:1) est assombrie jusqu’à 4,5:1 avec un écart de teinte < 2°', async () => {
    const { vers_oklch } = await import('@/lib/couleurs')
    const sure = deriver({ principale: '#7fc8a0' }).variables['--principale-sure']
    expect(sure).toBe('#3c8460') // valeur du prototype couleurs.py
    expect(contraste(sure, BLANC)).toBeGreaterThanOrEqual(4.5)
    expect(ecartTeinte(vers_oklch(sure)[2], vers_oklch('#7fc8a0')[2])).toBeLessThan(2)
  })

  // Écart volontaire au prototype : couleurs.py rendait #777676 (gris
  // légèrement teinté par les arrondis). Un gris saisi reste un gris.
  it('#777777 (4,48:1) est légèrement assombrie et reste grise', () => {
    expect(deriver({ principale: '#777777' }).variables['--principale-sure']).toBe('#767676')
    expect(deriver({ principale: '#ffffff' }).variables['--principale-sure']).toBe('#767676')
  })

  it('#ffff00 et #000000 donnent les valeurs du prototype', () => {
    expect(deriver({ principale: '#ffff00' }).variables['--principale-sure']).toBe('#7a7a0f')
    expect(deriver({ principale: '#000000' }).variables['--principale-sure']).toBe('#000000')
  })

  it('les défauts reproduisent la sortie du prototype couleurs.py', () => {
    expect(deriver({}).variables).toEqual({
      '--principale-sure': '#264653',
      '--profond': '#1d3d49',
      '--pale': '#e6f7fe',
      '--encre': '#0e222a',
      '--accent': '#e2a72e',
      '--accent-sur-profond': '#e2a72e',
      '--texte-sur-accent': '#000000',
      '--terre-sure': '#b36b00',
      '--picto-1': '#264653',
      '--picto-2': '#b36b00',
      '--picto-3': '#61558c',
      '--picto-4': '#87485d',
      '--picto-5': '#496a34',
      '--picto-6': '#4a5c91',
    })
  })
})

describe('deriver — saisies et défauts', () => {
  it('les défauts sont ceux de la spec', () => {
    expect(DEFAUTS).toEqual({ principale: '#264653', accent: '#e2a72e', terre: '#b36b00' })
  })

  // I24 : seul le format est validé, par le champ ; ici, une saisie hors
  // format (vide, 3 chiffres, nom CSS) est traitée comme absente, jamais
  // comme une erreur qui casserait le rendu du site.
  it('une saisie hors format vaut le défaut', () => {
    for (const mauvaise of ['', '#fff', 'red', '#12345g', ' #264653', null, undefined]) {
      expect(deriver({ principale: mauvaise as string }).variables, String(mauvaise)).toEqual(
        deriver({}).variables,
      )
    }
  })

  it('les majuscules sont acceptées et donnent la même sortie', () => {
    expect(deriver({ principale: '#7FC8A0' }).variables).toEqual(
      deriver({ principale: '#7fc8a0' }).variables,
    )
  })
})

describe('deriver — couleurs forcées', () => {
  it('une forcée est utilisée telle quelle, marquée force, et avertit sous le seuil', () => {
    const r = deriver({ principale: '#264653' }, { texte: '#aaaaaa' })
    expect(r.variables['--principale-sure']).toBe('#aaaaaa')
    const ligne = r.controles.find((c) => c.role === 'texte et liens sur blanc')!
    expect(ligne.force).toBe(true)
    expect(ligne.contraste).toBeLessThan(4.5)
    expect(r.avertissements).toContain('Texte et liens sur blanc : 2,32:1, illisible')
  })

  it('une forcée lisible n’avertit pas', () => {
    const r = deriver({}, { profond: '#000000' })
    expect(r.variables['--profond']).toBe('#000000')
    expect(r.avertissements).toEqual([])
  })

  it('une forcée hors format est ignorée', () => {
    expect(deriver({}, { pale: 'blanc' }).variables).toEqual(deriver({}).variables)
  })

  it('une picto forcée ne remplace que son ton', () => {
    const r = deriver({}, { picto3: '#123456' })
    expect(r.variables['--picto-3']).toBe('#123456')
    expect(r.variables['--picto-4']).toBe(deriver({}).variables['--picto-4'])
  })

  it('l’accent sur profond se recalcule contre le profond forcé', () => {
    // Profond forcé proche de l'accent : contre le profond dérivé (sombre),
    // l'accent passerait tel quel ; contre le forcé, il doit être éclairci.
    const r = deriver({ accent: '#e2a72e' }, { profond: '#8a6a20' })
    expect(r.variables['--accent-sur-profond']).not.toBe('#e2a72e')
    expect(contraste(r.variables['--accent-sur-profond'], '#8a6a20')).toBeGreaterThanOrEqual(3)
  })
})

describe('deriver — harmonie', () => {
  it('avertit quand deux couleurs saisies se confondent', () => {
    const r = deriver({ principale: '#264653', accent: '#274754' })
    expect(r.avertissements).toContain('L’accent se confond avec la principale')
  })

  // Les défauts sont distincts par construction ; une seule saisie proche
  // d'un défaut non saisi n'avertit pas : l'utilisateur n'a rien choisi.
  it('n’avertit jamais sur un défaut non saisi', () => {
    expect(deriver({}).avertissements).toEqual([])
    expect(deriver({ accent: '#264653' }).avertissements).toEqual([])
  })
})

describe('accords', () => {
  it('propose 5 couleurs distinctes, valides, déterministes, différentes de l’entrée', () => {
    fc.assert(
      fc.property(hexQuelconque, (principale) => {
        const a = accords(principale)
        expect(a.length).toBeGreaterThanOrEqual(4)
        expect(a.length).toBeLessThanOrEqual(5)
        for (const c of a) expect(c).toMatch(HEX)
        expect(new Set(a).size).toBe(a.length)
        expect(a).not.toContain(principale)
        expect(accords(principale)).toEqual(a)
      }),
      { seed: 25, numRuns: 500 },
    )
  })

  it('une entrée hors format vaut la principale par défaut', () => {
    expect(accords('rouge')).toEqual(accords(DEFAUTS.principale))
  })
})
```

- [ ] **Step 3: Vérifier qu'il échoue**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/couleurs.spec.ts`
Expected: FAIL — `Failed to resolve import "@/lib/couleurs"` (0 test exécuté).

- [ ] **Step 4: Écrire l'implémentation**

Créer `src/lib/couleurs.ts` :

```ts
/**
 * Dérivation des couleurs d'une commune (spec gabarits-couleurs, section 2).
 *
 * Trois couleurs choisies (principale, accent, terre) → toutes les variables
 * CSS du contrat de gabarit, avec leurs garanties de contraste (I25). Module
 * pur : ni réseau, ni base. Calculs en OKLCH, conversions d'après Björn
 * Ottosson, portés ligne à ligne du prototype validé
 * `docs/recherche/2026-09-25_front-beau/J-maquette-littoral/couleurs.py`.
 * Écart volontaire au prototype : une couleur achromatique reste un gris
 * exact (le prototype teintait légèrement les gris par arrondi).
 */

export type Choix = { principale?: string | null; accent?: string | null; terre?: string | null }
export type CleForcee = 'texte' | 'pale' | 'profond' | `picto${1 | 2 | 3 | 4 | 5 | 6}`
export type Forcees = Partial<Record<CleForcee, string | null>>

export interface Controle {
  role: string
  couleur: string
  fond: string
  contraste: number
  seuil: number
  force: boolean
}

export interface Derivation {
  variables: Record<string, string>
  controles: Controle[]
  avertissements: string[]
}

/** Défauts (spec § 1) : jamais le bleu France, réservé à l'État. */
export const DEFAUTS = { principale: '#264653', accent: '#e2a72e', terre: '#b36b00' } as const

/** Variables fournies aux gabarits (contrat, `src/gabarits/CONTRAT.md`). */
export const VARIABLES_CONTRAT = [
  '--principale-sure',
  '--pale',
  '--profond',
  '--encre',
  '--accent',
  '--accent-sur-profond',
  '--texte-sur-accent',
  '--terre-sure',
  '--picto-1',
  '--picto-2',
  '--picto-3',
  '--picto-4',
  '--picto-5',
  '--picto-6',
] as const

const BLANC = '#ffffff'
const NOIR = '#000000'
/** I24 : le seul format admis, partout. */
const FORMAT = /^#[0-9a-fA-F]{6}$/
/** En deçà, la teinte n'a plus de sens : la couleur est traitée comme un gris. */
const CHROMA_ACHROMATIQUE = 1e-4
/** Écart OKLab en deçà duquel deux couleurs saisies « se confondent » (à étalonner). */
const SEUIL_HARMONIE = 0.08

function valide(h: string | null | undefined): string | undefined {
  return typeof h === 'string' && FORMAT.test(h) ? h.toLowerCase() : undefined
}

function hexRgb(h: string): [number, number, number] {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

function rgbHex(c: readonly number[]): string {
  return (
    '#' +
    c
      .map((v) =>
        Math.round(Math.min(1, Math.max(0, v)) * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  )
}

const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const delin = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)

function luminance(h: string): number {
  const [r, g, b] = hexRgb(h).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rapport de contraste WCAG 2 entre deux couleurs `#rrggbb`. */
export function contraste(a: string, b: string): number {
  const [claire, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (claire + 0.05) / (sombre + 0.05)
}

/** `#rrggbb` → [L, C, H°] en OKLCH. */
export function vers_oklch(h: string): [number, number, number] {
  const [r, g, b] = hexRgb(h).map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  const H = ((((Math.atan2(bb, a) * 180) / Math.PI) % 360) + 360) % 360
  return [L, Math.hypot(a, bb), H]
}

function oklchRgbLineaire(L: number, C: number, H: number): [number, number, number] {
  const a = C * Math.cos((H * Math.PI) / 180)
  const b = C * Math.sin((H * Math.PI) / 180)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

/** OKLCH → `#rrggbb`, en réduisant la saturation jusqu'au gamut sRGB (teinte et clarté gardées). */
function depuis_oklch(L: number, C: number, H: number): string {
  if (C < CHROMA_ACHROMATIQUE) {
    // Gris exact : l = m = s = L³ et la matrice rend r = g = b.
    const v = delin(Math.min(1, Math.max(0, L ** 3)))
    return rgbHex([v, v, v])
  }
  let rgb = oklchRgbLineaire(L, C, H)
  for (let i = 0; i < 40; i++) {
    if (rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4)) break
    C *= 0.93
    rgb = oklchRgbLineaire(L, C, H)
  }
  return rgbHex(rgb.map((v) => delin(Math.min(1, Math.max(0, v)))))
}

/** Plus grande clarté (teinte gardée) qui atteint `seuil` contre `fond` ; inchangée si déjà conforme. */
function assombrirJusqua(h: string, fond: string, seuil: number): string {
  if (contraste(h, fond) >= seuil) return h
  const [L, C, H] = vers_oklch(h)
  let bas = 0
  let haut = L
  for (let i = 0; i < 30; i++) {
    const milieu = (bas + haut) / 2
    if (contraste(depuis_oklch(milieu, C, H), fond) >= seuil) bas = milieu
    else haut = milieu
  }
  return depuis_oklch(bas, C, H)
}

/** Plus petite clarté (teinte gardée) qui atteint `seuil` contre `fond` ; inchangée si déjà conforme. */
function eclaircirJusqua(h: string, fond: string, seuil: number): string {
  if (contraste(h, fond) >= seuil) return h
  const [L, C, H] = vers_oklch(h)
  let bas = L
  let haut = 1
  for (let i = 0; i < 30; i++) {
    const milieu = (bas + haut) / 2
    if (contraste(depuis_oklch(milieu, C, H), fond) >= seuil) haut = milieu
    else bas = milieu
  }
  return depuis_oklch(haut, C, H)
}

function ecartOklab(x: string, y: string): number {
  const [L1, C1, H1] = vers_oklch(x)
  const [L2, C2, H2] = vers_oklch(y)
  const rad = Math.PI / 180
  return Math.hypot(
    L1 - L2,
    C1 * Math.cos(H1 * rad) - C2 * Math.cos(H2 * rad),
    C1 * Math.sin(H1 * rad) - C2 * Math.sin(H2 * rad),
  )
}

const NOMS = { principale: 'la principale', accent: 'l’accent', terre: 'la terre' } as const
const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const format2 = (n: number) => (Math.floor(n * 100) / 100).toFixed(2).replace('.', ',')

/**
 * I23 : rien de ceci n'est stocké ; recalculé à chaque rendu.
 * I24 : aucune couleur n'est refusée ; une saisie hors format vaut le défaut,
 * une forcée hors format est ignorée.
 */
export function deriver(choix: Choix, forcees: Forcees = {}): Derivation {
  const saisies = {
    principale: valide(choix.principale),
    accent: valide(choix.accent),
    terre: valide(choix.terre),
  }
  const p = saisies.principale ?? DEFAUTS.principale
  const a = saisies.accent ?? DEFAUTS.accent
  const t = saisies.terre ?? DEFAUTS.terre
  const f = Object.fromEntries(
    Object.entries(forcees).flatMap(([cle, v]) => (valide(v) ? [[cle, valide(v)!]] : [])),
  ) as Partial<Record<CleForcee, string>>

  const [pL, pC, pH] = vers_oklch(p)
  const sure = assombrirJusqua(p, BLANC, 4.5)
  const encre = depuis_oklch(0.24, Math.min(pC, 0.03), pH)
  const pale = depuis_oklch(0.965, Math.min(pC, 0.03), pH)
  const profond = assombrirJusqua(depuis_oklch(Math.min(pL, 0.34), pC, pH), BLANC, 7)
  const terreSure = assombrirJusqua(t, BLANC, 3)

  // 4 tons de pictos : teintes réparties par pas de 67°, à ≥ 30° des deux premières.
  const [sL, sC, sH] = vers_oklch(sure)
  const [tL, tC, tH] = vers_oklch(terreSure)
  const Lb = (sL + tL) / 2
  const Cb = Math.max(0.08, (sC + tC) / 2)
  const tons: string[] = []
  let h = sH
  while (tons.length < 4) {
    h = (h + 67) % 360
    if (Math.min(...[sH, tH].map((x) => Math.abs(((h - x + 540) % 360) - 180))) >= 30) {
      tons.push(assombrirJusqua(depuis_oklch(Lb, Cb, h), BLANC, 3))
    }
  }

  // Une forcée remplace sa variable ; les dérivées qui en dépendent se
  // recalculent contre la valeur réellement servie.
  const pictos = [sure, terreSure, ...tons].map((x, i) => f[`picto${i + 1}` as CleForcee] ?? x)
  const v: Record<string, string> = {
    '--principale-sure': f.texte ?? sure,
    '--pale': f.pale ?? pale,
    '--profond': f.profond ?? profond,
    '--encre': encre,
    '--accent': a,
    '--texte-sur-accent': contraste(NOIR, a) >= contraste(BLANC, a) ? NOIR : BLANC,
    '--terre-sure': terreSure,
  }
  v['--accent-sur-profond'] = eclaircirJusqua(a, v['--profond'], 3)
  pictos.forEach((x, i) => (v[`--picto-${i + 1}`] = x))

  const lignes: [string, string, string, number, boolean][] = [
    ['texte et liens sur blanc', v['--principale-sure'], BLANC, 4.5, Boolean(f.texte)],
    ['texte courant sur pâle', encre, v['--pale'], 4.5, Boolean(f.pale)],
    ['texte blanc sur profond', BLANC, v['--profond'], 7, Boolean(f.profond)],
    ['grandes dates sur profond', v['--accent-sur-profond'], v['--profond'], 3, Boolean(f.profond)],
    ['texte sur accent', v['--texte-sur-accent'], a, 4.5, false],
    ...[1, 2, 3, 4, 5, 6].map(
      (i) =>
        [
          `picto blanc sur ton ${i}`,
          BLANC,
          v[`--picto-${i}`],
          3,
          Boolean(f[`picto${i}` as CleForcee]),
        ] as [string, string, string, number, boolean],
    ),
  ]
  const controles = lignes.map(([role, couleur, fond, seuil, force]) => ({
    role,
    couleur,
    fond,
    contraste: contraste(couleur, fond),
    seuil,
    force,
  }))

  const avertissements = controles
    .filter((c) => c.contraste < c.seuil)
    .map((c) => `${capitale(c.role)} : ${format2(c.contraste)}:1, illisible`)
  // Harmonie : seulement entre couleurs saisies, jamais sur un défaut.
  const noms = (['principale', 'accent', 'terre'] as const).filter((n) => saisies[n])
  for (let i = 0; i < noms.length; i++) {
    for (let j = i + 1; j < noms.length; j++) {
      if (ecartOklab(saisies[noms[i]]!, saisies[noms[j]]!) < SEUIL_HARMONIE) {
        avertissements.push(`${capitale(NOMS[noms[j]])} se confond avec ${NOMS[noms[i]]}`)
      }
    }
  }

  return { variables: v, controles, avertissements }
}

/** Propositions d'accent pour une principale : teintes voisine, triade, complémentaires. */
export function accords(principale: string): string[] {
  const [, C, H] = vers_oklch(valide(principale) ?? DEFAUTS.principale)
  const chroma = Math.min(0.16, Math.max(0.1, C))
  return [30, 120, 150, 180, 210].map((d) => depuis_oklch(0.78, chroma, (H + d) % 360))
}
```

- [ ] **Step 5: Vérifier que tout passe**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/couleurs.spec.ts`
Expected: `Tests  20 passed (20)`

Run: `npm run typecheck && npm run lint && npm run test:unit`
Expected: aucune erreur ; `identite-etat.spec.ts` toujours vert.

- [ ] **Step 6: Contre-épreuve (les tests attrapent-ils un défaut ?)**

Casser une garantie à la main, vérifier l'échec, rétablir :

```bash
cp src/lib/couleurs.ts "$TMPDIR/couleurs.ts.bak"   # fichier pas encore suivi : git checkout ne le restaurerait pas
sed -i '' 's/const sure = assombrirJusqua(p, BLANC, 4.5)/const sure = assombrirJusqua(p, BLANC, 4.0)/' src/lib/couleurs.ts
npx vitest run --config ./vitest.config.mts tests/unit/couleurs.spec.ts   # attendu : 4 failed, dont « toutes les garanties tiennent »
cp "$TMPDIR/couleurs.ts.bak" src/lib/couleurs.ts
npx vitest run --config ./vitest.config.mts tests/unit/couleurs.spec.ts   # attendu : 20 passed
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/couleurs.ts tests/unit/couleurs.spec.ts package.json package-lock.json
git commit -m "Couleurs — dérivation depuis 3 choix, garanties de contraste testées (I23-I25)

Portage de couleurs.py (maquette Littoral, 0 échec sur 3 000 tirages).
Écarts : pas de culori (autre algorithme de gamut, le résultat ne se
transférerait pas) ; un gris saisi reste un gris exact."
```

**Preuve (exécution du 25/09, copie jetable avec les versions du dépôt : vitest 4.1.11, fast-check 4.10.2, typescript 5.7.3, `.prettierrc.json` du dépôt appliqué) :**
- Avant le code : `Test Files 1 failed`, `Tests no tests` (module introuvable).
- Après : `Tests 20 passed (20)` ; `tsc --noEmit` sans erreur ; ESLint avec `eslint.config.mjs` du dépôt : 0 erreur, 0 avertissement.
- Contre-épreuve, 4 mutations : seuil 4,5 → 4,0 (4 échecs) ; accent-sur-profond calculé contre le profond dérivé au lieu du forcé (1 échec — **ce test ne l'attrapait pas dans sa première version**, il employait un profond noir contre lequel tout passe ; durci avec `#8a6a20`) ; harmonie appliquée aux défauts (15 échecs) ; chemin « gris exact » retiré (1 échec). Une branche redondante qu'aucun test ne distinguait a été supprimée plutôt que gardée.
- Parité avec le prototype : sortie des défauts identique octet pour octet à `couleurs.py` (`--profond #1d3d49`, `--pale #e6f7fe`, pictos 3-6…), `#7fc8a0 → #3c8460`, `#ffff00 → #7a7a0f`.

---

### Porte de déblocage (avant la tâche 2)

**Statut : ouverte le 04/10/2026.** Conditions vérifiées par commande ce jour-là :

- [x] **`umami-collecte` fusionnée dans `main`** : `git log --oneline main..umami-collecte | wc -l` → `0`.
- [x] **Multilingue implémenté et fusionné** : `src/i18n/(fr|co).ts` → `2` ; fichiers sous `(frontend)/[lang]/` → `8`.
- [x] **Rebase** : `gabarits-couleurs` rebasée sur `main` (`56d20a2`) ; `npm run test:unit` → 152/152.
- [ ] **Re-vérifier les ancres** : se fait **tâche par tâche**, à l'étape 1 de chacune (voir « État d'exécution »).
- [x] **Questions Q1-Q3** : tranchées le 25/09. Décisions 14 et 15 ajoutées le 04/10.

---

### Task 2: Données, droits, versions, préremplissage (spec § 1)

**Statut : fait les 04-05/10, corrigé après relecture le 04/10 soir. Notes : `docs/qc/notes-tache-02.md`.**

**Files:**
- Modify: `src/collections/Communes.ts` — groupe `apparence` (ancre vérifiée le 25/09 sur `umami-collecte` : `name: 'apparence'`, 2 champs `couleurPrincipale` / `couleurAccent`, validation `^#[0-9a-fA-F]{6}$`) ; `hooks.beforeChange` (ancre : `validerRelationsTenant((data) => ({ media: data['logo'] … champMedia: 'logo' }), ({ originalDoc }) => idDe(originalDoc) ?? null)`).
- Create: `src/lib/accueil-defauts.ts` (lignes préremplies, partagées par `defaultValue` et la migration)
- Create: `public/pictos/*.svg` (GemeentenIconen, CC0 — copiés de `G-maquette-v2/icones/`) + `public/pictos/LICENCE.md`
- Create: migration via `npm run payload migrate:create gabarits_couleurs`
- Test: `tests/int/communes-apparence.int.spec.ts`
- Regénérer : `src/payload-types.ts`

**Interfaces:**
- Produces : champs `apparence.{gabarit, frise[], couleurTerre, couleursForcees.{texte,pale,profond,picto1..6}, photoAccueil}` et `accueil.{demarches[], mosaique[]}` ; constantes `DEMARCHES_DEFAUT`, `MOSAIQUE_DEFAUT`, `PICTOS`, `SCENES` exportées de `src/lib/accueil-defauts.ts`.

**Décisions de schéma (spec § 1, figées) :**

```ts
// src/lib/accueil-defauts.ts
export const PICTOS = [
  'dechets', 'identite', 'etat-civil', 'urbanisme', 'ecole', 'conseil',
] as const // noms = fichiers public/pictos/<nom>.svg ; compléter depuis G-maquette-v2/icones/ au déblocage
export const SCENES = [
  'sentiers', 'patrimoine', 'commerces', 'associations', 'ecole', 'mer', 'nature',
] as const
export type Scene = (typeof SCENES)[number]

export const DEMARCHES_DEFAUT = [
  { picto: 'dechets', titre: 'Déchets' },
  { picto: 'identite', titre: 'Papiers d’identité',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N358' },
  { picto: 'etat-civil', titre: 'État civil',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N359' },
  { picto: 'urbanisme', titre: 'Urbanisme',
    lien: 'https://www.service-public.fr/particuliers/vosdroits/N319' },
  { picto: 'ecole', titre: 'École et cantine' },
  { picto: 'conseil', titre: 'Conseil municipal' },
]
export const MOSAIQUE_DEFAUT = [
  { libelle: 'Balades et sentiers', illustration: 'sentiers' },
  { libelle: 'Patrimoine', illustration: 'patrimoine' },
  { libelle: 'Commerces', illustration: 'commerces' },
  { libelle: 'Associations', illustration: 'associations' },
]
```

⚠️ Les trois URL service-public.fr (`N358`, `N359`, `N319`) sont à **ouvrir une par une au déblocage** (`curl -sSL -o /dev/null -w '%{http_code} %{url_effective}\n'`) et à vérifier par leur `<title>` : elles n'ont pas été relevées le 25/09.

Champs à poser (Payload), dans un onglet non nommé « Apparence » qui contient les groupes `apparence` et `accueil` :
- `gabarit` : `select`, options `village` / `littoral`, `defaultValue: 'village'`, `access.update: ({ req }) => isOperateur(req.user)`.
- `frise` : `array` de `{ piece: text (required), taille: select petite|moyenne|grande (defaultValue 'moyenne'), ecart: number (min 0) }`, `access.update` opérateur seul.
- `couleurTerre` : `text`, même `validate` que `couleurPrincipale`.
- `couleurPrincipale` : **retirer `defaultValue: '#264653'`** et la description « vérifier le contraste à la main » (le défaut vit désormais dans `couleurs.ts` ; I24/I25 rendent la consigne fausse). ⚠️ Une migration peut en résulter (défaut de colonne) : la lire.
- `couleursForcees` : `group` à `admin: { condition }` replié (`admin.initCollapsed: true` via un `collapsible`), 9 champs `text` au même `validate`.
- `photoAccueil` : `upload` → `media`.
- `accueil.demarches` : `array`, `maxRows: 8`, `defaultValue: DEMARCHES_DEFAUT`, champs `picto` (`select` sur `PICTOS`), `titre` (text, required), `precision` (text), `lien` (text, `validate: validerUrlEditoriale` — ce lien part dans un `href`).
- `accueil.mosaique` : `array`, `maxRows: 4`, `defaultValue: MOSAIQUE_DEFAUT`, champs `libelle` (required), `lien` (`validerUrlEditoriale`), `photo` (upload → media), `illustration` (`select` sur `SCENES`, required).
- Collection : `versions: { maxPerDoc: 20 }` (sans `drafts`).
- `hooks.beforeChange`, **après** le hook du logo et avant `preparerMesure` :

```ts
// I4 : la photo d'accueil et les photos de la mosaïque sont des médias de
// la commune elle-même (même règle que le logo).
validerRelationsTenant(
  (data) => {
    const photo = (data['apparence'] as Record<string, unknown> | undefined)?.['photoAccueil']
    return { media: photo ? [photo as string | number] : [], champMedia: 'apparence.photoAccueil' }
  },
  ({ originalDoc }) => idDe(originalDoc) ?? null,
),
validerRelationsTenant(
  (data) => {
    const lignes = ((data['accueil'] as Record<string, unknown> | undefined)?.['mosaique'] ??
      []) as Array<Record<string, unknown>>
    return {
      media: lignes.flatMap((l) => (l?.['photo'] ? [l['photo'] as string | number] : [])),
      champMedia: 'accueil.mosaique',
    }
  },
  ({ originalDoc }) => idDe(originalDoc) ?? null,
),
```

- [ ] **Step 1: Re-vérifier les ancres** (`grep -n "name: 'apparence'" src/collections/Communes.ts`, `grep -n "champMedia: 'logo'" src/collections/Communes.ts`, `ls tests/helpers/communeTest.ts`). Si l'une manque, arrêter et corriger la tâche.

- [ ] **Step 2: Écrire le test d'intégration qui échoue** — `tests/int/communes-apparence.int.spec.ts` :

```ts
// @vitest-environment node
import type { Payload } from 'payload'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let communeA: number
let communeB: number
let mediaB: number

async function image(): Promise<{ data: Buffer; mimetype: string; name: string; size: number }> {
  const data = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#888888' },
  }).png().toBuffer()
  return { data, mimetype: 'image/png', name: 'test.png', size: data.length }
}

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'apparence-a')).id
  communeB = (await creerCommuneActive(payload, 'apparence-b')).id
  mediaB = (
    await payload.create({
      collection: 'media',
      data: { alt: 'B', tenant: communeB },
      file: await image(),
      overrideAccess: true,
    })
  ).id as number
})

afterAll(async () => {
  await payload.delete({ collection: 'media', id: mediaB, overrideAccess: true })
  await supprimerCommuneTest(payload, communeA)
  await supprimerCommuneTest(payload, communeB)
})

describe('Communes — apparence et accueil (spec § 1)', () => {
  it('une commune créée reçoit 6 démarches et 4 tuiles préremplies', async () => {
    const c = await payload.findByID({ collection: 'communes', id: communeA, overrideAccess: true })
    expect(c.accueil?.demarches?.map((d) => d.titre)).toEqual([
      'Déchets', 'Papiers d’identité', 'État civil', 'Urbanisme', 'École et cantine',
      'Conseil municipal',
    ])
    expect(c.accueil?.mosaique?.map((t) => t.illustration)).toEqual([
      'sentiers', 'patrimoine', 'commerces', 'associations',
    ])
    expect(c.apparence?.gabarit).toBe('village')
  })

  // I4 : une photo d'une autre commune est refusée, par le serveur.
  it('refuse une photo d’accueil qui appartient à une autre commune', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { photoAccueil: mediaB } },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/n’appartient pas à cette commune/)
  })

  it('refuse une photo de mosaïque qui appartient à une autre commune', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { accueil: { mosaique: [{ libelle: 'X', illustration: 'nature', photo: mediaB }] } },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/n’appartient pas à cette commune/)
  })

  // I24 : seul le format est refusé.
  it('accepte une couleur illisible, refuse un format invalide', async () => {
    await payload.update({
      collection: 'communes', id: communeA,
      data: { apparence: { couleurTerre: '#ffff00' } }, overrideAccess: true,
    })
    await expect(
      payload.update({
        collection: 'communes', id: communeA,
        data: { apparence: { couleurTerre: 'jaune' } }, overrideAccess: true,
      }),
    ).rejects.toThrow(/#RRGGBB/)
  })

  it('crée une version à chaque enregistrement', async () => {
    const avant = await payload.countVersions({
      collection: 'communes', where: { parent: { equals: communeA } }, overrideAccess: true,
    })
    await payload.update({
      collection: 'communes', id: communeA,
      data: { apparence: { couleurAccent: '#123456' } }, overrideAccess: true,
    })
    const apres = await payload.countVersions({
      collection: 'communes', where: { parent: { equals: communeA } }, overrideAccess: true,
    })
    expect(apres.totalDocs).toBe(avant.totalDocs + 1)
  })
})
```

⚠️ `payload.countVersions` : vérifier son existence dans `node_modules/payload/dist/index.d.ts` au déblocage ; à défaut, `payload.findVersions({ …, limit: 0 })` et `totalDocs`.

- [ ] **Step 3: Vérifier l'échec** — `npx vitest run --config ./vitest.config.mts tests/int/communes-apparence.int.spec.ts` → FAIL (champs inconnus / 0 démarche).

- [ ] **Step 4: Écrire les tests d'accès** — ajouter à `tests/int/communes-apparence.int.spec.ts` un `describe('droits')` qui crée un utilisateur `admin` de la commune A et un `redacteur` de A (même forme que `tests/int/relations-tenant.int.spec.ts`, `tenants: [{ tenant, roles: ['admin'] }]`), puis :
  - rédacteur, `overrideAccess: false, user: redacteur` : `update` de `apparence.couleurAccent` → rejet (la collection lui est fermée) ;
  - admin de A : `update` de `apparence.couleurAccent` → accepté ; `update` de `apparence.gabarit: 'littoral'` → la valeur reste `village` (Payload ignore silencieusement un champ dont `access.update` est faux : **lire la valeur après coup**, ne pas attendre une erreur) ; idem `frise`.

- [ ] **Step 5: Implémenter** les champs, hooks et `versions` ci-dessus ; `npm run generate:types` ; `npm run generate:importmap`.

- [ ] **Step 6: Migration** — `npm run payload migrate:create gabarits_couleurs` ; **lire le fichier généré** : noms réels des tables des tableaux (attendus `communes_accueil_demarches`, `communes_accueil_mosaique`, `_communes_v`… à confirmer). Ajouter à la fin de `up` le préremplissage des communes existantes **sans** lignes, en SQL (pas de `payload.update` : il déclencherait les hooks Umami et le journal) :

```ts
// Préremplissage des communes existantes (spec § 1) : même contenu que
// le defaultValue, depuis la même source.
for (const [ordre, d] of DEMARCHES_DEFAUT.entries()) {
  await db.execute(sql`
    INSERT INTO communes_accueil_demarches (_order, _parent_id, id, picto, titre, lien)
    SELECT ${ordre + 1}, c.id, gen_random_uuid()::text, ${d.picto}, ${d.titre}, ${d.lien ?? null}
    FROM communes c
    WHERE NOT EXISTS (SELECT 1 FROM communes_accueil_demarches x WHERE x._parent_id = c.id)`)
}
```

(colonnes à aligner sur le fichier généré ; même boucle pour la mosaïque). `down` : supprimer les lignes et les colonnes (généré).

- [ ] **Step 7: Vérifier** — `npm run test:int` (tout, pas seulement le nouveau fichier : `isolation`, `relations-tenant`, `mesure-*` doivent rester verts) ; `npm run typecheck && npm run lint`.

- [ ] **Step 8: Commit** — `git add src/collections/Communes.ts src/lib/accueil-defauts.ts public/pictos src/migrations src/payload-types.ts "src/app/(payload)/admin/importMap.js" tests/int/communes-apparence.int.spec.ts && git commit -m "Apparence — gabarit, frise, 3 couleurs, accueil prérempli, versions (I4, I24)"`

---

### Task 3: Le layout injecte `deriver()` ; anciens noms en alias (spec § 2)

**Statut : fait le 05/10, relu puis corrigé le même jour (décision 17 du relecteur). Notes : `docs/qc/notes-tache-03.md`.**

**Files:**
- Modify: le layout qui pose `<body style={{ '--couleur-principale': … }}>` (sur `umami-collecte` : `src/app/(frontend)/layout.tsx`, bloc `// Couleur non saisie : variable non posée…`).
- Modify: `src/app/(frontend)/styles.css` (`:root`, l. 5-14 sur `main` le 25/09 : `--couleur-principale: #264653; --couleur-accent: #264653; … --couleur-erreur: #b3261e;`).
- Test: `tests/e2e/couleurs.e2e.spec.ts`

**Interfaces:** Consumes `deriver` (tâche 1). Produces : `<body>` porte les 14 variables du contrat ; `:root` porte les alias et les fixes.

- [ ] **Step 1: Test e2e qui échoue** — `tests/e2e/couleurs.e2e.spec.ts` : ouvrir l'accueil de la commune de démonstration (même URL de base que `tests/e2e/frontend.e2e.spec.ts`), lire `getComputedStyle(document.body).getPropertyValue('--principale-sure')` → `'#264653'`, et `--couleur-principale` résolue sur un lien (`getComputedStyle(a).color`) → `rgb(38, 70, 83)`. Puis, via l'API admin (helper `tests/helpers/login.ts`), poser `couleurPrincipale: '#7fc8a0'` et vérifier `--principale-sure` = `#3c8460`.
- [ ] **Step 2: Vérifier l'échec** (`npm run test:e2e -- couleurs`).
- [ ] **Step 3: Implémenter** — dans le layout :

```tsx
// I23 : dérivées recalculées à chaque rendu, jamais stockées.
const { variables } = deriver(
  {
    principale: commune.apparence?.couleurPrincipale,
    accent: commune.apparence?.couleurAccent,
    terre: commune.apparence?.couleurTerre,
  },
  commune.apparence?.couleursForcees ?? {},
)
// …
<body style={variables as React.CSSProperties}>
```

  et dans `styles.css` : retirer les valeurs de `--couleur-principale` / `--couleur-accent` / `--couleur-fond-alt` / `--couleur-erreur`, remplacées par

```css
/* Alias (spec § 2) : les blocs gardent leurs noms, les valeurs viennent de deriver().
   Posés sur body, PAS :root (correction du 05/10, mesuré en exécutant la tâche) :
   var() se résout sur l'élément qui déclare l'alias, et les variables de deriver()
   sont inline sur <body> — dans :root, la substitution échoue et un lien hérite
   de --couleur-texte (rgb(22, 22, 22)). */
body {
  --couleur-principale: var(--principale-sure);
  --couleur-accent: var(--accent);
  --couleur-fond-alt: var(--pale);
  --couleur-erreur: var(--alerte);
}
/* Dans :root, Fixes, jamais issus de la commune. */
/* --alerte: #b3261e; --alerte-texte: #ffffff; */
```

  ⚠️ `--couleur-accent` sert aujourd'hui de **fond sous du texte blanc** (`styles.css` l. 289-290 : `background: var(--couleur-accent); color: var(--couleur-texte-blanc)`). Avec l'accent désormais décoratif (`#e2a72e` par défaut, blanc dessus ≈ 2:1), cette règle devient illisible : la passer à `color: var(--texte-sur-accent)`. Chercher les autres paires `--couleur-accent` + texte blanc (`grep -n "couleur-accent" -A2 src/app/(frontend)/styles.css`).
- [ ] **Step 4: Vérifier** — e2e vert, `tests/e2e/focus.e2e.spec.ts` toujours vert (anneau de focus inchangé), `npm run test:unit`.
- [ ] **Step 5: Commit** — `"Couleurs — le site public sert les variables dérivées (I23), anciens noms en alias"`.

---

### Task 4: Moteur de gabarits, sections communes, contrat et suite de conformité (spec § 3, § 6)

**Statut : fait le 05/10 (deux sessions), relu et corrigé le même jour. Notes : `docs/qc/notes-tache-04.md`.** (Réponse à Q3 : tranchée le 25/09.)

**Files:**
- Create: `src/gabarits/types.ts` — `NomSection = 'heros' | 'demarches' | 'mairie' | 'texteLibre' | 'actualites' | 'agenda' | 'mosaique'`, `Taille = 'petite' | 'moyenne' | 'grande'`, `Gabarit = { nom: string; libelle: string; versionContrat: number; polices: string[]; accueil: { section: NomSection; variante?: string }[]; cadrageHeros: 'haut' | 'panorama' }`, `Kit = { horizon(): string; pieces: Record<string, (x: number, sol: number, taille: Taille) => { formes: string[]; traits: string[] }>; ornements?: Record<string, () => string> }`, `Illustrations = { scene(nom: Scene, largeur: number, hauteur: number): string; heros(largeur: number, hauteur: number): string }`.
- Create: `src/gabarits/registre.ts` — `GABARITS: Record<'village' | 'littoral', { gabarit: Gabarit; kit: Kit; illustrations: Illustrations }>` et `gabaritDe(nom: string | null | undefined)` (repli `village`).
- Create: `src/gabarits/frise.ts` — `composerFrise(kit: Kit, lignes: { piece: string; taille: Taille; ecart?: number | null }[], largeur = 1440): { svg: string | null; ignorees: string[] }` : pièce hors kit → ignorée et listée ; aucune ligne valide → `svg: null`.
- Create: `src/gabarits/sections/{Heros,Demarches,Mairie,TexteLibre,Actualites,Agenda,Mosaique}.tsx` et `src/gabarits/Accueil.tsx` (rend les sections dans l'ordre de `gabarit.accueil`).
- Create: `src/gabarits/CONTRAT.md` (version 1 : contenu de la spec § 6 « Le contrat de gabarit », plus l'export `ornements` si Q3 est acceptée).
- Modify: `src/app/(frontend)/[lang]/page.tsx` (ancre revérifiée le 05/10 : la page est sous `[lang]/` depuis le multilingue et rend `pageAccueil(commune.id)` via `versionEnLangue`, ou « Le site est en cours de construction » — `contenu.ts` expose `pageAccueil` l. 45).
- Modify: `src/i18n/fr.ts`, `src/i18n/co.ts` — clés `accueil.demarches` (« Vos démarches »), `accueil.agenda` (« Au village ce mois-ci »), `accueil.actualites` (« Actualités »), `accueil.mosaique` (« Vivre à {commune} »), `accueil.toutAgenda` (« Tout l’agenda »). Textes corses : à faire relire (question ouverte n° 1 de la spec multilingue).
- Test: `tests/unit/gabarits-frise.spec.ts`, `tests/e2e/gabarits-conformite.e2e.spec.ts`

**Règles du rendu (I30, spec § 1) :** démarche sans lien → non rendue ; tuile sans lien → non cliquable, illustration gardée ; photo absente → `illustrations.scene()` / `heros()` ; section sans élément → non rendue ; page `accueil` absente ou sans bloc → pas de section texte libre ; frise vide → pas de SVG, héros terminé sur un fondu. SVG de frise et d'illustration : `aria-hidden="true"`.

- [ ] **Step 1: Re-vérifier les ancres** (layout et page d'accueil sous `[lang]`, forme des dictionnaires `src/i18n/fr.ts`, `pageAccueil` dans `src/lib/contenu.ts`).
- [ ] **Step 2: Test unitaire qui échoue** — `tests/unit/gabarits-frise.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { composerFrise } from '@/gabarits/frise'
import type { Kit } from '@/gabarits/types'

const kit: Kit = {
  horizon: () => '<path d="M0 100H1440"/>',
  pieces: {
    maison: (x, sol, taille) => ({
      formes: [`M${x} ${sol}h${taille === 'grande' ? 60 : 40}v-30h-40z`],
      traits: [],
    }),
  },
}

describe('composerFrise', () => {
  it('frise vide : aucun SVG', () => {
    expect(composerFrise(kit, [])).toEqual({ svg: null, ignorees: [] })
  })

  it('pièce hors kit : ignorée et listée, sans erreur', () => {
    const r = composerFrise(kit, [{ piece: 'phare', taille: 'moyenne' }, { piece: 'maison', taille: 'grande' }])
    expect(r.ignorees).toEqual(['phare'])
    expect(r.svg).toContain('aria-hidden="true"')
  })

  it('seulement des pièces hors kit : aucun SVG', () => {
    expect(composerFrise(kit, [{ piece: 'phare', taille: 'moyenne' }]).svg).toBeNull()
  })

  it('le SVG est bien formé', () => {
    const { svg } = composerFrise(kit, [{ piece: 'maison', taille: 'petite', ecart: 12 }])
    const doc = new DOMParser().parseFromString(svg!, 'image/svg+xml')
    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Vérifier l'échec**, implémenter `types.ts`, `frise.ts` (positions gauche → droite sur 1440, pas de placement au pixel, même logique que `composer()` de `frise_littoral.py` l. 90-105), vérifier le passage.
- [ ] **Step 4: Écrire la suite de conformité** — `tests/e2e/gabarits-conformite.e2e.spec.ts`, paramétrée par `Object.keys(GABARITS)` (I31). Pour chaque gabarit, sur une commune de démonstration basculée sur ce gabarit via l'API admin :
  1. l'accueil répond 200 ; l'ordre des `section[data-section]` égale `gabarit.accueil.map(s => s.section)` (filtré des sections vides) ;
  2. I27 : `page.on('request')` n'enregistre aucune URL hors de l'origine testée ; l'ensemble des `script[src]` de l'accueil **égale** celui d'une page intérieure (`/actualites`) ;
  3. `theme.css` lu sur disque : aucune couleur littérale hors `#fff`, `#ffffff`, `#000`, `#000000`, `transparent` (regex `/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|oklch\(/gi`) ; toute `var(--x)` appartient à `VARIABLES_CONTRAT` ∪ variables fixes ∪ variables locales déclarées dans le même fichier ;
  4. `new AxeBuilder({ page }).analyze()` → `violations` vide (`npm i -D --save-exact @axe-core/playwright`, version relevée au déblocage, licence MPL-2.0 à vérifier) ;
  5. trois palettes (`#ffff00`, `#777777`, `#3b0a14` pour principale / accent / terre) : pour chaque élément texte visible, contraste calculé depuis `getComputedStyle` (couleur + premier fond opaque des ancêtres) ≥ 4,5 (≥ 3 pour le texte large) ;
  6. commune vide (photo, liens, frise, page `accueil` retirés) : aucun `img` sans `src`, aucun `svg[data-illustration]` vide, aucune section sans enfant ;
  7. chaque pièce × `petite|moyenne|grande` et chaque scène de `SCENES` : SVG bien formé (même `DOMParser` que ci-dessus, en test unitaire `tests/unit/gabarits-kits.spec.ts` paramétré par gabarit) ;
  8. `src/gabarits/<nom>/polices/` : chaque fichier de police a un fichier de licence voisin ;
  9. captures pleine page 1440 et 390 dans `test-results/gabarits/<nom>-<largeur>.png`.
- [ ] **Step 5: Implémenter** `sections/*`, `Accueil.tsx`, `registre.ts` (avec un gabarit minimal provisoire `village` qui ne rend que les sections, sans `theme.css` propre — remplacé tâche 5), la page d'accueil qui rend `<Accueil>` ; `CONTRAT.md`.
- [ ] **Step 6: Vérifier** — unitaires verts ; suite de conformité verte sur le gabarit provisoire ; `test:int` inchangé.
- [ ] **Step 7: Commit** — `"Gabarits — moteur, sections communes, contrat v1 et suite de conformité (I27, I30, I31)"`.

---

### Task 5: Gabarit Village (spec § 3)

**Statut : à faire** (porte ouverte le 04/10 ; réponses à Q1 et Q2 : tranchées le 25/09).

**Files:**
- Create: `src/gabarits/village/{gabarit.ts, theme.css, frise.ts, illustrations.ts, README.md}`, `src/gabarits/village/polices/` (Bricolage Grotesque + Atkinson Hyperlegible Next, OFL, depuis `G-maquette-v2/polices/` avec leurs licences), `src/gabarits/village/maquette/` (copie de référence de `G-maquette-v2/accueil.html` + captures).
- Test: couvert par la suite de conformité (tâche 4) et `tests/unit/gabarits-kits.spec.ts`.

- [ ] **Step 1:** porter `G-maquette-v2/theme.css` : remplacer `--principale-fonce` par `--profond`, `--texte`/`--titres`/`--texte-doux` par `--encre` (ou une variable locale dérivée par `color-mix(in oklab, var(--encre) …)`), et **retirer les 6 couleurs littérales** relevées le 25/09 (`#14532d`, `#16201c`, `#1f9d55`, `#4b5a53`, `#85590a`, `#e9f0eb`, `#fff3cf`) — critère 3 de la suite.
- [ ] **Step 2:** porter les pièces de `G-maquette-v2/frise.py` (`maison`, `maison_basse`, `eglise`, `sapin`, `arbre`, `mairie`, `colline` → `horizon()`) vers la signature `(x, sol, taille)` avec `TAILLES = { petite: 0.72, moyenne: 1, grande: 1.3 }` (valeurs de `frise_littoral.py`).
- [ ] **Step 3:** porter les 7 scènes et `heros()` depuis la maquette **validée par Matthieu le 25/09** : `docs/recherche/2026-09-25_front-beau/K-village-illustre/illustrations_village.py` (hors dépôt, exclu par `.git/info/exclude` — planche : `captures/planche-scenes-desktop.png`) ; captures du rendu réel regardées par l'utilisateur avant la suite.
- [ ] **Step 4:** `gabarit.ts` : composition de l'accueil dans l'ordre de `G-maquette-v2/generer.py` ; `cadrageHeros: 'haut'`.
- [ ] **Step 5:** suite de conformité verte pour `village` ; **regarder** les 2 captures.
- [ ] **Step 6: Commit** — `"Gabarit Village"`.

---

### Task 6: Cadrages d'image `heros-haut` et `panorama` (spec § 3)

**Statut : à faire (porte ouverte le 04/10).**

**Files:** Modify `src/collections/Media.ts` (ancre du 25/09 sur `main` : `imageSizes: [thumbnail 400×300, card 800×1000, hero 1600×900]`, tous `position: 'centre'`) ; Create `scripts/regenerer-tailles.ts` ; Test `tests/int/media-tailles.int.spec.ts`.

**Fait vérifié le 25/09** (`node_modules/payload/dist/uploads/types.d.ts` l. 216-220 et `image-resizing/getImageResizeAction.js`) : `focalPoint` vaut `true` par défaut ; quand un point focal est posé, Payload choisit `resizeWithFocalPoint`. Ne **pas** mettre `position: 'centre'` sur les nouvelles tailles (à vérifier : `position` explicite peut primer sur le point focal — le test tranche).

- [ ] **Step 1: Test qui échoue** — téléverser une image 2400×1600 avec `focalPoint: { x: 90, y: 10 }` ; attendre `sizes['heros-haut']` 1600×1100 et `sizes.panorama` 2000×800 ; vérifier au pixel (sharp) que le coin supérieur droit de l'original est présent dans `panorama`.
- [ ] **Step 2:** ajouter `{ name: 'heros-haut', width: 1600, height: 1100 }` et `{ name: 'panorama', width: 2000, height: 800 }`.
- [ ] **Step 3: Régénération des médias existants** (point non vérifié de la spec). Test d'abord : un média créé **avant** l'ajout (simulé en créant puis en supprimant `sizes` en base) retrouve ses tailles après `payload.update({ collection: 'media', id, data: {}, file })` avec son propre fichier relu depuis le stockage. Si ce test passe, `scripts/regenerer-tailles.ts` boucle sur tous les médias par pages de 50, `overrideAccess: true`, et journalise `id → ok | erreur`. S'il échoue, **arrêter** et remonter à l'utilisateur (re-téléversement manuel à documenter).
- [ ] **Step 4: Commit** — `"Médias — cadrages héros haut et panorama au point focal"`.

---

### Task 7: Frise Village dans l'admin — champ, avertissements, aperçu SVG (spec § 3, étape 4)

**Statut : à faire (porte ouverte le 04/10).**

**Files:** Create `src/components/admin/FriseApercu.tsx` (composant client, pattern du dépôt : `admin.components.Field: '/components/admin/FriseApercu#FriseApercu'`, cf. `EffacerHistorique` sur `umami-collecte`) ; Modify `src/collections/Communes.ts` (champ `frise`, `admin.components.beforeInput` ou champ `ui` voisin) ; regénérer `importMap.js` ; Test `tests/e2e/frise-admin.e2e.spec.ts`.

- [ ] **Step 1: Test e2e qui échoue** — en opérateur, ajouter une ligne `{ piece: 'eglise', taille: 'grande' }` : l'aperçu SVG se met à jour sans enregistrer ; basculer le gabarit sur `littoral` avec une pièce `sapin` : l'admin affiche « Pièces absentes du gabarit Littoral, ignorées : sapin » et la ligne reste en base après enregistrement (Review Focus 4). En admin de commune : le champ frise est en lecture seule.
- [ ] **Step 2:** implémenter ; l'aperçu appelle `composerFrise()` (tâche 4) côté client — `frise.ts` et les kits doivent donc rester sans import serveur (pas de `server-only`).
- [ ] **Step 3: Commit** — `"Frise — composition par l'opérateur, aperçu en direct, pièces hors kit signalées"`.

---

### Task 8: Gabarit Littoral (spec § 3, étape 5)

**Statut : à faire** (porte ouverte le 04/10 ; Q2 + Q3 : tranchées le 25/09).

**Files:** `src/gabarits/littoral/{gabarit.ts, theme.css, frise.ts, illustrations.ts, README.md, polices/, maquette/}` ; ajouter `'littoral'` à `GABARITS` et aux options du select `gabarit` (seul changement de schéma admis par I26).

- [ ] **Step 1:** porter `L-littoral-scenes/frise_littoral.py` (copie de `J-maquette-littoral/frise_littoral.py` complétée des scènes `ecole`, `mer`, `nature` et des pièces `ecole`, `portique`, `dune`, `rocher` — **validées par Matthieu le 25/09**, hors dépôt comme `K-village-illustre/`) : `KIT` (10 pièces : `phare`, `jetee`, `barque`, `voilier`, `cabane`, `pin`, `eglise`, `maison`, `mairie`, `goeland`), `TAILLES`, `composer()`, `_scene()`, `SCENES` (7, dessinées et validées), `heros()`, et les ornements `mer`, `maree`, `ligne_mer`, `courbe_marees`, `sable` (selon Q3).
- [ ] **Step 2:** porter `theme.css` (littéraux à retirer : `#1f7a3a`, `#6b4600`, `#fff3cf`) ; polices Source Serif 4 + Public Sans (OFL, licences dans `J-maquette-littoral/polices/`) ; `cadrageHeros: 'panorama'`.
- [ ] **Step 3:** scène absente du kit → repli `nature` (test unitaire dans `gabarits-kits.spec.ts`).
- [ ] **Step 4:** suite de conformité verte sur **les deux** gabarits (I26 : Village inchangé — `git diff --stat main -- src/gabarits/village` vide pour ce commit) ; regarder les captures.
- [ ] **Step 5: Commit** — `"Gabarit Littoral"`.

---

### Task 9: Onglet Apparence, route d'aperçu, en-têtes (spec § 4)

**Statut : à faire (porte ouverte le 04/10).**

**Files:**
- Create: `src/app/(apercu)/layout.tsx` (layout racine propre : `(frontend)` et `(payload)` ont chacun le leur ; sous l'hôte admin, `resolveCommune()` rend `null`), `src/app/(apercu)/apercu/apparence/page.tsx`, `src/lib/apercu.ts` (`lireParametresApercu(params, enBase): { gabarit; choix; forcees; lang; communeId }` — pure).
- Create: `src/components/admin/ApparenceApercu.tsx` (pastilles, `accords()`, iframe `src=/apercu/apparence?…`, anti-rebond 300 ms, bascule 1440/390, bande de contrôle = `deriver().controles` + `avertissements`, mention « photo et contenus : visibles après enregistrement »).
- Modify: `next.config.ts` — ajouter **après** `{ source: '/(.*)', headers: enTetesSecurite }` : `{ source: '/apercu/:path*', headers: [{ key: 'Content-Security-Policy', value: <même CSP avec frame-ancestors 'self'> }, { key: 'Cache-Control', value: 'no-store' }, { key: 'X-Robots-Tag', value: 'noindex' }] }`. Fait vérifié le 25/09 (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` l. 47) : « the last header key will override the first ».
- Modify: `src/proxy.ts` — décision 13 : `/apercu` et `/apercu/*` hors plateforme → 404 (ancre : bloc `// 2. API : sur domaines communaux…`).
- Test: `tests/unit/apercu.spec.ts`, `tests/unit/proxy.spec.ts` (étendre), `tests/int/apercu-acces.int.spec.ts`, `tests/e2e/apercu.e2e.spec.ts`.

- [ ] **Step 1: Tests unitaires qui échouent** — `lireParametresApercu` : `principale=javascript:alert(1)` → valeur en base ; `gabarit=montagne` → en base ; `lang=xx` → `fr` ; `commune=1 OR 1=1` → `null` ; couleurs valides retenues en minuscules (I29). Proxy : `GET /apercu/apparence` sur un domaine communal → 404 ; sur la plateforme → `next()`.
- [ ] **Step 2: Test d'intégration d'accès** (I28), en appelant la fonction de contrôle extraite de la page (`peutApercevoir(user, communeId): boolean` dans `src/lib/apercu.ts`) : anonyme → faux ; rédacteur de A → faux ; admin de B sur A → faux ; admin de A → vrai ; opérateur → vrai.
- [ ] **Step 3: Test e2e** — en-têtes **réellement servis** : `/apercu/apparence?commune=<A>` (connecté admin A) → `content-security-policy` contient `frame-ancestors 'self'`, `cache-control: no-store`, `x-robots-tag: noindex` ; une page publique → `frame-ancestors 'none'` inchangé. Anonyme → 404. HTML de l'aperçu ne contient pas la chaîne `javascript:` quand on la passe en paramètre (Review Focus 5).
- [ ] **Step 4: Implémenter** ; la page d'aperçu obtient l'utilisateur par `payload.auth({ headers: await headers() })` (vérifier la signature dans `node_modules/payload/dist/auth/operations/local/auth.d.ts` au déblocage) et `notFound()` si `!peutApercevoir`.
- [ ] **Step 5: Commit** — `"Apparence — onglet d'ajustement avec aperçu en direct (I28, I29)"`.

---

### Task 10: README, captures regardées, audit final (spec § 5)

**Statut : à faire (porte ouverte le 04/10).**

- [ ] **Step 1:** réécrire `README.md` § « Accessibilité (RGAA) » (l. 167-182 le 25/09) : retirer la consigne de vérifier le contraste à la main (« Une couleur trop claire… vérifier avant d'activer la commune ») ; dire ce que garantit la dérivation (I24, I25), ce qu'elle ne garantit pas (une couleur **forcée**), et garder la phrase « seule une recette manuelle (grille RGAA officielle) fait foi ».
- [ ] **Step 2:** captures Playwright de l'accueil, 1440 et 390, par gabarit × 2 jeux de couleurs très différents (`#2a7f9e/#f2b134/#d2462f` et `#9b3d57/#7fc4c9/#e08a2c`, ceux des maquettes) × avec et sans photos = 16 captures, montées en planche-contact ; **les regarder** et les montrer à l'utilisateur avant fusion.
- [ ] **Step 3:** lancer la suite de conformité (`gabarits-conformite.e2e.spec.ts`) contre un **build de production** (`npm run build` puis `next start`) : l'égalité des scripts entre accueil et page intérieure (I27, point 2) y est vérifiée **sans le filtre des chunks** — les noms de chunks sont stables en prod, contrairement au dev turbopack qui les nomme par route (mesuré en tâche 4 : les deux listes filtrées sont vides en dev). Axe et contrastes y sont aussi mesurés dans les conditions réelles.
- [ ] **Step 4:** `npm run lint && npm run typecheck && npm test` — sortie collée dans la PR.
- [ ] **Step 5: Commit** — `"README — accessibilité : ce que garantit la dérivation des couleurs"`.

---

## Couverture de la spec (auto-relecture)

| Spec | Tâche |
|---|---|
| § 1 champs, versions, droits, préremplissage, I4 | 2 |
| § 1 I23, I24 ; § 2 tableau, I25, forcées, harmonie, cas nommés, accords | 1 |
| § 2 alias des anciens noms, layout | 3 |
| § 1 I30, changement de gabarit ; § 3 sections, texte libre, textes fixes, I26, I27 | 4, 5, 8 |
| § 3 cadrages d'image, régénération | 6 |
| § 3 frise (composition, aperçu admin, rendu public) | 4, 7 |
| § 4 onglet, aperçu, I28, I29, en-têtes | 9 |
| § 5 README, captures, axe | 4, 10 |
| § 6 contrat, suite de conformité, I31 | 4 |

Points de la spec **non couverts, volontairement** : ceux de sa section « Hors périmètre » et « Ce qui est hors de ce lot » (§ 6).
