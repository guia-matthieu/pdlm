# Notes QC — tâche 10 : README, captures regardées, audit final

> **Qui a écrit ces notes.** Session d'exécution GLM (15/10/2026), brief `~/Projects/guia/tasks/2026-10-15_brief-glm-gabarits-tache10.md`. Écrites au fil des commits. Tâche 10 du plan `docs/superpowers/plans/2026-09-25-gabarits-couleurs.md`, branche `gabarits-couleurs` partie de `0d3aea4` (arbre propre).

## Ancres du 15/10 — commit `Plan — tâche 10 : ancres du 15/10`

Vérifiées une à une avant tout écrit :

- README § « Accessibilité (RGAA) » : l. 403-418, conformes au brief. La consigne à retirer est la puce l. 407-414 (« **Avant publication**, vérifier le contraste… vérifier avant d'activer la commune ») — le brief la donnait l. 406-414 : la l. 406 (« focus visible…zoom 200 % ») appartient en réalité à la puce « Navigation clavier » (l. 405-406), qui reste. Restent aussi l. 415 (texte alternatif obligatoire) et la phrase l. 416-418 (Lighthouse signal rapide, « seule une recette manuelle (grille RGAA officielle) fait foi »).
- Filtre des chunks : `tests/e2e/gabarits-conformite.e2e.spec.ts` l. 274 (`.filter((src) => !src.startsWith('/_next/static/chunks/'))`), commentaire l. 266-269 — conformes.
- Gabarits : `src/gabarits/village` et `src/gabarits/littoral` présents.
- Scripts : `package.json` l. 8 (`build`, `--max-old-space-size=8000`), l. 16 (`start` = `next start`), l. 17 (`test` = unit + int + e2e).
- Ignorés : `.gitignore` l. 16 (`/.next/`), l. 50 (`/test-results/`).
- Outils : `montage` présent (`/opt/homebrew/bin/montage`).

Seule correction au plan : l. 1128, ancre de la section README (167-182 → 403-418). Les autres entrées de la tâche 10 ne portent pas de n° de ligne, rien d'autre à corriger.

## Affectation des jeux de couleurs (avant l'étape 2)

Le brief écrit « principale / accent / texte » ; le plan tranche l'ordre (l. 45 : « Défauts : principale `#264653`, accent `#e2a72e`, terre `#b36b00` ») et l'affectation (l. 199 : `deriver({ principale: '#2a7f9e', terre: '#d2462f' })`) :

- **Jeu 1** : principale `#2a7f9e`, accent `#f2b134`, terre `#d2462f` ;
- **Jeu 2** : principale `#9b3d57`, accent `#7fc4c9`, terre `#e08a2c`.

## Commit 2 — `README — accessibilité : ce que garantit la dérivation des couleurs`

La puce l. 407-414 (consigne de vérification manuelle + lien webaim) est remplacée par deux puces : ce que la dérivation garantit, puis l'échappatoire des couleurs forcées. Puce « texte alternatif » (l. 415) et puce Lighthouse (l. 416-418) conservées telles quelles.

Chaque affirmation du nouveau texte, avec sa source et le test qui la vérifie :

- **« La seule validation est le format `#rrggbb` »** — invariant I24 (spec l. 58 : « Rien n'est refusé sauf le format ») ; code : `src/lib/couleurs.ts` l. 56 (`FORMAT = /^#[0-9a-fA-F]{6}$/`) appliqué par `valide()` l. 62 aux trois saisies (l. 189-191) et aux forcées (l. 197). Tests : `tests/unit/couleurs.spec.ts` « une saisie hors format vaut le défaut » (l. 119), « les majuscules sont acceptées et donnent la même sortie » (l. 138), « une forcée hors format est ignorée » (l. 161).
- **« chaque couple texte/fond est ajusté, teinte conservée, jusqu'à son seuil »** — `assombrirJusqua` (couleurs.ts l. 139-141, « Plus grande clarté (teinte gardée) qui atteint `seuil`… inchangée si déjà conforme ») et `eclaircirJusqua` (l. 153-155) : dichotomie sur la seule clarté OKLCH. Invariant I25 (spec l. 93 : « Chaque garantie du tableau tient pour toute couleur choisie valide »). Test : `couleurs.spec.ts` describe « deriver — garanties (I25) », « toutes les garanties tiennent sur 3 000 tirages » (l. 23, propriété fast-check à graine fixe), plus les cas nommés « #2f7d5b (4,99:1) ressort inchangée » (l. 67) et « #7fc8a0 (1,97:1) est assombrie jusqu'à 4,5:1 avec un écart de teinte < 2° » (l. 71).
- **Seuils cités** — tels que `deriver()` les applique : 4.5:1 texte courant sur blanc (`--principale-sure`, l. 201 et contrôle l. 237), sur pâle (`--encre` sur `--pale`, contrôle l. 238) et sur accent (`--texte-sur-accent` noir ou blanc selon le meilleur contraste, l. 230, contrôle l. 241) ; 3:1 grandes dates sur profond (`--accent-sur-profond`, l. 233, contrôle l. 240 — CONTRAT.md l. 114 : garantie 3:1 pour du texte large ≥ 24 px ou ≥ 18,66 px gras) et pictogrammes (tons l. 217, contrôles l. 242-251) ; 7:1 texte blanc sur profond (l. 204, contrôle l. 239).
- **« la bande “Contrastes dérivés” montre en direct les onze rapports »** — le tableau de contrôles fait 5 lignes nommées + 6 pictos = 11 (couleurs.ts l. 236-252) ; rendu par `ApparenceApercu.tsx` (`.contrastes`, l. 170-187), recalculé à chaque rendu du formulaire (l. 84-86 : « I23 : la bande de contrôle recalcule la dérivation à chaque rendu, comme le site public le fera »). Test e2e : `tests/e2e/apercu.e2e.spec.ts` « admin : aperçu en direct, sans écriture tant qu'on n'enregistre pas » — `[data-role]` au nombre de 11 (l. 214), frappe d'accent suivie dans l'iframe, zéro écriture API.
- **« une couleur forcée est servie telle quelle, sans ajustement »** — couleurs.ts l. 221-227 (« Une forcée remplace sa variable ») : `f.texte ?? sure`, `f.pale ?? pale`, `f.profond ?? profond`, pictos l. 223 ; seules `--encre` et `--texte-sur-accent` restent calculées. Tests : « une forcée est utilisée telle quelle, marquée force, et avertit sous le seuil » (couleurs.spec.ts l. 146), « une picto forcée ne remplace que son ton » (l. 165), « l'accent sur profond se recalcule contre le profond forcé » (l. 171).
- **« marque la ligne “forcée, sous votre responsabilité” et passe en alerte si le rapport descend sous le seuil »** — `ApparenceApercu.tsx` l. 183-184 (`c.force ? ' — forcée, sous votre responsabilité' : ''` sur chaque ligne forcée), classe `insuffisant` (l. 177) et avertissements `role="alert"` (l. 189-196) remplis par les messages « … : 4,53:1, illisible » de couleurs.ts l. 262-264 (l'alerte n'apparaît que sous le seuil, la marque « forcée » sur toute forcée — le texte du README dit exactement cela).

Le champ admin porte déjà la même mention : `src/collections/Communes.ts` l. 490 (« Une couleur forcée est utilisée telle quelle (I24) : le contraste est sous votre responsabilité »).

**Écart au brief, motif** : le brief donne l'intitulé `README — accessibilité : ce que garantit la dérivation des couleurs` au « commit de clôture » (étape 5) tout en exigeant des commits à part par étape ; le plan (Step 5) attache cet intitulé au commit qui porte la réécriture du README. Je l'applique ici, au commit de l'étape 1 ; le commit de clôture final portera la mise à jour de l'état d'exécution du plan (le brief autorise ce commit à part).

## Étape 2 — les 16 captures

**Choix : fichier neuf** `tests/e2e/gabarits-captures.e2e.spec.ts`. Motif : les deux modèles capturent chacun un seul gabarit dans ses couleurs par défaut ; la tâche 10 croise gabarit × jeu de couleurs × avec/sans photos, composition qui n'est celle d'aucun des deux. Étendre l'un des deux l'aurait fait dévier de son sujet (captures de référence des maquettes) ; un fichier paramétré sur les deux gabarits évite de dupliquer téléversement, nettoyage et remise en état.

**Composition reprise des modèles, vérifiée ligne à ligne** : frise village 21 pièces (`village-captures.e2e.spec.ts` l. 32-54), frise littoral 16 pièces avec écarts (`littoral-captures.e2e.spec.ts` l. 47-64), coordonnées et horaires identiques, mêmes titres d'événements (le nettoyage par titre emporte aussi les restes d'un passage interrompu des modèles), mosaïque avec la troisième tuile illustrée, images sur les quatre actualités les plus récentes (`[...actusDemo, ...crees].slice(0, 4)`, lecture démo `limit=10` triée `-datePublication`, comme village l. 191-196 et 268). Couleurs posées avant chaque capture par PATCH `apparence.couleurPrincipale/couleurAccent/couleurTerre` ; tout est remis dans `afterAll` (couleurs comprises : `origine.apparence?.couleurPrincipale ?? null`).

**Premier passage : échec, correction, relance.** `page.evaluate(() => document.fonts.check(g.police))` échoue : le callback est sérialisé vers le navigateur, où `g` n'existe pas (« ReferenceError: g is not defined », gabarits-captures l. 428). Les deux tests « avec photos » ont échoué après leurs captures, les six suivants n'ont pas tourné (describe serial) ; `afterAll` a rendu la main sans erreur. Correction : la police passe en argument — `page.evaluate((police) => document.fonts.check(police), g.police)`. Relance de la suite ciblée : bug dans le test que j'écris, pas un comportement des tâches 1 à 9 ; les 16 captures sont exigées par le brief.

**Exécution (second passage).**

```
$ npm run test:e2e -- gabarits-captures
  8 passed (39.6s)
$ ls test-results/gabarits/t10 | wc -l
  16
```

Le nettoyage final est visible dans la sortie serveur (DELETE des médias `capture-tache-10`, actualités et événements). Copie : `cp test-results/gabarits/t10/*.png docs/qc/captures-tache-10/`.

**Planche-contact.** `montage` (ImageMagick 7 de Homebrew), 4 colonnes × 4 lignes, labels `%f` ; lignes = village jeu `#2a7f9e`, village `#9b3d57`, littoral `#2a7f9e`, littoral `#9b3d57` ; colonnes = photos-1440, photos-390, sans-photo-1440, sans-photo-390.

```
$ montage -font /System/Library/Fonts/Helvetica.ttc -pointsize 22 -tile 4x -geometry +8+8 \
    -label '%f' /tmp/planche-t10/*.png (16 vignettes, ordre ci-dessus) planche-contact.png
$ identify planche-contact.png
  planche-contact.png PNG 1160x5372 1160x5372+0+0 16-bit sRGB 4.37503MiB
```

Deux écarts au brief, motifs :

- **Police explicite** : l'ImageMagick de Homebrew n'a aucune police enregistrée (`magick -list font` vide) ; sans `-font`, « montage: unable to read font ». J'ai pointé `/System/Library/Fonts/Helvetica.ttc`.
- **Vignettes réduites avant montage** (`magick -resize x1300` dans `/tmp/planche-t10`, dossier jetable supprimé après) : les captures pleine page font 4039 à 7250 px de haut ; la planche littérale du brief (`-geometry +8+8` sans réduction) mesure **5760×29132 px, 21,8 Mo** (constaté), illisible. Avec vignettes de 1300 px de haut : 1160×5372, regardable. Les captures pleine définition sont archivées à côté de la planche.

**Ce que montrent la planche et chaque capture.** Les seize captures sont conformes : je ne relève ni section vide, ni élément manquant, ni débordement (l'absence de débordement horizontal est aussi prouvée mécaniquement : chaque capture asserte `document.documentElement.scrollWidth <= largeur`, seize fois passé). Détail par capture :

- **village-2a7f9e-photos-1440** — héros photo de montagne, titre Bricolage blanc sur bandeau bleu profond, bouton bleu, une illustrée + trois brèves avec images, mosaïque de quatre tuiles (trois photos, la troisième illustrée SVG, conforme à la composition), agenda aux pastilles terre `#d2462f` à chiffres blancs lisibles, pied bleu profond avec frise village claire. Contrastes lisibles partout.
- **village-2a7f9e-photos-390** — même page empilée : une colonne, mosaïque 2×2, agenda, pied frise. Aucun débordement.
- **village-2a7f9e-sans-photo-1440** — héros SVG (colline, maisons, église, sapins) sur fond bleu pâle dérivé ; brèves et mosaïque toutes illustrées de pictogrammes — rien de vide (I30).
- **village-2a7f9e-sans-photo-390** — idem empilé, héros SVG visible en entier.
- **village-9b3d57-photos-1440** — la palette bascule intégralement : bandeau et boutons framboise, pastille date accent `#7fc4c9`, agenda terre `#e08a2c`, pied framboise profond. Titre et textes lisibles.
- **village-9b3d57-photos-390** — idem empilé, sans débordement.
- **village-9b3d57-sans-photo-1440 / -390** — héros SVG sur fond framboise pâle, sections toutes illustrées.
- **littoral-2a7f9e-photos-1440** — typographie Source Serif 4 (serif visible), héros photo du phare, pastilles date accent `#f2b134` à chiffres sombres, mosaïque photos, agenda de quatre événements, pied bleu profond avec frise maritime (pin, phare, voilier, jetée).
- **littoral-2a7f9e-photos-390** — empilé, mosaïque deux colonnes, agenda, frise en pied. Aucun débordement.
- **littoral-2a7f9e-sans-photo-1440 / -390** — héros SVG (phare, mer, mouettes), brèves et mosaïque illustrées de pictogrammes maritimes.
- **littoral-9b3d57-photos-1440** — bandeau framboise, pastilles accent `#7fc4c9` à chiffres sombres, agenda terre `#e08a2c`, pied framboise profond, frise maritime. Lisible.
- **littoral-9b3d57-photos-390** — idem empilé, sans débordement.
- **littoral-9b3d57-sans-photo-1440 / -390** — héros SVG, tout illustré.

Sur la planche : les deux jeux se distinguent d'un coup d'œil (dominante bleu sarcelle contre framboise), gabarit après gabarit ; les colonnes sans photo montrent le héros illustré. Les vignettes 390 y sont étroites (hauteur normalisée) — la lecture fine du mobile se fait dans les captures individuelles.

**Ce que je n'ai pas pu vérifier** : le rendu typographique fin à 390 px (les captures sont réduites à l'affichage ici) ; l'absence de débordement horizontal y est pourtant prouvée par l'assertion `scrollWidth` du test. Le contraste exact de chaque couple texte/fond ne se juge pas à l'œil sur capture : il est garanti par la dérivation (couleurs.spec.ts, I25) et montré en direct par l'onglet Apparence (tâche 9).

**Avant le commit** : `git status --short` montre `src/payload-types.ts` modifié — diff d'environnement, exactement celui prévu par le brief : la description de `mesure.active` dépend de `UMAMI_URL` (absente de ce worktree, la description régénérée est celle du champ « coupe » sans plateforme configurée). Remis par `git checkout -- src/payload-types.ts`, rien à committer de ce côté.

## Étape 3 — conformité rejouée contre un build de production

**Filtre E2E_PROD** (seul changement du test, l. 266-284) : en dev, turbopack nomme ses chunks par route (constaté : un nom diffère entre `/` et `/actualites`), l'égalité I27 porte donc sur les scripts hors chunks ; avec `E2E_PROD=1`, elle porte sur tous les scripts, chunks compris — le contrôle complet. Le booléen est passé en **argument** du `$$eval` (le callback est sérialisé vers le navigateur, même piège que `g.police` à l'étape 2).

