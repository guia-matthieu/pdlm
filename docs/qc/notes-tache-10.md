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

**Planche-contact.** Première version assemblée avec `montage` (ImageMagick 7, `-label '%f'`, 1160×5372) : étiquettes = noms de fichiers complets, trop longues — motif m4 de la relecture. Refaite par un script PIL jetable (`/tmp/t10-planche.py`) : 16 vignettes en 4 colonnes × 4 lignes — lignes = village jeu `#2a7f9e`, village `#9b3d57`, littoral `#2a7f9e`, littoral `#9b3d57` ; colonnes = photos-1440, photos-390, sans-photo-1440, sans-photo-390 — chaque vignette réduite à 900 px de haut (LANCZOS ; les captures font 4039 à 7250 px de haut, une planche pleine définition avait été mesurée 5760×29132 lors du premier assemblage), étiquette courte (`v-2a7f-ph-1440`, `l-9b3d-sp-390`…) dessinée sous la vignette en Menlo 15 px, largeur de colonne = max(vignette, étiquette) + marges (10 px intérieures, 14 px de gouttière).

```
$ python3 -I /tmp/t10-planche.py
  v-2a7f-ph-1440   cellule x=[14,355] vignette 321x900 etiquette 126px / 321px dispo
  … 16 lignes, une par vignette (v-2a7f-ph-390 59x900, l-2a7f-ph-1440 264x900, etc.)
  planche-contact.png 1034x3886 — 16 cellules disjointes, 16 etiquettes entieres, assertions passees
$ file docs/qc/captures-tache-10/planche-contact.png
  docs/qc/captures-tache-10/planche-contact.png: PNG image data, 1034 x 3886, 8-bit/color RGB, non-interlaced
```

Vérifiée programmatiquement, en deux volets (mes outils n'affichent pas l'image, même constat qu'au paragraphe suivant) :

- **Géométrie** (assertions du script) : chaque étiquette tient entière dans sa cellule (largeur mesurée ≤ largeur disponible, marge ≥ 4 px), les 16 cellules sont disjointes deux à deux, la taille du PNG final correspond au calcul.
- **Relecture OCR** (`/tmp/t10-verif-planche.py`) : chaque bande d'étiquette est découpée dans la planche finale (mêmes coordonnées), agrandie ×3, relue par tesseract `--psm 7` ; comparaison alphanumérique avec repliage symétrique `1`→`l` (l'OCR confond les deux glyphes) et critère de containment — l'OCR ajoute du bruit (tirets doublés, barre oblique parasite), il ne retire pas de lettres :

```
$ python3 -I /tmp/t10-verif-planche.py
  OK  attendu v-2a7f-ph-1440   lu [v—-2a7f—-ph-1440]
  … 16 lignes, toutes OK (ex. l-9b3d-sp-390 lu [1-9b3d-sp-390])
  16/16 etiquettes relues (etiquette attendue contenue dans la lecture normalisee alphanumerique ; l OCR ajoute du bruit, il ne retire pas)
```

Les captures pleine définition restent archivées à côté de la planche.

**Comment chaque capture a été regardée.** Mes outils de lecture n'affichent pas les images dans cette session (constat déjà fait en tâche 8) : les seize captures ont été examinées par OCR (tesseract 5.5.3, sortie TSV `-l fra`, lignes regroupées par chevauchement vertical) et par comptage des couleurs exactes dérivées (numpy/PIL, tolérance L1 < 34 par pixel, bandes contiguës). Les légendes qui suivent ne disent que ce que ces mesures, l'OCR et les sources CSS/DOM établissent ; toute mesure de position est notée `y=[haut,bas]` dans la capture nommée, en pixels. Ce qui reste prouvé mécaniquement : aucune capture ne déborde horizontalement (`document.documentElement.scrollWidth <= largeur` asserté seize fois, gabarits-captures.e2e.spec.ts).

```
$ tesseract capture.png - -l fra tsv        # texte + positions, lignes regroupées
$ python3 -I analyse.py capture.png         # comptages des couleurs dérivées par bandes y
  terre-sure #d2462f : 2892 px
    y=[883,947] x=[499,562] 2892 px         # village-2a7f9e-photos-1440, sample
```

**Trois défauts visibles, documentés sans correction** — le brief interdit de toucher `src/gabarits/` :

