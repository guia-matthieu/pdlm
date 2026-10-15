# Notes QC — tâche 9 : Onglet d'ajustement avec aperçu en direct

> **Qui a écrit ces notes.** Session d'exécution GLM (15/10/2026), brief `~/Projects/guia/tasks/2026-10-15_brief-glm-gabarits-tache9.md`. Écrites au fil des commits. Tâche 9 du plan `docs/superpowers/plans/2026-09-25-gabarits-couleurs.md`, branche `gabarits-couleurs` partie de `7e9aa5a`.

## Ancres du 15/10 — pas de commit « ancres »

Toutes vérifiées conformes au brief, aucune n'a bougé :

- `src/app/(apercu)/` n'existait pas ; `next.config.ts` : une seule entrée `headers()` (`{ source: '/(.*)', headers: enTetesSecurite }`, l. 65), `frame-ancestors 'none'` l. 48 ;
- onglet « Apparence » sans `name` dans `src/collections/Communes.ts` (l. 384-389) ; `payload.auth` = `authLocal(payload, options)` avec `AuthArgs.headers: Request['headers']` (`node_modules/payload/dist/auth/operations/auth.d.ts` l. 3-8) ;
- `tests/unit/proxy.spec.ts` existant (étendu) ; `tests/unit/apercu.spec.ts`, `tests/int/apercu-acces.int.spec.ts`, `tests/e2e/apercu.e2e.spec.ts` absents (créés).

Guides Next lus avant d'écrire : `node_modules/next/dist/docs/route-groups.md` (groupes à layout racine propre, conflits de chemins) et `headers.md` (« Header Overriding Behavior : the last header key will override the first » — l'entrée `/apercu/:path*` placée après `/(.*)` remplace sa CSP).

## Commit 1 — `Aperçu — paramètres validés et règle proxy /apercu (I29)`

### Test d'abord, vu rouge

`tests/unit/apercu.spec.ts` créé et `tests/unit/proxy.spec.ts` étendu (describe « aperçu d'apparence (décision 13) » : 404 sur domaine communal pour `/apercu` et `/apercu/apparence` ; sur la plateforme, `next()` sans réécriture). Sortie du premier passage :

```
$ npm run test:unit -- tests/unit/apercu.spec.ts tests/unit/proxy.spec.ts
 Test Files  2 failed | 29 passed (31)
      Tests  2 failed | 278 passed (280)
```

(apercu.spec.ts ne s'importe pas — module inexistant ; le cas plateforme échoue car le proxy réécrit `/apercu/apparence` vers `/racine/…`. Le filtre après `--` ne s'applique pas : le script `test:unit` passe déjà `tests/unit` en argument, vitest unionne les deux chemins et rend la suite entière — 31 fichiers. Constaté ici, utilisé comme tel.)

### Code

`src/lib/apercu.ts` (partie pure) :

- `idCommune(params)` : entier décimal strict (`/^\d+$/`), sûr et > 0, sinon `null` ;
- `lireParametresApercu(params, enBase)` : couleurs au format I24 rendues en minuscules, toute invalide remplacée par la valeur en base (I29) ; forcées hors format ignorées → valeur en base (décision 6) ; gabarit et langue sur listes closes (`Object.keys(GABARITS)`, `estCodeLangue`), `lang` hors liste → `fr` ; `params.get()` rend la première occurrence, un paramètre répété ne fait jamais passer la seconde.

`src/proxy.ts` : bloc « 3. Aperçu de l'apparence » entre le bloc API et les statiques — 404 hors domaine de la plateforme (décision 13), `next()` anticipé sur la plateforme. **Écart, motif** : ce `next()` anticipé est nécessaire ; sans lui le bloc front-public réécrirait `/apercu/apparence` en `/racine/apercu/apparence` (le test « sans réécriture de langue » l'a prouvé rouge avant le code) et la route `(apercu)` ne serait jamais servie. Le plan décrivait le 404 (décision 13) mais pas cette exemption de réécriture. Les blocs suivants renumérotés 4 et 5.

Ajout mineur non prévu par le plan : l'export `idCommune`, séparé de `lireParametresApercu`, parce que la page doit filtrer l'identifiant avant tout accès à la base (I28 avant I29).

```
$ npm run test:unit -- tests/unit/apercu.spec.ts tests/unit/proxy.spec.ts
 Test Files  31 passed (31)
      Tests  297 passed (297)
```

## Commit 2 — `Aperçu — contrôle d'accès peutApercevoir (I28)`

### Test d'abord, vu rouge

