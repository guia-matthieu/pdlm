# Bloqué — tâche 10 : la suite conformité ne peut pas tourner contre un build de production en local

Découvert le 15/10/2026 à l'étape 3 du brief (rejouer
`tests/e2e/gabarits-conformite.e2e.spec.ts` contre un build servi par
`next start`, avec le filtre `E2E_PROD=1`). Conformément à la consigne, rien
n'a été corrigé : le comportement qui bloque n'est d'ailleurs ni un bug, ni
l'œuvre des tâches 1 à 9 — c'est l'invariant I6 du socle (pas de commune de
substitution en production), antérieur au plan. Ce document trace la mesure,
les équivalences livrées et les options ; l'exécution de la tâche a continué
sur ses étapes indépendantes.

## Ce que j'ai mesuré

Deux échecs successifs, chacun sourcé dans le code avant toute conclusion.

### Premier échec : 403 sur l'API (corrigé sans toucher au code)

Serveur démarré par `npm run start` (donc `NODE_ENV=production`), puis :

```
$ E2E_PROD=1 E2E_PORT=3005 npx playwright test gabarits-conformite
  2 failed — l. 185 : PATCH /api/communes/1 → 403 « Vous n'êtes pas autorisé
  à effectuer cette action. » ; l. 204 : afterAll en cascade — 12 did not run
```

Cause lue dans le code. En production, `csrf` ne vaut que `ADMIN_URL`
(`src/payload.config.ts` l. 57-61 : `DEV = NODE_ENV !== 'production'`,
`originesAutorisees = [ADMIN_URL, …(DEV ? ['http://localhost:3000'] : [])]`,
l. 106-107 `cors`/`csrf`). Payload n'extrait le cookie `payload-token` que si
l'origine de la requête figure dans `csrf`
(`node_modules/payload/dist/auth/extractJWT.js` l. 18-37) ; le serveur tournait
avec un `ADMIN_URL` de production, pas `http://localhost:3005`, donc le cookie
de la suite était ignoré et l'accès rendait false.