**Build** (`npm run build`, une fois, ~8 Go) : réussi, 13 pages statiques — routes vues : `/[lang]`, `/apercu/apparence`, `/api/[...slug]`, `/gabarits/[nom]/theme.css` en SSG pour village et littoral.

**Première exécution — 403 API, corrigé sans code.**

```
$ E2E_PROD=1 E2E_PORT=3005 npx playwright test gabarits-conformite
  2 failed — l. 185 : PATCH /api/communes/1 → 403 « Vous n'êtes pas autorisé
  à effectuer cette action. » ; l. 204 : afterAll en cascade — 12 did not run
```

Chaîne prouvée avant conclusion : `@payloadcms/translations/dist/languages/fr.js:114` (`notAllowedToPerformAction`) ← `payload/dist/errors/Forbidden.js:6` ← `payload/dist/auth/executeAccess.js:13,22` (req.user absent) ← `payload/dist/auth/extractJWT.js:18-37` : avec en-tête `Origin`, le cookie `payload-token` n'est extrait que si l'origine figure dans `csrf`. Or en production `csrf` ne vaut que `ADMIN_URL` (`src/payload.config.ts` l. 57-61, l. 106-107), et le serveur tournait avec un `ADMIN_URL` de production. Reproduit par curl : login 200 (Set-Cookie `payload-token`), puis `/api/users/me` avec le cookie → `{"user":null}`. Correction : `ADMIN_URL` n'est lu qu'au démarrage (payload.config.ts:59, proxy.ts:40, Communes.ts:85 — aucun `NEXT_PUBLIC_*`) → serveur relancé avec `ADMIN_URL=http://localhost:3005` en variable de processus, `.env` intact. Après quoi le `beforeAll` passe.