- **« Documents » deux fois dans le menu, sur les seize captures** (ex. village-2a7f9e-photos-1440, OCR y=21 ; littoral-9b3d57-photos-390, OCR y=161 et y=301). Cause déjà établie en recette : le lien `/documents` codé en dur après les entrées du menu se double d'une entrée « Documents » de la base de démonstration, que le grain ne retire pas d'une base déjà amorcée (docs/qc/notes-tache-05a.md l.119-124).
- **© décalé à gauche, village 1440 seulement** : « © 2026 … » commence à x=23 quand les colonnes du pied commencent à x=59 (OCR village-2a7f9e-photos-1440, y=3984 contre y=3760). À 390 px le © est à x=23 comme les colonnes (y=5919 contre y=5358) ; le littoral est aligné aux deux largeurs (© x=79 pour y=4856, colonnes x=79 pour y=4626).
- **Adresse de démonstration incohérente avec le titre, littoral seulement** : la commune affiche « Saint-Exupéry-les-Bains » (OCR y=22) mais adresse et courriel disent « Saint-Exupéry-sur-Mer » (OCR y=4701 ; coordonnées posées par le test, gabarits-captures.e2e.spec.ts l.131-138). Village est cohérent (« les-Bains » partout). Données injectées, pas un défaut de rendu.

**Légendes, capture par capture.** Couleurs dérivées mesurées — jeu 1 (principale `#2a7f9e`) : profond `#023e51`, accent `#f2b134`, terre-sure `#d2462f`, pâle `#e6f7fe` ; jeu 2 (principale `#9b3d57`) : profond `#69092e`, accent `#7fc4c9`, terre-sure `#d6801e`, pâle `#feeff2` (`deriver()`, couleurs.ts).