Correction : `ADMIN_URL` n'est lu qu'au démarrage (`src/payload.config.ts`
l. 59 ; `src/proxy.ts` l. 40 ; `src/collections/Communes.ts` l. 85 — aucun
`NEXT_PUBLIC_*`, pas d'inlining au build). Le serveur a été relancé avec
`ADMIN_URL=http://localhost:3005` en variable de processus, le `.env` restant
intact. Après quoi le `beforeAll` passe : ce premier échec n'est pas un
blocage, il est tracé ici pour la recette du premier déploiement (le `403`
silencieux « user null » est le symptôme attendu d'un `ADMIN_URL` mal réglé).

### Second échec : 404 sur le front public (le blocage)

Même serveur corrigé, suite relancée :

```
$ E2E_PROD=1 E2E_PORT=3005 npx playwright test gabarits-conformite
  2 failed — l. 244 : expect(reponse?.status()).toBe(200) après page.goto('/')
  — 12 did not run
```

L'URL de la suite est `http://localhost:3005/` (`playwright.config.ts` l. 23 :
`const BASE_URL = \`http://localhost:${PORT}\`` — le host n'y est pas
paramétrable par variable d'environnement). Or, mesuré sur ce même serveur :

```
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/
  404
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/fr
  404
```

Cause lue dans le code — comportement voulu du socle, I6 :

- `src/lib/commune.ts` l. 46-50 : un host local nu (`localhost`,
  `127.0.0.1`…) rend `null` en production ; le fallback
  `DEFAULT_COMMUNE_SLUG` est réservé au développement (l. 38 : « jamais en
  production »).
- `src/proxy.ts` l. 17-29 : sans `PLATFORM_DOMAIN`, `estDomainePlateforme`
  répond false partout en production — le mode dégradé est refusé à dessein.

Aucune commune n'est donc résolue sur `localhost` en production : chaque
`page.goto('/')` de la suite renvoie 404. La résolution par sous-domaine de
plateforme, elle, marche en production (constaté ci-dessous) — mais y pointer
`BASE_URL` demanderait de modifier `playwright.config.ts`, hors de la liste
des fichiers que le brief autorise.

## Ce qui a été vérifié quand même en production

Même serveur (`ADMIN_URL=http://localhost:3005 PLATFORM_DOMAIN=localhost
npm run start -- --port 3005`), mesures par curl :

- Page publique via sous-domaine de plateforme : `curl -H 'Host:
  saint-ex.localhost' http://127.0.0.1:3005/` → **200** ;
  `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`,
  CSP `frame-ancestors 'none'`, réécriture vers `/racine` par le proxy.
- Aperçu opérateur : `/apercu/apparence?commune=1` avec cookie et `Origin`
  autorisé → **200**, `Cache-Control: no-store`, `X-Robots-Tag: noindex`,
  CSP `frame-ancestors 'self'` ; sans cookie, avec ou sans paramètre → 404
  avec les mêmes en-têtes — I28 tenu.
- **I27 mesuré à la main** — le contrôle exact que `E2E_PROD` devait
  produire (égalité de tous les scripts, chunks compris) :

```
$ curl -s -H 'Host: saint-ex.localhost' http://127.0.0.1:3005/ \
    | grep -o '<script src="[^"]*"' | sort > /tmp/t10-scripts-accueil.txt
$ curl -s -H 'Host: saint-ex.localhost' http://127.0.0.1:3005/actualites \
    | grep -o '<script src="[^"]*"' | sort > /tmp/t10-scripts-actus.txt
$ diff /tmp/t10-scripts-accueil.txt /tmp/t10-scripts-actus.txt && echo IDENTIQUES
  (aucune sortie de diff)
  IDENTIQUES
$ wc -l /tmp/t10-scripts-accueil.txt
  7 — tous sous /_next/static/chunks/, dont turbopack-0u9g73elxfcgm.js
```

L'accueil n'ajoute aucun script par rapport à une page intérieure, en build
de production, chunks compris. Il manque à cette équivalence : les 14 tests
restants de la suite (thème.css, ordre des sections, focus…) joués en prod
par Playwright.

## Options

1. **Paramétrer le host dans `playwright.config.ts`** (l. 23, p. ex.
   `E2E_HOST ?? 'localhost'`) et jouer la suite en prod sur un sous-domaine
   (`saint-ex.localhost`, `PLATFORM_DOMAIN=localhost`). Le sous-domaine se
   résout en dev comme en prod (`src/lib/commune.ts` l. 58-71, sans garde
   `NODE_ENV`), mais il faut vérifier que les 16 tests passent tous sur ce
   host (langues, chemins internes). Modification hors périmètre du brief —
   décision à Matthieu.
2. **Jouer la conformité en prod au premier déploiement réel**, sur un
   domaine communal : le filtre `E2E_PROD` est déjà en place dans le test
   (`tests/e2e/gabarits-conformite.e2e.spec.ts` l. 266-284), il suffira de
   `E2E_PROD=1` contre le `BASE_URL` réel.
3. **S'en tenir aux équivalences ci-dessus** (API, en-têtes, I27 complet à la
   main) — la suite conformité reste jouée en dev à chaque passage, comme
   aujourd'hui.

## Recommandation

L'option **2** porte la garantie complète au premier déploiement réel, où le
404 local disparaît de lui-même (domaine communal résolu en base, I6) ; rien
n'est perdu à attendre puisque I27 en production est déjà prouvé à la main
ci-dessus. L'option 1 est la bonne commodité locale si la suite doit tourner
en prod avant ça — un petit diff dans `playwright.config.ts`, à décider au
prochain passage. Dans les deux cas, **rien à changer dans `src/`** : le
blocage vient d'un invariant voulu (I6) et d'un fichier de configuration de
test hors périmètre, pas des tâches 1 à 9.