**Deuxième exécution — 404 front public : le blocage.**

```
$ E2E_PROD=1 E2E_PORT=3005 npx playwright test gabarits-conformite
  2 failed — l. 244 : expect(reponse?.status()).toBe(200) après page.goto('/')
  — 12 did not run
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/   → 404
$ curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/fr  → 404
```

Comportement voulu du socle, antérieur aux tâches 1-9 : `src/lib/commune.ts` l. 46-50 (host local nu → `null` en production ; fallback `DEFAULT_COMMUNE_SLUG` « jamais en production », l. 38) et `src/proxy.ts` l. 17-29 (sans `PLATFORM_DOMAIN`, `estDomainePlateforme` = false partout en prod). Le `BASE_URL` de la suite (`playwright.config.ts` l. 23) n'est pas paramétrable sans modifier le fichier — hors périmètre du brief. Conformément à la consigne sur les contrôles qui échouent hors de mon périmètre : rien corrigé, **`docs/qc/bloque-tache-10.md`** écrit (mesure, commandes, sorties, causes sourcées, options, recommandation).

**Mesures livrables faites quand même en prod** (serveur relancé `ADMIN_URL=http://localhost:3005 PLATFORM_DOMAIN=localhost npm run start -- --port 3005`) :

- Page publique via sous-domaine (`curl -H 'Host: saint-ex.localhost' …/`) : 200, `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate`, CSP `frame-ancestors 'none'`.
- Aperçu `/apercu/apparence?commune=1` avec cookie opérateur : 200, `Cache-Control: no-store`, `X-Robots-Tag: noindex`, CSP `frame-ancestors 'self'` ; sans cookie : 404 avec les mêmes en-têtes — I28 tenu (`src/app/(apercu)/apercu/apparence/page.tsx:35-39`, `src/lib/apercu.ts:58-62`).
- **I27 à la main** — le contrôle exact que `E2E_PROD` devait produire : `/` et `/actualites` servent exactement les 7 mêmes scripts (tous `/_next/static/chunks/`, `diff` vide) : l'accueil n'en ajoute aucun, chunks compris.

