# Notes QC — tâche 3 : le layout injecte `deriver()` ; anciens noms en alias

Exécutée les 04 et 05/10/2026 dans le worktree `~/Projects/glm.gabarits`, branche
`gabarits-couleurs`. Quatre commits :

- `0bb4a20` « Communes — l'admin lit l'historique de sa commune (décision 16) » — reste de la tâche 2 (partie A du brief) ;
- `3cf5dbe` « Plan gabarits-couleurs — tâche 3 : les alias vivent sur body, pas :root » — correctif au plan, à part (règle « ancre déplacée ») ;
- `acda186` « Couleurs — le site public sert les variables dérivées (I23), anciens noms en alias » — tâche 3 (partie B) ;
- `2ddbb24` « Communes — historique : collections est optionnel dans Config (typecheck) » — correctif de typage révélé par le typecheck final (voir Écarts, n° 4).

## A — Reste de la tâche 2 : historique des versions (décision 16)

La mesure de départ est celle de `docs/qc/bloque-tache-02.md` (lue, non
modifiée). Conformément à la décision 16 :

1. **Test réécrit à sa forme voulue d'abord** (`tests/int/communes-apparence.int.spec.ts`,
   dernier test du `describe('droits')`) : l'admin de A lit `totalDocs > 0`
   pour A et 0 pour B ; rédacteur et mandataire refusés (helper `refusAcces`,
   403) ; l'opérateur lit les deux. **Vu échouer** :

```
 ❯ tests/int/communes-apparence.int.spec.ts (24 tests | 1 failed) 2228ms
     × versions : l’admin de A lit celles de A et aucune de B ; rédacteur et mandataire refusés ; l’opérateur lit tout 6ms
AssertionError: expected 0 to be greater than 0
 ❯ tests/int/communes-apparence.int.spec.ts:737:31
   735|       overrideAccess: false,
   736|     })
   737|     expect(siennes.totalDocs).toBeGreaterThan(0)
```

2. **Plugin local dans `src/payload.config.ts`**, après `multiTenantPlugin` dans
   `plugins` : `historiqueCommunes` remplace `access.readVersions` de la
   collection `communes` par `lireVersionsCommune` — opérateur → `true` ;
   sinon `communesAvecRole(req.user, 'admin')` → `{ parent: { in: ids } }` ;
   sinon `false`. Vérifié dans le code du plugin (`withTenantAccess.js`,
   `addCollectionAccess.js`) : l'enveloppement se fait au moment du traitement
   de la config, un plugin placé après écrase bien la fonction enveloppée ;
   `useTenantsCollectionAccess` n'est pas touché (`read`, `update`, `delete`
   restent enveloppés). Même grain et même forme que l'accès `update` de
   `Communes.ts`.
3. **Test repassé** : `Tests 24 passed (24)` (sortie complète en Vérifications
   finales via la suite entière).

## B — Tâche 3 : layout + alias

**Ancres re-vérifiées d'abord** (étape préliminaire du plan) :

- le layout qui posait `<body style={{ '--couleur-principale': … }}>` est
  bien `src/app/(frontend)/[lang]/layout.tsx` (l. 66-82 avant édition) — le
  déplacement par le multilingue était anticipé par la tâche, pas de
  correctif au plan pour cette ancre ;
- `styles.css` `:root` l. 5-15 : les quatre valeurs citées y étaient
  (`--couleur-principale: #264653`, `--couleur-accent: #264653`,
  `--couleur-fond-alt: #f6f6f6`, `--couleur-erreur: #b3261e`) ;
- `styles.css` l. 289-290 : `background: var(--couleur-accent); color:
  var(--couleur-texte-blanc)` (`.bouton--primaire:hover`). Seule autre paire
  `--couleur-accent` : l. 464, une bordure sans texte — laissée telle quelle.

Guide Next relu avant d'écrire le code (`node_modules/next/dist/docs/` :
`01-getting-started/03-layouts-and-pages.md` et `11-css.md`) : import de CSS
global depuis un layout et style inline inchangés dans cette version.