- **village-2a7f9e-photos-1440** (1440×4039) — titre blanc posé directement sur la photo, sans bandeau (h1 nu dans le héros, `background: none`, theme.css l.228-239 ; texte blanc mesuré y=[263,450]) ; bouton d'action en pilule **blanche** à texte profond, pas bleu (8 679 px blancs y=[495,544] x=[59,267] ; theme.css l.249-258) ; carte mairie blanche, liseré accent en bordure haute (y=[601,612] ; theme.css l.352-363) ; la seule terre de la page est la pastille ronde « État civil » (2 892 px `#d2462f`, y=[883,947] ; picto-2 = terre-sure, couleurs.ts l.223, Demarches.tsx l.35) ; quatre actualités illustrées (bloc « une » y 1560-2020, trois vignettes y 1560-1680 / 1800-1920 / 1980-2100) ; agenda sur fond profond pleine largeur (y=[2283,2683]), trois événements (16 octobre, 2 novembre, 9 novembre), dates en accent (y=[2483,2527]), sans étiquette de jour — la date ne rend que jour et mois (Agenda.tsx l.42-46) ; mosaïque « une-haute » : tuile 1 sur 2×2, tuile 2 haute, tuiles 3-4 empilées (theme.css l.564-631 ; tuiles mesurées y 2870-3420) ; pied : frise accent sur bande blanche (y=[3575,3667]) puis fond profond (y=[3678,4031]) (theme.css l.634-644 et l.650-665).
- **village-2a7f9e-photos-390** (390×5998) — menu sur deux lignes (y=63, y=100) ; horaires de mairie repliés sur deux lignes (y 957-986) ; mosaïque 1+2+1 : tuile 1 pleine largeur (y=[4240,4660]), tuiles 2-3 côte à côte (y=[4770,4870]), tuile 4 seule dans la colonne de gauche — la case de droite de sa rangée reste vide, blanche (cartographie par blocs de 25 px ; deux colonnes et tuile 2 à `grid-row: span 1` en mobile, theme.css l.833-840) ; © aligné sur les colonnes (x=23).
- **village-2a7f9e-sans-photo-1440** — héros illustré : fond pâle (301 065 px `#e6f7fe` sur y=[150,420]), titre en encre (OCR y=210), bouton plein principale (4 056 px `#2a7f9e` à y=[470,491] x=[60,266]) — `.section-heros--illustre`, theme.css l.286-300 ; brèves et mosaïque illustrées de pictogrammes (pictos 1 à 6, couleurs.ts l.223) au lieu de photos ; le reste de la page occupe les mêmes positions que la capture avec photos (OCR identique à ±5 px) ; terre toujours absente hors pastille « État civil » (y=[883,947]).
- **village-2a7f9e-sans-photo-390** — même page à 390 px, héros illustré conservé.
- **village-9b3d57-photos-1440** — positions identiques au jumeau `#2a7f9e` (OCR à ±2 px) ; les couleurs dérivées basculent : agenda et pied sur profond `#69092e` (y=[2283,2683] et y=[3678,4031]), dates `#7fc4c9` (y=[2483,2527]), liseré mairie `#7fc4c9` (y=[601,612]), pastille « État civil » `#d6801e` (y=[883,947]) ; la pilule blanche du héros ne change pas (blanc non dérivé, theme.css l.249-258).
- **village-9b3d57-photos-390** — jumeau mobile du précédent.
- **village-9b3d57-sans-photo-1440 / -390** — héros illustré sur pâle `#feeff2`, bouton plein `#9b3d57` (même règle theme.css l.292-297) ; pastille « État civil » `#d6801e` mesurée y=[883,947] à 1440.
- **littoral-2a7f9e-photos-1440** (1440×4909) — titres Source Serif 4 (theme.css l.17, l.40) ; titre blanc sur la photo, sans bandeau (l.207-218) ; bouton « Faire une démarche » **filaire** : texte et liseré blancs, pas de pastille pleine (569 px blancs seulement sur y=[387,399] x=[100,256] ; theme.css l.228-236) ; pastille « État civil » carrée `#d2462f` (y=[1030,1081] x=[940,992]) ; agenda sur fond profond `#023e51` (y=[2857,3405]) : quatre événements, chiffres seuls `#f2b134` (y=[3110,3194] x=[79,1131], OCR « 16 27 3. 10 »), sans étiquette de jour (Agenda.tsx l.42-46), arcs pointillés et pastille ronde 16 px sur la courbe (theme.css l.699-730) ; mosaïque décalée, libellés **sous** les images (Commerces y=3977, Balades et sentiers / Patrimoine y=4153, Associations y=4240 ; theme.css l.745-795) ; pied profond (y=[4392,4897]), frise sur bande blanche (theme.css l.807-819).
- **littoral-2a7f9e-photos-390** — menu vertical, une entrée par ligne (y=67 à y=301) ; casettes de mairie en colonnes étroites : horaires un mot par ligne (OCR y=821-1011), courriel sur trois lignes (y=1079, 1108, 1132), adresse repliée (« 01100 Saint-Exupéry- / sur-Mer ») ; agenda un événement par bloc, chiffres `#f2b134` sur fond profond (mesures y 4163-4416).
- **littoral-2a7f9e-sans-photo-1440** — héros illustré : fond pâle, traits de mer en terre (`#d2462f` sur trois traits, y=[434,442], [499,517], [571,605] ; stroke `.i-traits`, theme.css l.312), bouton plein `#2a7f9e` (l.280-284) ; les brèves illustrées font apparaître la terre une deuxième fois (pictogramme y=[2159,2249], 3 177 px — picto-2, couleurs.ts l.223) ; pastille « État civil » `#d2462f` (y=[1030,1081]).
- **littoral-2a7f9e-sans-photo-390** — même page à 390 px.
- **littoral-9b3d57-photos-1440** — positions identiques au jumeau `#2a7f9e` (dates mesurées aux mêmes y sur les deux) ; profond framboise `#69092e` (agenda y=[2857,3405], pied y=[4392,4897]), chiffres d'agenda sarcelle `#7fc4c9` (y=[3110,3194]), pastille « État civil » `#d6801e` (y=[1030,1081]) ; le bouton filaire blanc ne change pas (theme.css l.228-236).
- **littoral-9b3d57-photos-390** — jumeau mobile : chiffres sarcelle sur framboise (mesures y 4163-4812), horaires un mot par ligne et courriel sur trois lignes (OCR y 821-1132), mosaïque en colonne décalée (Patrimoine x=[206,318], Balades et sentiers x=[22,123]).
- **littoral-9b3d57-sans-photo-1440 / -390** — héros illustré, traits de mer en terre `#d6801e` (mesuré à 1440 : y=[434,442], [499,517], [571,605]).

Sur la planche : chaque vignette est la réduction LANCZOS de la capture individuelle, dans l'ordre lignes = jeux, colonnes = variantes ; elle sert de vue d'ensemble, la lecture fine se fait dans les captures pleine définition archivées à côté. Les vignettes 390 y sont étroites (48 à 59 px de large pour 900 de haut) — la distinction sarcelle contre framboise y est celle mesurée capture par capture ci-dessus, pas une relecture de la planche.

**Ce que ces méthodes ne vérifient pas** : le rendu typographique fin (graisses, crénage) — l'OCR confirme les textes et leurs positions, pas la qualité du dessin ; la fluidité des animations. Le contraste exact de chaque couple texte/fond ne se mesure pas mieux sur capture que par la dérivation elle-même : il est garanti par couleurs.spec.ts (I25) et montré en direct par l'onglet Apparence (tâche 9).

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
