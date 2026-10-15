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

## Commit 4 — `Aperçu — en-têtes spécifiques : encadrable, jamais en cache ni indexé`

### Test d'abord, vu rouge

`tests/e2e/apercu.e2e.spec.ts` créé (3 cas) : anonyme → 404 pour un identifiant réel de commune existante (le refus vient de l'accès, pas d'un document absent) ; admin → 200 sur `/apercu/apparence?commune=…&accent=%23ABCDEF` avec les en-têtes servis (`frame-ancestors 'self'`, cache, indexation), le contenu (`/gabarits/village/theme.css` du seed, `--accent:#abcdef` — l'accent traverse `deriver()` tel quel, contrairement aux dérivées) et l'absence de `javascript:` dans le document ; page publique → `frame-ancestors 'none'` conservé. Premier passage :

```
$ npm run test:e2e -- apercu
  1 failed
  ✕ 2 [chromium] › apercu.e2e.spec.ts:53 › admin : …
    → Expected: containing "frame-ancestors 'self'"
      Received string: "default-src 'self'; … frame-ancestors 'none'; …"
```

### Code

`next.config.ts` : `enTetesSecurite` devient une fonction `(frameAncestors: "'none'" | "'self'") => [...]` ; `headers()` rend l'entrée générale `/(.*)` puis une entrée `/apercu/:path*` — après la générale (« the last header key will override the first », headers.md), avec la matrice complète répétée (ne pas compter sur une fusion des clés absentes) plus `Cache-Control: no-store` et `X-Robots-Tag: noindex`.

### Écarts, motifs

- **Assertion `cache-control` assouplie** (`['no-store', 'no-cache, must-revalidate']` au lieu de `no-store` strict) : le e2e tourne en dev, où Next pose toujours `no-cache, must-revalidate` sur les réponses rendues (`node_modules/next/dist/server/base-server.js:1107`, bloc `if (this.dev)` — restauration bfcache back/forward), écrasant l'entrée de config. En production celle-ci s'applique : les poses par défaut y sont cantonnées à des chemins spéciaux (middleware-prefetch base-server.js:1312, 404 sous-ressource :1361, renderError :1732), et une page dynamique comme celle-ci (elle lit `headers()` et `searchParams`) est rendue `private, no-cache, no-store, max-age=0, must-revalidate` (`node_modules/next/dist/server/lib/cache-control.js:15`, `revalidate === 0`) — `no-store` servi par les deux chemins. L'assertion resterait rouge si l'en-tête disparaissait.
- **Relevé des en-têtes par curl, incident sans incidence code** : la première tentative rendait 404 malgré une session valide (`/api/users/me` l'acceptait). Cause trouvée fichier en main : `extractJWT` (méthode cookie, `node_modules/payload/dist/auth/extractJWT.js`) rejette les requêtes sans `Origin` NI `Sec-Fetch-Site` — « Reject cross-site requests and missing header (non-browser clients) » : le token est ignoré, `payload.auth` rend `user: null`, la page applique I28 et répond 404. Comportement CSRF voulu de Payload, pas un défaut de la page (Chromium envoie `Sec-Fetch-Site: none` en navigation directe). Le relevé ci-dessous est fait avec `Sec-Fetch-Site: none`.

### En-têtes réellement servis (dev, 15/10)

`/apercu/apparence?commune=1&accent=%23ABCDEF` (200, session admin saint-ex) :

```
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'
Cache-Control: no-cache, must-revalidate        ← dev : voir écart ci-dessus
X-Robots-Tag: noindex
```

`/` (200, anonyme) :

```
HTTP/1.1 200 OK
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Cross-Origin-Embedder-Policy: require-corp
Cross-Origin-Opener-Policy: same-origin
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Cache-Control: no-cache, must-revalidate
```

La page publique garde `frame-ancestors 'none'` et ne reçoit pas `X-Robots-Tag` : l'entrée spécifique ne fuit pas sur le reste du site.

### Fichiers générés

Le serveur dev lancé pour le relevé a régénéré `src/app/(payload)/admin/importMap.js` **incomplet** (entrées admin disparues — FriseApercu, multi-tenant, Lexical…). Non modifié par moi : restauré par `git checkout --`. Aucun autre fichier généré touché (`src/payload-types.ts` intact ce coup-ci).

### Vérifications

```
$ npm run test:e2e -- apercu
  3 passed (18.6s)
$ npm run typecheck
  (aucune sortie d'erreur)
$ npx eslint tests/e2e/apercu.e2e.spec.ts src/proxy.ts next.config.ts
  (aucune sortie — 0 erreur, 0 warning)
```