**État de la base après les échecs, tranché.** saint-ex avait `gabarit: village`, `coordonnees.ville: null` : c'est l'état du seed — `src/seed/index.ts` et `src/seed/contenu-demo.ts` ne posent ni `gabarit` (donc defaultValue `'village'`, `src/collections/Communes.ts:399`) ni `coordonnees` ; le PATCH 403 n'a jamais rien changé. Rien à restaurer ; la suite e2e complète de l'étape 4 (en dev) repasse de toute façon.

**Avant le commit** : serveur 3005 arrêté, temporaires `/tmp/t10-*.txt|json|log` supprimés, `git status --short` limité aux trois fichiers du commit.

## Étape 4 — vérifications finales (commit `Vérifications finales — tout vert : lint, types, 297 unitaires, 228 intégration, 64 e2e`)

Chaque suite lancée une seule fois, sorties collées :

```
$ npm run lint
  ✖ 45 problems (0 errors, 45 warnings)
$ npm run typecheck
  > tsc --noEmit        (sortie vide, code 0)
$ npm run test:unit
  Test Files  31 passed (31)
       Tests  297 passed (297)
$ npm run test:int
  Test Files  25 passed (25)
       Tests  228 passed (228)
$ npm run test:e2e
  64 passed (2.5m)
```