**Étape 1-2 — test e2e écrit et vu échouer** (`tests/e2e/couleurs.e2e.spec.ts`,
commune de démonstration `saint-ex`, même base que `frontend.e2e.spec.ts`) :
`--principale-sure` lue sur `getComputedStyle(document.body)`, alias résolu
sur un lien, puis patch admin `couleurPrincipale: '#7fc8a0'` →
`--principale-sure` = `#3c8460`. Échecs observés :

```
    Error: {"errors":[{"message":"Vous n’êtes pas autorisé à effectuer cette action."}]}
> 41 |     expect(communes.ok(), await communes.text()).toBe(true)   [avant correctif Origin, voir Écart n° 1]

    Error: expect(received).toBe(expected) // Object.is equality
    Expected: "#264653"
    Received: ""
    > 37 |     expect(await variableDuCorps(page, '--principale-sure')).toBe('#264653')

    Expected: "#3c8460"
    Received: ""
    > 65 |       expect(await variableDuCorps(page, '--principale-sure')).toBe('#3c8460')
```

**Étape 3 — implémentation** :

- `layout.tsx` : le bloc des deux couleurs saisies est remplacé par
  `deriver({ principale, accent, terre }, couleursForcees ?? {})` (extrait du
  plan, commentaire I23) et `<body style={variables as React.CSSProperties}>`.
- `styles.css` : les quatre valeurs littérales disparaissent de `:root` ;
  `--alerte: #b3261e` et `--alerte-texte: #ffffff` y sont posés (fixes,
  décision 5) ; les alias `--couleur-principale/--couleur-accent/
  --couleur-fond-alt/--couleur-erreur` vivent dans une règle `body {}` — voir
  Écart n° 2 ; `.bouton--primaire:hover` passe à
  `color: var(--texte-sur-accent)` comme demandé par le ⚠️ de l'étape 3.

**Étape 4** : e2e couleurs vert (2 passed), `focus.e2e.spec.ts` vert
(3 passed — anneau de focus inchangé), `test:unit` vert (154).

## Écarts au plan, avec motif

1. **Appels API du test e2e : en-tête `Origin` explicite.** Le plan dit
   « via l'API admin (helper `tests/helpers/login.ts`) » : le helper
   (connexion par le formulaire réel) est bien utilisé, mais la session
   (cookie `payload-token`) est refusée par la protection CSRF de Payload
   sans en-tête `Origin`, et le contexte `page.request` de Playwright n'en
   pose pas. Mesuré au serveur de dev (curl) : GET `/api/communes` avec
   cookie sans Origin → 403 « Vous n'êtes pas autorisé à effectuer cette
   action. » ; avec `Origin: http://localhost:3000` → 200. Le test pose donc
   `Origin` (calculée comme dans `playwright.config.ts` depuis `E2E_PORT`)
   sur ses trois appels API, en conservant la chaîne complète du formulaire.
2. **Alias posés dans une règle `body {}`, pas dans `:root`** (étape 3 du
   plan ; correctif au plan commité à part, `3cf5dbe`). Mesuré : dans
   `:root`, `var(--principale-sure)` ne se résout pas — la substitution se
   fait sur l'élément qui déclare l'alias, et les variables de `deriver()`
   sont inline sur `<body>` — le lien testé calcule `rgb(22, 22, 22)`
   (`--couleur-texte` héritée) au lieu de `rgb(38, 70, 83)`. Sortie de
   l'échec intermédiaire :

```
    Expected: "rgb(38, 70, 83)"
    Received: "rgb(22, 22, 22)"
```

   Posés sur `body`, les alias voient l'inline et le test passe. Aucune
   décision du plan n'est remise en cause (les alias existent, alimentés par
   `deriver()` ; les fixes restent dans `:root`).

