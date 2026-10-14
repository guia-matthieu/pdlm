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
  (`margin: -2.6rem calc(50% - 50vw) 0 0`, dépassement écrasé par
  `overflow-x: clip` sur body). La ligne de mer de la maquette sur ce visuel
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


