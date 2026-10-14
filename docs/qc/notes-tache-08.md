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
