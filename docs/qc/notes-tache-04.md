# Notes QC — tâche 4 : moteur de gabarits, sections communes, accueil composé et suite de conformité

Exécutée les 05/10/2026 (matin : session interrompue par le quota ; reprise
16h35–17h) dans le worktree `~/Projects/glm.gabarits`, branche `gabarits-couleurs`.
Six commits depuis l'ancre `6484725`, dont ces notes (mesure du relecteur : sur
`549f629` plus le fichier de test non commité) :

- `ce7c9a0` « Gabarits — types du moteur et composerFrise (I30 : pièce hors kit
  ignorée et listée, jamais une erreur) » ;
- `94b991e` « Gabarits — sections communes, accueil composé, kit Village
  provisoire et contrat v1 (I26, I27, I30 ; décisions 17, 18) » ;
- `549f629` « Gabarits — suite de conformité e2e (I31) et h1 des tests existants
  suivent le héros du gabarit » ;
- `7b563f3` « Gabarits — la carte mairie ne se rend que si Mairie afficherait
  une donnée (I30) » — reprise, correctif `src/` révélé par le point 6 ;
- `b94e5a6` « Gabarits — point 6 de la conformité : coordonnées vidées champ
  par champ (payload #-null sur groupe) » — reprise.

## Ce qui a été fait

**Session 1 (interrompue)** : types du moteur (`src/gabarits/types.ts`) et
`composerFrise` (`src/gabarits/frise.ts`, pièce hors kit ignorée et listée,
testée en unitaire) ; sections communes (`src/gabarits/sections/*`), `Accueil.tsx`
composé selon `gabarit.accueil`, registre à un gabarit Village provisoire sans
`theme.css` propre (décision 18), `CONTRAT.md` v1 ; mise à jour de l'accueil de
la commune de démonstration (le héros vient du gabarit, plus de bloc hero dans
la page — idem Valvert, remplacé par un bloc texte riche fr + co) ; suite de
conformité e2e paramétrée par `Object.keys(GABARITS)` ; `h1` des suites
`frontend` et `multilingue` suivent le héros du gabarit. État mesuré par le
relecteur : typecheck 0, lint 0 erreur dans `src/` et `tests/`, 175 unitaires
verts, e2e 35 verts / 1 échec (point 6) / 2 non lancés (points 8, 9).

**Session 2 (reprise)** :

1. **Point 6 (« commune vide »)**. Relancé une fois tel quel pour lire la pile
   serveur (cf. Écarts n° 1) : l'erreur est dans `node_modules/payload`, pas
   dans `src/` → contournement dans le test, pas de correctif serveur. Mais le
   vidage des coordonnées (champ par champ) a révélé un vrai défaut `src/` :
   `carteMairie = commune.coordonnees || identite.horaires` était toujours vrai
   (un groupe Payload se lit toujours comme un objet, même tous champs vides),
   donc une commune sans coordonnées ni horaires rendait une section mairie
   réduite à son `<h2>` — un emplacement vide, contraire à I30. Corrigé dans
   `src/gabarits/Accueil.tsx` (la carte n'existe que si `Mairie` afficherait
   une donnée : téléphone, adresse ou courriel, sinon les horaires), vu échouer
   par le point 6 avant le correctif, vu passer après. Commune de démonstration
   restaurée par le `finally` du test et l'`afterAll` de la suite, vérifiée en
   base après le passage (`pdlm_gabarits_dev`) :

```
$ docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d pdlm_gabarits_dev -tAc \
  "SELECT (SELECT count(*) FROM communes_accueil_demarches d JOIN communes c ON d._parent_id=c.id WHERE c.slug='saint-ex') AS demarches, (SELECT count(*) FROM communes_accueil_mosaique m JOIN communes c ON m._parent_id=c.id WHERE c.slug='saint-ex') AS tuiles;"
6|4
```

   (Coordonnées revenues vides comme dans le grain : le grain ne les définit
   pas ; `origine.coordonnees` lu par l'API est l'objet tous champs nuls, jamais
   `null`, donc la restauration de l'`afterAll` ne replantera pas le 500.)

2. **Points 8 et 9** : passés sans changement (le point 8 passe à vide tant que
   `polices/` n'existe pas — décision 18). Captures regardées (pages complètes,
   héros illustré, sections remplies, une colonne à 390) :

```
test-results/gabarits/village-1440.png  225 004 octets
test-results/gabarits/village-390.png   212 564 octets
```

3. **Point 2 (filtre des chunks)** : les deux listes filtrées affichées une
   fois (log temporaire retiré après mesure) — **elles sont vides toutes les
   deux**. Le test ne prouve plus rien de plus que « aucune des deux pages ne
   charge un script hors chunks Next » ; voir Écarts n° 3 et la proposition.

4. **Vérifications finales** (une fois chacune, sorties ci-dessous) : toutes
   vertes. `test:int` est passé du premier coup (pas de « already exists »).

## Choix faits (que le plan ne tranchait pas)

- **Appels API depuis le navigateur** (`page.evaluate` + `fetch` avec cookie de
  session), comme `couleurs.e2e.spec.ts` : la protection CSRF de Payload
  n'accepte nos en-têtes que côté navigateur.
- **Contrastes mesurés dans la page rendue** (point 5) : luminance relative
  calculée depuis `getComputedStyle`, premier fond opaque des ancêtres
  (décision 17 — une photo ne compte pas), seuil 4,5 / 3 pour le texte large ;
  le calcul vit dans le test, pas dans `src/`.
- **Le point 6 vide les liens des démarches, pas leurs lignes** : la commune
  garde 6 démarches et 4 tuiles en base (données par `defaultValue` sur la
  collection) ; « commune vide » veut dire « commune qui démarre », le grain ne
  la vide pas non plus.
- **La section texte libre exige une page « accueil » avec au moins un bloc**
  (`page.blocs?.length > 0`) : une page sans bloc ne rend pas un emplacement.
- **`h1` des suites existantes** (`frontend`, `multilingue`) déplacé sur le
  héros du gabarit : l'accueil composé a déplacé le `h1` dans le héros.

## Écarts au plan

1. **`coordonnees: null` → 500, contourné champ par champ** (point 6). Pile
   relevée sur `PATCH /api/communes/1` (lignes `[WebServer]`) :

```
TypeError: Cannot read properties of null (reading 'adresse')
    at promise (…/node_modules/payload/dist/fields/hooks/beforeValidate/promise.js:182:31)
    at traverseFields (…/node_modules/payload/dist/fields/hooks/beforeValidate/traverseFields.js:6:12)
    …
    at async updateByIDOperation (…/payload/dist/collections/operations/updateByID.js:175:22)
```

   Ligne fautive : `promise.js:182`, `siblingData[field.name]` avec
   `siblingData = null` lors du parcours d'un groupe mis à `null` — code de
   Payload 3.90, pas de `src/`. Donc neutralisation de chaque sous-champ
   (`COORDONNEES_NULLES` / `COORDONNEES_DEMO` dans le test), pas de correctif
   serveur ni de test d'intégration dédié (la règle du brief ne s'appliquait
   que si la pile pointait dans `src/`). Le contournement reste mesuré : un
   PATCH `coordonnees: null` fera 500 tant que le bug vivra.
2. **Correctif `src/` non prévu** (commit `7b563f3`, ci-dessus) : le plan
   n'avait pas de défaut connu dans `Accueil.tsx` ; motif : I30 l'exige et le
   point 6 l'a montré.
3. **Point 2 : égalité des scripts filtrée des chunks `/_next/static/chunks/`,
   et les deux listes filtrées sont vides**. En dev, turbopack nomme ses chunks
   par route (un nom diffère entre `/` et `/actualites`) : l'égalité brute du
   plan est infaisable en dev. Mesuré (05/10, 16h46) :

```
SCRIPTS ACCUEIL []
SCRIPTS ACTUS []
```

   **Le test ne prouve plus rien sur les chunks** : il prouve seulement
   qu'aucun script hors chunks n'apparaît sur l'une ou l'autre page (un
   `<script src="/carrousel.js">` ajouté par un gabarit échouerait encore, et
   un script d'un autre domaine est déjà attrapé par le contrôle « rien hors
   de l'origine » du même test). **Proposition pour prouver I27 autrement** :
   refaire l'égalité *sans filtre* sur un build de production (`npm run build`
   + `next start`), où les noms de chunks sont stables par page — soit une
   suite e2e dédiée lancée sur le build (une par gabarit, tâche 5 ou recette
   de déploiement), soit à minima une vérification manuelle au premier
   déploiement réel, consignée. Ne pas maquiller le test dev : il garde le
   filtre et son commentaire.
4. **Points 1 et 2 en un seul test** : la mesure « rien hors de l'origine » et
   l'égalité des scripts partagent la même navigation ; les points 3 à 9
   restent un test chacun, numérotés comme le plan.
5. **Le grain de la commune de démonstration change** (session 1, commit
   `94b991e`) : plus de bloc hero dans la page « accueil » (le héros vient du
   gabarit, sinon doublon) ; Valvert passe de hero à texte riche. Motif :
   conséquence directe de l'accueil composé, pas de réouverture d'une décision.

## Vérifications (sorties telles quelles, 05/10 16h47–16h50)

```
$ npm run typecheck
> pdlm@0.1.0 typecheck
> tsc --noEmit
(sans sortie)

$ npx eslint src tests
✖ 40 problems (0 errors, 40 warnings)
   (`npm run lint` complet : 50 problems, 2 errors — dans .superpowers/sdd/,
    reliques hors périmètre, déjà présentes à la mesure du relecteur)

$ npm run test:unit
 Test Files  24 passed (24)
      Tests  175 passed (175)

$ npm run test:int
 Test Files  23 passed (23)
      Tests  217 passed (217)

$ npm run test:e2e
  38 passed (1.1m)
   (35 verts antérieurs + point 6 réparé + points 8 et 9)
```

## Dépendance ajoutée

`@axe-core/playwright` **4.13.0**, licence **MPL-2.0** (`"license"` du
`package.json` + fichier `LICENSE` « Mozilla Public License, version 2.0 »),
installé `--save-exact` (commit d'ancre `6484725`).

## Textes corses à faire relire (provisoires, marqués comme tels dans `src/i18n/co.ts`)

```
lien: 'Accolta'
demarches: 'E vostre pratiche'
mairie: 'A municipalità'
actualites: 'Nutizie'
toutesActualites: 'Tutte e nutizie'
agenda: 'In u paese stu mese'
toutAgenda: 'Tuttu l’agenda'
mosaique: (nom) => `Campà in ${nom}`
```

Plus, au grain (commit `94b991e`) : « Benvenuti à Valverde. Trovate quì e
nutizie è l’agenda di u cumunu. »

## Ce que je n'ai pas pu vérifier

- **I27 en conditions réelles** : l'égalité des scripts entre accueil et page
  intérieure n'est pas prouvable en dev (cf. Écart n° 3) ; à faire sur un build
  de production ou au premier déploiement réel.
- **`theme.css` du gabarit Village** : il n'existe pas (décision 18, kit
  provisoire) ; le point 3 passe donc sur le CSS commun. Il s'appliquera dès la
  tâche 5.
- **Les captures ne jugent pas le gabarit final** : le kit Village provisoire
  n'a pas d'intention graphique ; les captures prouvent la composition et
  l'absence d'emplacement vide, pas l'esthétique.
- **`testssl` au premier déploiement réel** : reste reporté (hors tâche, déjà
  noté dans le mémoire du projet).