3. **Lien épinglé : `.entete-site__titre`.** Le plan dit « un lien »
   (`getComputedStyle(a).color`) : le premier `a` du DOM est le lien
   d'évitement, blanc par design (`rgb(255, 255, 255)`, mesuré). Le titre de
   l'en-tête est un lien sans règle de couleur propre, il prend bien
   `--couleur-principale`.
4. **`config.collections?.find(…)`** dans le plugin de la partie A : le type
   `Config` de Payload marque `collections` optionnel. La première version
   (commit `0bb4a20`) passait les tests d'intégration mais échouait au
   typecheck final (`TS18048: 'config.collections' is possibly 'undefined'`).
   Corrigé par `2ddbb24`. Leçon : typecheck dès qu'on touche `payload.config.ts`.
5. **Lancement d'un seul fichier de test** : `npm run test:int -- <fichier>`
   n'a pas l'effet attendu (le script ajoute `tests/int` en filtre
   positionnel, vitest fait un OU → 23 fichiers lancés). Fichier seul via
   `npx cross-env NODE_OPTIONS=--no-deprecation vitest run --config
   ./vitest.config.mts tests/int/communes-apparence.int.spec.ts`.

## Incident d'environnement (sans effet sur le rendu)

Le lancement initial élargi (voir Écart n° 5) a fait échouer
`communes-apparence.int.spec.ts` dans son `beforeAll` :
`ValidationError: Le champ suivant n'est pas valide : siret` — collision du
SIRET `'32000000000002'` avec `tests/int/lignes-mandat.int.spec.ts`, exécutés
en parallèle sur `pdlm_test_gabarits`. L'`afterAll` interrompu y laissé un
utilisateur `operateur@apparence.pdlm.invalid`, supprimé à la main
(`DELETE FROM users WHERE email = 'operateur@apparence.pdlm.invalid'`,
1 ligne). La suite complète est ensuite passée du premier coup, sans
relance. Ces deux specs partagent le même SIRET : collision latente
préexistante, hors périmètre de cette tâche, signalée ici pour mémoire.

## Vérifications finales (sorties réelles, collées telles quelles)

```
$ npm run typecheck
> pdlm@0.1.0 typecheck
> tsc --noEmit
— aucune sortie, 0 erreur

$ npm run lint
✖ 50 problems (2 errors, 48 warnings)
  — les 2 erreurs : .superpowers/sdd/2026-09-25-gabarits-couleurs/probe-review.ts
    (44:3, 'maxIter') et probe-review2.ts (22:3, 't0'), sondes connues du
    plan ; 0 erreur dans src/ et tests/

$ npm run test:unit
 Test Files  22 passed (22)
      Tests  154 passed (154)

$ npm run test:int
 Test Files  23 passed (23)
      Tests  217 passed (217)
      [première passe, pas de relance nécessaire ; dont les 24 de
       communes-apparence.int.spec.ts avec le test versions réécrit]

$ npm run test:e2e -- couleurs
  2 passed (13.4s)

$ npm run test:e2e -- focus
  3 passed (3.0s)

$ git status --short
— vide
```

## Ce que je n'ai pas pu vérifier

- **L'onglet « Versions » dans l'UI admin** (ce que voit un admin de commune
  sur la fiche) : la décision 16 est éprouvée par l'API locale
  (`findVersions`, `overrideAccess: false`), pas par un parcours navigateur
  de l'admin — il n'existe pas de test e2e admin sur les versions.
- **Les 14 variables du contrat une par une en e2e** : le plan (étape 1)
  n'exigeait que `--principale-sure` et l'alias sur un lien ; les autres
  variables le sont en unitaire (`tests/unit/couleurs.spec.ts`, inchangé).
- **Aucune capture d'écran ni mesure visuelle** : rien de demandé à cette
  tâche (les captures arrivent avec les gabarits, tâches 5 et suivantes).
- **Le rendu sur une commune réellement personnalisée en base** : l'e2e
  patche puis restaure la commune du seed ; aucun état personnalisé durable
  n'a été laissé dans `pdlm_gabarits_dev`.
