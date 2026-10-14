# Notes QC — tâche 8 : Gabarit Littoral

> **Qui a écrit ces notes.** Session d'exécution GLM (14/10/2026), brief `~/Projects/guia/tasks/2026-10-14_brief-glm-gabarits-tache8.md`. Écrites au fil des commits. Tâche 8 du plan `docs/superpowers/plans/2026-09-25-gabarits-couleurs.md` (l. 1091), branche `gabarits-couleurs` partie de `62b42a8`.

## Ancres du 14/10 — commit « Plan — tâche 8 : ancres du 14/10 » (`bf30169`)

Trois corrections portées dans le texte de la tâche 8 du plan, avant tout code :

1. les sources sont dans ce worktree, `docs/recherche/2026-09-25_front-beau/` (ignoré par git) : `L-littoral-scenes/` à porter, `J-maquette-littoral/` maquette validée ;
2. `KIT` compte 14 pièces (`ecole`, `portique`, `dune`, `rocher` comprises) ;
3. le select `gabarit` de `src/collections/Communes.ts` porte déjà l'option `littoral` — vérifié sur le fichier avant d'écrire (options `village` et `littoral`, l. ~398-409) : aucun changement de schéma, pas de migration.

Le contrôle I26 de l'étape 4 est corrigé en `git diff --stat 62b42a8 -- src/gabarits/village` vide (base de la branche ; Village n'existe pas sur `main`).

## Travail A — kit, scènes, héros, ornements

### Test d'abord — commit « Littoral — tests du kit et des scènes, vus rouges avant le code »

`tests/unit/gabarits-kits.spec.ts` :

- dans la boucle paramétrée `describe.each(Object.entries(GABARITS))` (elle couvrira Littoral dès son entrée au registre, travail B) : un garde-fou d'injection — pour les saisies `<script>alert(1)</script>`, `" onload="x`, `constructor`, `</svg><svg onload=x>`, la ligne est ignorée (`ignorees`) et le SVG rendu par `composerFrise()` ne contient jamais la saisie ;
- un `describe` propre à Littoral, importé directement de `@/gabarits/littoral/…` (le registre ne le connaît pas encore) : les 14 pièces exactement, chacune avec des chemins non vides aux trois tailles (`goeland` et `portique` n'ont que des traits), les 7 scènes rendent un SVG `class="scene"`, et une scène inconnue (`lagune`) rend exactement le SVG de `nature` (étape 3 du plan).

Vu rouge d'abord (les modules n'existent pas) :

```
$ npx vitest run tests/unit/gabarits-kits.spec.ts
Error: Failed to resolve import "@/gabarits/littoral/illustrations" from "tests/unit/gabarits-kits.spec.ts". Does the file exist?
 Test Files  1 failed (1)
      Tests  no tests
```

### Kit — commit « Littoral — kit de frise : 14 pièces, ligne de mer, ornements »

`src/gabarits/littoral/frise.ts` : portage de `KIT`, `TAILLES`, `mer()` et des ornements de `frise_littoral.py`, sur la structure de `village/frise.ts` (`p()`, `PIECES`, `Object.fromEntries` vers la signature `(x, sol, taille)`).