- **lint** : 0 erreur — le critère du plan est « 0 erreur dans `src/` et `tests/` ». Les 45 warnings tiennent dans 14 fichiers du socle (les 8 `src/migrations/*`, `src/seed/contenu-demo.ts`, `src/lib/contenu.ts`, `src/components/MediaImage.tsx`, `src/components/admin/FriseApercu.tsx`, `tests/int/isolation.int.spec.ts`, `tests/stubs/server-only.ts` — `no-explicit-any` des migrations SQL et deux conventions d'export). Aucun fichier écrit par la tâche 10 ; rien corrigé (hors périmètre du brief).
- **test:int** : première passe verte, pas de « already exists » (le schéma n'a pas bougé depuis la tâche 9).
- **test:e2e** : suite complète en dev (webServer standard de `playwright.config.ts`), une exécution — 64 tests, y compris la conformité (en dev, le filtre `E2E_PROD` ne change rien : l'égalité hors chunks), l'aperçu de la tâche 9 et les 8 captures de la tâche 10.
- **`src/payload-types.ts`** régénéré pendant les passes de tests (même diff d'environnement qu'à l'étape 2 : la description de `mesure.active` selon `UMAMI_URL`) : remis par `git checkout --`.
- **`git diff --stat 0d3aea4 -- src/`** : vide — la tâche 10 n'a touché aucun code applicatif des tâches 1 à 9, comme l'exige le brief.


---

## Relecture du 15 octobre — réponses et corrections (commits séparés)

### M1 — README : « chaque couple texte/fond est ajusté, teinte conservée, jusqu'à son seuil » promettait plus que le code

Exact pour deux couples, relevés dans `src/lib/couleurs.ts` :

- **texte courant sur pâle** — tient par construction, sans jamais ajuster la saisie : l'encre est construite à luminance fixée (`depuis_oklch(0.24, …)`, couleurs.ts:202) et le fond pâle de même (`depuis_oklch(0.965, …)`, couleurs.ts:203). Aucune boucle `assombrirJusqua` sur ce couple.
- **texte sur accent** — l'accent saisi n'est jamais modifié : le texte devient noir ou blanc selon le meilleur contraste (`'--texte-sur-accent': contraste(NOIR, a) >= contraste(BLANC, a) ? NOIR : BLANC`, couleurs.ts:230).

La phrase passait aussi sous silence que la terre n'est garantie qu'à 3:1 (`assombrirJusqua(t, BLANC, 3)`, couleurs.ts:205), comme les quatre tons de pictogrammes (couleurs.ts:217).

Réécriture couple par couple (README.md, section _Accessibilité (RGAA)_) : chaque puce dit ce que fait le code — assombrissement à teinte conservée pour le texte sur blanc (couleurs.ts:201) et le blanc sur profond (couleurs.ts:204), éclaircissement pour les grandes dates (couleurs.ts:233), luminance fixée pour le texte sur pâle, noir-ou-blanc pour le texte sur accent, et le seuil 3:1 — non 4.5:1 — porté explicitement pour la terre et les pictogrammes.

```
$ git diff README.md   (extrait : phrase retirée, puces ajoutées)
-  couleur peu contrastée est acceptée, puis rendue lisible par dérivation —
-  chaque couple texte/fond est ajusté, teinte conservée, jusqu'à son seuil de
-  contraste : 4.5:1 pour le texte courant, 3:1 pour les grandes dates et les
-  pictogrammes, 7:1 pour le texte blanc sur la teinte profonde. L'onglet
-  _Apparence_ recalcule la même dérivation à chaque réglage : sa bande
+  couleur peu contrastée est acceptée, puis rendue lisible par dérivation. Ce
+  que fait la dérivation, couple par couple :
+  - **texte et liens sur blanc** — la principale saisie est assombrie, teinte
+    conservée, jusqu'à 4.5:1 ;
+  - **texte courant sur fond pâle** — ce couple tient par construction : encre
+    et fond pâle sont construits à luminance fixée (l'un très sombre, l'autre
+    très clair), sans ajuster la saisie ;
+  - **texte blanc sur la teinte profonde** — la profonde est assombrie, teinte
+    conservée, jusqu'à 7:1 ;
+  - **texte sur fond accent** — l'accent saisi n'est jamais modifié : le texte
+    devient noir ou blanc, selon celui qui donne le meilleur contraste ;
+  - **grandes dates (accent sur fond profond)** — l'accent est éclairci, teinte
+    conservée, jusqu'à 3:1 ;
+  - **terre et pictogrammes** — assombris, teinte conservée, jusqu'à 3:1 : ce
+    seuil, et non 4.5:1, est la garantie portée par ces couleurs.
+  L'onglet _Apparence_ recalcule la même dérivation à chaque réglage : sa bande
   « Contrastes dérivés » montre en direct les onze rapports obtenus.
```

### M2 — aucun test de ce que voit l'admin quand une couleur est forcée

Test ajouté dans `tests/e2e/apercu.e2e.spec.ts` (« admin : une couleur forcée est marquée et alertée dans la bande des contrastes ») : il ouvre l'onglet _Apparence_, force `texte = #aaaaaa` dans _Réglages avancés_, puis vérifie la ligne de la bande « Contrastes dérivés » — `texte et liens sur blanc : 2,32:1 (seuil 4,50:1) — forcée, sous votre responsabilité` (libellés d'ApparenceApercu.tsx:183-184) — et l'alerte `role="alert"` (ApparenceApercu.tsx:192) `Texte et liens sur blanc : 2,32:1, illisible`. Avant la frappe, le test vérifie que la même ligne ne porte pas la mention (état dérivé, 10,07:1 avec le seed).

Vu rouge d'abord : assertions réelles en place sauf le libellé, volontairement faux (`toContainText('forcée automatiquement')`).

```
$ npx playwright test apercu
  > 253 |       await expect(ligneTexte).toContainText('forcée automatiquement')
          |                                ^
        at /Users/matthieucredou/Projects/glm.gabarits/tests/e2e/apercu.e2e.spec.ts:253:32
  1 failed
    [chromium] › tests/e2e/apercu.e2e.spec.ts:226:3 › Aperçu d'apparence — onglet de l'admin › admin : une couleur forcée est marquée et alertée dans la bande des contrastes
  5 passed (48.1s)
```

Le snapshot de ce run prouve que l'état forcé était bien rendu — le rouge vient du libellé visé, pas d'un champ absent :

```
  - generic [ref=e266]: "texte et liens sur blanc : 2,32:1 (seuil 4,50:1) — forcée, sous votre responsabilité"
  - alert [ref=e298]: "Texte et liens sur blanc : 2,32:1, illisible"
  - textbox "Texte" [active] [ref=e329]: "#aaaaaa"
```

Deux obstacles rencontrés avant ce rouge, consignés pour les suivants :

- le panneau _Réglages avancés_ est replié (`initCollapsed: true`, Communes.ts:482) et son bouton ne porte pas le libellé : il ne dit que « Bloc bascule » (`t("fields:toggleBlock")`, @payloadcms/ui Collapsible), le libellé est sur le collapsible entier. Deux premiers runs ont échoué au clic (`getByRole('button', { name: 'Réglages avancés' })` puis `hasText` sur le bouton ne matchent rien) — le clic vise désormais `.collapsible` contenant le libellé ;
- une fois le clic juste, l'ouverture n'a pas pris une fois sur quatre runs (le clic atterrit, le contenu reste replié — re-rendu tardif du formulaire en dev) : le test vérifie maintenant que le champ est visible avant la frappe et redonne un clic sinon.

Puis vert, assertions réelles :

```
$ npx playwright test apercu
  6 passed (34.0s)
$ npx playwright test apercu   (après durcissement de l'ouverture du panneau)
  6 passed (37.4s)
```

`src/payload-types.ts` resali par le webServer e2e (diff d'environnement `mesure.active`, comme à l'étape 4) : remis par `git checkout --`.