`tests/int/apercu-acces.int.spec.ts` créé sur le modèle de `communes-apparence.int.spec.ts` (helpers `creerCommuneActive`/`supprimerCommuneTest`, `purger` par critères, SIRET propre `35000000000005`). Les six cas : anonyme, rédacteur de A, admin de B sur A, admin de A, opérateur, mandataire de A (décision 15). Le mandataire est **créable** : organisation + mandat + agent portant le champ `organisation` (même construction que `communes-apparence.int.spec.ts` l. 570-593) — le rôle se calcule au read, il ne se pose pas dans `tenants`.

```
$ npx vitest run --config ./vitest.config.mts tests/int/apercu-acces.int.spec.ts
 Test Files  1 failed (1)
      Tests  6 failed (6)
```

### Code

`peutApercevoir(user, communeId)` dans `src/lib/apercu.ts` : opérateur → vrai, sinon `aRoleSur(user, communeId, 'admin')` (spéc I28 : le contrôle de rôle est la garantie).

```
$ npx vitest run --config ./vitest.config.mts tests/int/apercu-acces.int.spec.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**Fichiers générés** : le run int a régénéré `src/payload-types.ts` **sans** les champs S3 (lignes `prefix`/`_objectKey` disparues de Media et Document — le run int tourne sans `S3_ENABLED`). Restauré tel quel par `S3_ENABLED=true npm run generate:types` (diff vide ensuite). Aucun autre fichier généré touché.

## Commit 3 — `Aperçu — page /apercu/apparence, l'accueil composé avec les paramètres`

Pas de test nouveau prévu par le plan pour la route elle-même (les e2e arrivent aux commits 4 et 5). Vérifications de ce commit : `npm run typecheck` (0 erreur) et `npx eslint "src/app/(apercu)"` (0 erreur, 0 warning).

### Code

`src/app/(apercu)/layout.tsx` : layout racine du groupe (route-groups : un groupe peut porter son propre layout racine, pas de conflit de chemins — `/apercu/apparence` statique bat `[lang]/[slug]` dynamique). `<html lang="fr">`, `<body>` nu, import de `(frontend)/styles.css`, titre « Aperçu de l'apparence ».

`src/app/(apercu)/apercu/apparence/page.tsx`, dans l'ordre :

1. `searchParams` (Promise) → `URLSearchParams` par `append` (ordre des occurrences conservé, `get()` rend la première) ;
2. I28 avant tout accès aux données : `idCommune` null → `notFound`, puis `payload.auth({ headers: await headers() })` (méthode de la classe Payload, `node_modules/payload/dist/index.d.ts:248` ; `ReadonlyHeaders` est un `Headers` — `next/dist/server/web/spec-extension/adapters/headers.d.ts:2`), `peutApercevoir` faux → `notFound` (404 uniforme, l'aperçu « n'existe pas » pour qui n'y a pas droit) ;
3. `findByID({ collection: 'communes', overrideAccess: true })`, depth par défaut — la même lecture que le front public (`src/lib/commune.ts` l. 133-136) ;
4. `lireParametresApercu` puis `deriver` (I23 : recalculé au rendu) ;
5. copie de la commune, apparence remplacée par les paramètres validés, servie à `Accueil` (qui relit gabarit et contenus depuis `commune.id`, inchangé) ;
6. `<div class="canevas-apercu" lang style={variables}>` + `<link precedence="gabarit">` (hissé dans le `<head>` par React) + preloads polices, comme le layout public.

### Écarts, motifs

- **`.canevas-apercu` ajouté au sélecteur d'alias de `styles.css`** (l. 24-37) : le plan posait les variables sur un div de la page, mais les alias `--couleur-principale` etc. sont déclarés sur `body` et « la substitution var() se résout sur l'élément qui déclare l'alias » (commentaire du fichier) — sur un div, les liens et blocs de l'aperçu hériteraient d'alias vides. Étendre le sélecteur garde une seule source pour les alias ; la classe n'est portée que par le canevas d'aperçu. Aucune couleur ajoutée (règle existée, sélecteur étendu).
- **`gabarit: apercu.gabarit as NomGabarit`** : la lib retourne `string` (liste close vérifiée par `Object.hasOwn(GABARITS, …)`), le type de `Commune.apparence.gabarit` est l'union — un cast commenté à l'endroit exact.
- **`lien` = identité** : la navigation dans l'iframe de l'aperçu n'a pas de sens (les liens de l'accueil ne mènent nulle part sous le domaine de la plateforme) ; l'admin agit dans l'onglet Apparence. Commentaire dans le code.
- **Commune inactive** : l'aperçu ne vérifie pas `actif` — le site public d'une commune inactive répond 404 (`commune.ts` l. 141), mais son admin doit pouvoir ajuster l'apparence avant réactivation. Le plan ne tranchait pas ; retenu : l'aperçu est un outil d'admin, l'accès reste cadré par I28.

