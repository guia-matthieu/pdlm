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
