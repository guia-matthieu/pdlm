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