- les 14 pièces à la géométrie inchangée ; les coordonnées relatives de la source sont cuites à l'échelle (`a` de l'horloge de l'école, `l` des oyats de la dune), comme `arbre` le fait déjà côté Village ;
- `horizon()` = `mer()` fermée jusqu'à y = 160. Écart d'adaptation, pas de géométrie : la maquette pose sa ligne de mer à 160 dans un viewBox 190, le moteur du contrat pose les bases à 150 dans un viewBox 160 (`SOL_FRISE` de `src/gabarits/frise.ts`) — la houle garde amplitude 3 / période 48, posée à 150 ;
- `ornements` exporte `mer`, `maree`, `ligne_mer`, `courbe_marees`, `sable`. `maree` garde ses paramètres (optionnels, donc appelables sans argument comme le contrat l'exige) : `dessus`/`dessous` sont des couleurs CSS posées en variables inline, `#fff` (seul littéral que le contrat admet) ou une variable du contrat. Attribut `focusable="false"` ajouté aux SVG d'ornements sur le modèle de `village/illustrations.ts` (le Python ne l'avait pas) ;
- hauteur hors-tout portée sur chaque pièce (le Python ne la renvoie pas) : modèle du type `Piece` de Village, utile aux scènes.

Relance après le kit, toujours rouge (il ne manque qu'`illustrations`) :

```
$ npx vitest run tests/unit/gabarits-kits.spec.ts
Error: Failed to resolve import "@/gabarits/littoral/illustrations" from "tests/unit/gabarits-kits.spec.ts". Does the file exist?
 Test Files  1 failed (1) / Tests  no tests
```

### Scènes — commit « Littoral — scènes d'illustration : les 7 scènes et le héros »

`src/gabarits/littoral/illustrations.ts` : portage de `_scene`, `SCENES`, `SOLEIL`, `scene` et `heros` du Python, sur la structure de `village/illustrations.ts`.

- les 7 scènes à pièces et soleils exacts de la source ; `SOLEIL` du Python intégré dans chaque composition (`soleilX`), modèle Village ;
- `composer()` garde le +4 fixe (non multiplié par le zoom) sous le sol pour `barque` et `voilier`, fidèle au Python ;
- le relief est la mer en trois plans (`i-loin` derrière les pièces, `i-eau`, `i-eau2`), ordre exact de `_scene` ; le héros diffère de la scène par soleil (x 0.62, y 0.36·h, rayon 0.09·h), seconde houle à +30 (vs +26) et cadrage `xMaxYMax` ;
- contrairement à Village, une scène Littoral réutilise les pièces du kit telles quelles (formes **et** traits de frise : croix de l'église, horloge de l'école, goéland et portique tout en trait) — le Python n'a pas de détails de scène additionnels, pas de `accents`.

Correctif de test (avec motif) : l'assertion « scène absente → rendu identique à nature » comparait le SVG **entier**, donc aussi `data-illustration`, qui échoit le nom demandé (comportement du modèle Village relu, `village/illustrations.ts` l. 412-423). Le nom de scène vient d'un select fermé (`src/collections/Communes.ts` l. 602-610, options = `SCENES` de `src/lib/accueil-defauts.ts` l. 20) : l'écho est sûr et diagnostique le repli. L'assertion est resserrée sur le dessin (attribut normalisé) — le code garde le comportement Village, qui sert aussi à la suite paramétrée des deux gabarits (décision 18).

```
$ npx vitest run tests/unit/gabarits-kits.spec.ts
 Test Files  1 passed (1)
      Tests  42 passed (42)
$ npm run typecheck
> tsc --noEmit          (0 erreur)
```

## Travail B — thème, polices, registre, captures

### Polices — copiées de `L-littoral-scenes/polices/`

Cinq fichiers dans `src/gabarits/littoral/polices/` (Source Serif 4 400 et 600,
Public Sans variable, deux licences OFL). `public-sans-LICENSE.md` renommé
`public-sans-LICENSE.txt` : convention de nommage `<famille>-LICENSE.txt` de
`village/polices/`. sha256 relevés sur la copie **et** la source, identiques :

| Fichier | sha256 |
| --- | --- |
| `source-serif-4-latin-400.woff2` | `02194deb92d3975dd30e11a3824a1f1db32b48c93654e60560cb81ce8e7b5f95` |
| `source-serif-4-latin-600.woff2` | `f2b7e1cf1d277b7608231868135648f8ad8e2b58d8e97ca088bee15dc357bee7` |
| `PublicSans-latin-variable.woff2` | `c1b6da516e0062e9c2f341b3a51dd2d621d946da72f06c6cfe05fd9d2dd8622d` |
| `source-serif-4-LICENSE.txt` | `18aabf190848725e2576eefb5c29ba06aac1029d02132252a7f312eac2e50cf3` |
| `public-sans-LICENSE.txt` | `82f0d3cad45f264192db156360b4a710fe7060885f6aa261e6539f13cb9eb0d9` |

### Thème — commit « Littoral — thème, polices et entrée au registre »

`src/gabarits/littoral/theme.css`, portage de `J-maquette-littoral/accueil.html`
sur le balisage commun. Points de conception et écarts assumés :

- **littéraux hex** : `grep -nE '#[0-9a-fA-F]{3,8}\b' theme.css` ne liste que
  `#fff` — le même que Village garde (fond blanc de la frise du pied, crêtes
  des vagues, texte posé sur `--profond`). Les trois littéraux à retirer
  (`#1f7a3a`, `#6b4600`, `#fff3cf`) : les deux premiers n'ont rien à remplacer
  — la pastille « ouvert » de la maquette n'existe pas dans le moteur
  (`Mairie.tsx` n'a pas d'état ouvert/fermé) et les alertes gardent leur base
  du socle, `#fff3cf` compris, comme Village (aucune surcharge Littoral) ;
- **marées** : le moteur n'a pas de crochet d'ornement entre les sections —
  le SVG `maree` de la maquette est approché en CSS pur (deux
  `radial-gradient` répétés, vague teintée derrière vague pleine, formule de
  teinte reprise de `maree()` : mix 50 % dessous/dessus puis 88 % à
  `principale-sure`). Posées dans les marges de 44 px des bandes pâle
  (texte libre) et profonde (agenda), aux quatre endroits de la maquette
  (autour de texte libre et d'agenda) ;
- **courbe des marées de l'agenda** : approximée par deux arcs elliptiques
  pointillés (`border-radius: 50%`), dates hautes/basses posées dessus par
  `--y` et pastille accent à halo profond — retirés sous 900 px ;
- **la « une »** : son visuel déborde jusqu'au bord de l'écran
  (`margin: -2.6rem … 0 0` — corrigé après relecture, voir « Après
  relecture » M2 : le `calc(50% - 50vw)` initial débordait l'écran, le clip
  de body ne l'écrasait pas). La ligne de mer de la maquette sur ce visuel
  n'est pas portée (aucun crochet sur les visuels d'actualité) ;
- **libellés de mosaïque** sous l'image (serif), ornement sable de la
  maquette non porté (pas de crochet) ;
- **frise du héros au trait** (blanc), **frise du pied en silhouettes
  pleines** sur blanc — les deux traitements de la maquette ;
- mois de l'agenda en 1.2rem/700 (≈19.2 px gras) : la maquette demandait
  1.15rem/400 (18.4 px maigre), sous le seuil du contrat pour
  `--accent-sur-profond` (≥18.66 px si gras, donc ≥19.2 px) ;
- dates et liens de la une en `--encre` et non `--principale-sure` :
  décision 17 (pas de principale-sure sur fond pâle) ;
- focus global du socle conservé (`outline` + halo `#fff`), alertes du socle
  conservées.

### Données et registre — même commit

- `gabarit.ts` : `cadrageHeros: 'panorama'`, `friseAuPied: true`, mairie
  **avant** démarches et mosaïque **sans** variante — l'ordre lu dans
  `J-maquette-littoral/accueil.html` (héros, rive mairie, démarches, texte
  libre, actualités une, agenda, mosaïque) ;
- `README.md` : même plan que `village/README.md` ; la maquette de référence
  J vit hors dépôt (`docs/recherche/…`, ignoré par git), les captures du
  rendu iront dans `maquette/captures/` ;
- `registre.ts` : entrée `littoral` (le type `Partial` reste : l'entrée le
  satisfait), commentaires « attendu (tâche 8) » → « compris (tâche 8) » ;
- test : `gabaritDe('littoral')` rend `GABARITS.littoral`, replis
  `montagne`/`null`/`undefined` sur village. Pas de passage rouge pour ces
  assertions : leur état rouge est l'état antérieur du dépôt (registre sans
  `littoral`, commit `e8de943`), le registre et le test changent dans le
  même commit — le montrer demanderait de commiter le test avant le registre.

```
$ npm run generate:importmap && npm run generate:types
  (importMap.js réécrit, payload-types.ts réécrit)
$ git diff src/payload-types.ts
  (vide — la tâche ne touche pas au schéma)
```

`importMap.js` : le générateur l'a réécrit en guillemets doubles sur une
ligne par clé — clés, valeurs et ordre identiques au fichier commis (simple
écart de formatage selon l'environnement, rien à voir avec la tâche) :
restauré par `git checkout --`, noté ici.

```
$ npx vitest run tests/unit/gabarits-kits.spec.ts
 Test Files  1 passed (1)
      Tests  67 passed (67)
$ npm run typecheck
> tsc --noEmit          (0 erreur)
$ npm run lint
✖ 45 problems (0 errors, 45 warnings)   (warnings préexistants, aucun fichier de la tâche)
```

### Captures — suite e2e et rendu

`tests/e2e/littoral-captures.e2e.spec.ts`, sur le modèle de
`village-captures.e2e.spec.ts` : compose la commune de démonstration le temps
des captures (frise, coordonnées maritimes, deux actualités ajoutées aux deux
de la démo, quatre événements pour la courbe — l'accueil plafonne l'agenda à
quatre, `Accueil.tsx` l. 54 —, photos de `J-maquette-littoral/images/`),
capture l'accueil à 1440 et 390 px avec puis sans aucune photo, et remet la
commune dans son état d'origine champ par champ. Les photos vivent hors dépôt
(sources ignorées par git) : la suite passe son tour (`test.skip`) là où
elles manquent plutôt que d'échouer.

- **frise** : la `COMPOSITION` de J portée en lignes « pièce + taille +
  écart », avec deux écarts adaptés — le champ `ecart` est `min: 0` dans
  `Communes.ts` (l. 449), le `-40` qui chevauchait le phare sur la jetée
  n'est pas saisissable dans l'admin (aucun changement de schéma : ancre 3) ;
  l'écart du phare passe à 0 et, la frise dépassant alors les 1440 du
  viewBox, le dernier écart de 30 à 0 — total 1438 px, ordre des pièces
  inchangé ;
- premier passage rouge réel : le PATCH de la commune refusé
  (`ecart: -40 est inférieur au min autorisé`), corrigé comme ci-dessus.

```
$ npm run test:e2e -- littoral-captures
  1 failed  (PATCH /api/communes/1 → 400 : ecart -40 inférieur au min 0)
$ npm run test:e2e -- littoral-captures   (après correctif)
  ✓ avec photos : la commune composée comme la maquette J
  ✓ sans aucune photo : héros, actualités et mosaïque illustrés (I30)
  2 passed (18.1s)
```

Les quatre captures copiées aussitôt dans `src/gabarits/littoral/maquette/captures/`
(Playwright vide `test-results/` à chaque run), puis regardées et comparées à
celles de J :

- **ressemblances** — les bandes pâle/profonde séparées par les vagues en
  dégradés (marées approchées, visibles à pleine échelle dans les marges), le
  héros panorama terminé par la frise au trait blanc sur la photo, la rive
  mairie en casettes puis les démarches en deux colonnes à pastilles, la une
  en grand pavé pâle au visuel débordant jusqu'au bord de l'écran, l'agenda
  profond aux dates d'accent posées sur les arcs pointillés (quatre
  événements : haut, bas, haut, bas), la mosaïque décalée au libellé serif
  sous l'image, la frise en silhouettes pleines sur blanc avant le pied
  profond. Sans photo, le héros dessiné, la une illustrée et les quatre tuiles
  en scènes : aucun emplacement vide (I30) ;
- **écarts déjà documentés** (rien de nouveau à pleine échelle) : blason de
  l'en-tête, pastille « ouvert » de la mairie et tableau des horaires du pied
  (aucun crochet dans le balisage commun), ligne de mer sur la une, ornement
  sable de la mosaïque.

### Conformité — deux correctifs après le premier passage rouge

Premier passage de `npm run test:e2e -- gabarits-conformite` : 1 failed au
point 5 (palettes extrêmes), palette `#ffff00` —
`« Actualités » rgb(32, 33, 15) sur rgb(122, 122, 15) : 3.59 < 4.5`. Le test
ne se modifie pas ; diagnostic par une sonde jetable (script hors git dans
`test-results/`, supprimé après usage) rejouant la mesure du point 5 sur la
palette jaune et imprimant l'élément en échec :

- l'élément fautif est le **bouton du texte libre**
  `section.section-texte-libre > section.bloc.bloc-boutons > a.bouton` (« Actualités »,
  le bouton de la page d'accueil de la démo) ; `rgb(122,122,15)` =
  `--principale-sure` (4,55:1 sur blanc, mesuré), pas `--profond` (7:1,
  `#3b3b04`) ;
- cause : ma règle `.section-texte-libre a { color: var(--encre) }` (décision
  17, liens de prose sur bande pâle) a une spécificité (0,1,1) qui écrase le
  `color: var(--couleur-texte-blanc)` du socle sur `.bouton--primaire`
  (0,1,0, `styles.css` l. 310-313) — texte encre sur fond principale-sure.
  Village ne voit pas le cas : sa section texte libre reste sur fond blanc,
  il ne surcharge pas ces liens ;
- correctif 1 : `.section-texte-libre a:not(.bouton)` — les liens de prose
  restent en encre, les boutons du contenu (bloc-boutons, CTA d'un bloc-hero)
  gardent la livrée du socle ;
- la sonde rejouée révèle alors le **bouton secondaire** : le socle le met en
  `var(--couleur-principale)` garantie sur blanc seulement — 4,13:1 sur ma
  bande pâle. Correctif 2 : `.section-texte-libre .bouton--secondaire` passe
  son texte en encre (même motif que la décision 17). Sonde : 0 échec sur les
  trois palettes `#ffff00`, `#777777`, `#3b0a14`.

Second passage : 1 failed au point 8 — licence de `PublicSans-latin-variable.woff2`
introuvable. La convention (test l. 435-440, celle de Village :
`atkinson-LICENSE.txt` pour `AtkinsonHyperlegibleNext-…`) exige que le préfixe
de la licence soit le début exact du nom de police ; `public-sans-` n'y est
pas (`PublicSans-`). Correctif 3 : `git mv` de la licence vers
`publicsans-LICENSE.txt` (contenu inchangé), README mis à jour. La table des
sha256 plus haut garde l'ancien nom de fichier : la somme est celle du
contenu, inchangé par le renommage.

```
$ npm run test:e2e -- gabarits-conformite   (après les trois correctifs)
  14 passed (31.2s)
```

## Fin de tâche — vérifications finales

Rejouées après les correctifs de conformité, sorties telles quelles :

```
$ npm run typecheck
> tsc --noEmit          (0 erreur)
$ npm run lint
✖ 45 problems (0 errors, 45 warnings)   (warnings préexistants, aucun fichier de la tâche)
$ npm run test:unit
 Test Files  30 passed (30)
      Tests  278 passed (278)
$ npm run test:int
 Test Files  24 passed (24)
      Tests  222 passed (222)   (premier coup)
$ npm run test:e2e        (complet, une seule fois)
  51 passed (1.7m)
```

`git diff --stat 62b42a8 -- src/gabarits/village` vide (I26, aussi vide sur
`src/payload-types.ts` : la tâche ne touche pas le schéma). Piège déjà noté en
tâche 7 : chaque run e2e fait régénérer `src/payload-types.ts` par le serveur
de développement avec l'environnement du worktree (diff du seul commentaire
Umami de `mesure.active`) — restauré par `git checkout --` après chaque run.
`git status --short` vide au final.

## Ce que je n'ai pas pu vérifier

- la comparaison à la maquette J s'est faite à l'œil sur les captures (section
  « Captures » ci-dessus), pas par superposition ou mesure pixel ;
- la suite e2e ne joue que Chromium : Safari et Firefox non éprouvés ;
- le 390 px est un viewport simulé, pas un vrai appareil tactile ;
- la fidélité géométrique du portage Python : les tests vérifient des SVG
  bien formés aux trois tailles et des chemins non vides, pas l'égalité des
  tracés avec `frise_littoral.py` ;
- le point 5 de la conformité couvre trois palettes extrêmes (`#ffff00`,
  `#777777`, `#3b0a14`), pas toutes les couleurs saisissables — la sonde de
  diagnostic était hors git et a été supprimée ;
- le rendu n'a été éprouvé que sur la commune de démonstration ;
- aucune clé corse neuve : la tâche n'a touché aucun fichier d'i18n
  (`git diff --name-only 62b42a8` — rien à faire relire).


## Après relecture

Relecture reçue : REJECTED, 2 majeurs sur les captures (« le code et les
tests sont sains »). Correction dans l'ordre demandé, un commit par point.

### M2 — la page débordait du viewport à 1440 px

Mesures : les quatre captures commitées faisaient **1713 px** de large à
1440 (390 exact à 390), `test-results/gabarits/littoral-1440.png` aussi.

Cause — le visuel de la une est un item de grille (colonne 2 du grid
`1fr 1.35fr` de `.actu:first-child`) ; son `margin-right:
calc(50% - 50vw)` résout le `50%` contre sa **zone de grille** (~693 px),
pas contre la colonne centrée du viewport : le débordement tirait ~273 px
au-delà du bord droit de l'écran. `overflow-x: clip` sur body ne l'a jamais
écrasé : propagé au viewport, `clip` y devient `hidden` — la page restait
1713 px de large et scorable (c'est ce que mesurait `scrollWidth`). Le
passage des notes ci-dessus qui prétendait le contraire est corrigé.

Correctif (l'option « sans 50vw » de la relecture) : variable
`--debord: max(1.25rem, calc((100vw - var(--largeur)) / 2 + 1.25rem))`,
jumelle de `--gouttiere` en unités de viewport — `100vw` se résout contre
l'écran partout, y compris dans un item de grille. Les deux marges
(l. 596 bureau, l. 955 mobile) passent à `calc(-1 * var(--debord))` : le
débordement va du bord de colonne au bord de l'écran, exactement la
gouttière (116 px à 1440, plancher 20 px à 390), jamais au-delà. Géométrie
de la maquette conservée : à 390, `50% - 50vw` valait déjà −20 px de
chaque côté, identique au plancher de `--debord`.

Assertion demandée, ajoutée dans `capturer()` avant chaque capture, aux
deux largeurs :

```
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      `à ${largeur} px, la page déborde du viewport`,
    ).toBeLessThanOrEqual(largeur)
```

Vue échouer avant le correctif :

```
$ npm run test:e2e -- littoral-captures   (assertion seule, avant correctif)
    Error: à 1440 px, la page déborde du viewport
    Expected: <= 1440
    Received:    1713
  1 failed
```

Puis passante après le correctif (`2 passed (18.2s)`), captures refaites à
**1440 et 390 px exactement** (mesurées `sips -g pixelWidth`). Le clip de
body reste en place : sans débordement il ne sert plus, mais il ne nuit pas
et l'assertion nouvelle surveille toute régression.

### M1 — captures périmées : bouton illisible, soleil coupé

Les quatre PNG commités dataient de `6d02b14` : le correctif `08413e5`
(boutons du texte libre rendus avec la livrée du socle) n'y était pas.
Après M2, la suite `littoral-captures` a été relancée (`2 passed`), les
quatre PNG recopiés depuis `test-results/gabarits/` vers
`src/gabarits/littoral/maquette/captures/`, puis examinés.

L'examen a été programmatique (PIL, mesures de pixels) : dans cette
session, la lecture d'un PNG ne rend plus l'image (l'outil la téléverse et
retourne une URL). Les mesures ci-dessous couvrent les trois points de la
relecture — bouton lisible, largeur exacte, rien qui déborde — et le
soleil de la une.

**Largeurs mesurées** (`sips -g pixelWidth`) : `littoral-photos-1440.png`
1440×4909, `littoral-photos-390.png` 390×7250,
`littoral-sans-photo-1440.png` 1440×4771, `littoral-sans-photo-390.png`
390×6582. Rien ne déborde : l'assertion M2 est passée aux deux largeurs.

**Bouton « Actualités »** (primaire du bloc boutons du texte libre,
fond `#264653` = couleur principale de saint-ex). Comparaison
ancienne (extraite de `git show 6d02b14:…`) / nouvelle, même pilule,
intérieur compté pixel à pixel (clairs > 230 vs sombres < ~90) :

- ancienne `photos-1440`, pilule y1513-1563 x81-314 (233×50 px) :
  **0 px blancs, 4722 px sombres** — texte foncé sur bleu nuit, le défaut
  signalé ;
- nouvelle `photos-1440`, même zone : **337 px blancs** — texte blanc,
  lisible ;
- nouvelle `photos-390`, pilule y1950-2001 x24-257 : **337 px blancs**,
  lisible aussi.

Lisibilité par construction, pas par ce seul rendu : le socle pose
`--couleur-principale: var(--principale-sure)` (`styles.css` l. 25) et
`.bouton--primaire` écrit « fond couleur principale, texte blanc »
(`styles.css` l. 310-313) ; `--principale-sure` n'est validée par
`couleurs.ts` (l. 237) que si son contraste sur blanc est ≥ 4,5:1.
Mesuré ici : `#264653` sur `#fff` ≈ **10:1**. Les autres taches sombres
comparées (y3816-3958 à 1440, y5943 à 390) sont identiques dans les deux
captures : éléments de la mosaïque et des scènes, pas des boutons.

**Soleil de la une** (demandé : « coupé en haut dans la capture 1440
sans photo ») — il l'était, et M2 l'a réparé :

- ancienne `sans-photo-1440` (1713 px de large) : disque orange
  (`#E2A72E` = accent par défaut, `couleurs.ts` l. 33) y1821-1948
  x1414-1575, **première ligne large de 131 px = corde plate**, blanc
  franc au-dessus → coupé net en haut ;
- nouvelle `sans-photo-1440` : disque y1857-1977 x1216-1336 (Ø ~120 px),
  premières largeurs de ligne 21→30→37→43→47 = **arc régulier**, ciel
  (230,247,254) au-dessus → disque entier ;
- nouvelle `sans-photo-390` : tous les disques orange de la page
  (soleil de la une, bouées, yeux des scènes) démarrent par un arc étroit
  (4-24 px sur des Ø 57-68) → entiers.

Explication géométrique, effet collatéral de M2 : avant, le débordement
élargissait la page à 1713 px et le visuel de la une à ~946 px ; la coupe
haute de son cadre (≈ 126 px) mangeait le haut du soleil (à ≈ 113 px,
mis à l'échelle). Après M2, le visuel fait ~789 px (échelle 0,99), la
coupe haute ≈ 67 px, et le haut du soleil repose à ≈ 28 px sous le bord :
entier. Rien d'autre à corriger pour lui.

### m3 — marées rendues : lobes ovales, pas les vagues de la maquette

Écart confirmé et assumé : sur le rendu, les transitions entre bandes
(texte libre, agenda) sont des **lobes ovales répétés**, pas les vagues
continues, lissées de cubiques, de la maquette J. Ce n'est pas une erreur
de portage :

- le portage est fidèle : `vague()` (`frise.ts` l. 225-242) reprend
  `_vague()` du Python (`frise_littoral.py` l. 202-209) nombre pour
  nombre (mêmes cubiques, mêmes points de contrôle), et `maree()`
  (`frise.ts` l. 250-256) appelle exactement les mêmes vagues que le
  `maree()` de la maquette (Python l. 212-218 : `_vague(34, 16, 520,
  120)` et `_vague(52, 10, 380, 0)`, écume pareille) ;
- mais ce SVG ne se rend pas : le contrat n'expose `ornements` qu'en
  optionnel (`types.ts` l. 58) et **rien dans le balisage commun ne le
  consomme** (grep sur `ornements` : seul `types.ts`). La transition
  rendue est l'approximation CSS de `theme.css` l. 453-510 : deux
  `radial-gradient(140px 26px / 140px 20px at 50% 100%, …)` répétés
  toutes les 280 px (`background-size`) sur une base pleine de 14 px —
  un gradient radial répété donne des demi-ellipses, d'où les lobes ;
- les teintes `--vague-pale` / `--vague-profond` (`theme.css` l. 57-58)
  suivent la formule de `maree()` (mix 50 % dessous/dessus, puis 88 % à
  principale-sure), donc l'approximation reste dans la livrée.

L'écart est documenté (`README.md` du gabarit, « Ce que le rendu n'a pas
et que la maquette montre », l. 66-72 : l'ornement SVG `maree` « approché
en CSS par des vagues en dégradés »). Le SVG exact reste exporté dans
`kit.ornements`, prêt à se rendre le jour où le balisage commun offre un
crochet pour l'ornement.
