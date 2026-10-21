# Bloqué — lot 2, étape 5 : un e2e de la tâche 10 exige des photos de maquette volontairement hors dépôt

Découvert le 21/10/2026 à la vérification finale du brief
(`E2E_PORT=3000 npm run test:e2e`). Conformément à la consigne, rien n'a été
corrigé : l'échec n'est ni un bug du lot 2 ni déclenché par lui — c'est un
test de la tâche 10 (gabarits-couleurs) qui lit des images de maquette
délibérément non versionnées, et dont la garde de saut ne peut pas s'exécuter
dans un worktree neuf. Le lot 2 est vert partout ailleurs : lint, typecheck,
unit (317), int (236) et les 80 autres e2e.

## Ce que j'ai mesuré

```
$ E2E_PORT=3000 npm run test:e2e
  1 failed, 6 skipped, 3 did not run, 80 passed (2,5 min)

  1) [chromium] › tests/e2e/gabarits-captures.e2e.spec.ts:423:5 › Captures du
     gabarit Littoral — deux jeux de couleurs (tâche 10) › jeu #2a7f9e avec
     photos : gabarit composé, dérivation appliquée

     Error: ENOENT: no such file or directory, open
     '/Users/matthieucredou/Projects/glm.conformite/docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images/phare-pano-2000.jpg'
       at televerser (tests/e2e/gabarits-captures.e2e.spec.ts:214:19)
       at tests/e2e/gabarits-captures.e2e.spec.ts:347:22
```

Les 3 « did not run » sont les trois autres tests du même `describe.serial`
(arrêt en cascade). Rejoué seul, le fichier échoue à l'identique.

## Pourquoi l'échec est externe au lot 2

1. **Les images n'ont jamais été versionnées** — elles vivent uniquement
   dans le checkout principal :

   ```
   $ git ls-files docs/recherche/ | wc -l
     0
   $ git log --all --oneline -- docs/recherche/ | wc -l
     0
   $ git check-ignore -v docs/recherche/…/phare-pano-2000.jpg
     /Users/matthieucredou/Projects/glm/.git/info/exclude:7:docs/recherche/
   $ ls /Users/matthieucredou/Projects/glm/docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images/ | wc -l
     37
   ```

   Un worktree ne contient que les fichiers suivis : l'absence est
   déterministe, indépendante de la branche. Le dépôt le sait —
   `littoral-captures.e2e.spec.ts` l. 166 saute proprement avec le message
   « photos de la maquette J absentes (hors dépôt, docs/recherche) ». Ce
   sont ces sauts déclarés qui font les 6 skipped.

2. **La garde de `gabarits-captures` ne peut pas agir** : `avecPhotos`
   (l. 263) ne protège que les corps de test (l. 424 et 450), mais le
   téléversement est dans le `beforeAll` non gardé (l. 344-348) — l'ENOENT
   y lève avant tout `test.skip`, d'où 1 failed + 3 did not run au lieu de
   4 skipped. Là où les images existent (checkout principal, où la tâche 10
   a été vérifiée), le `beforeAll` passe et la faille est invisible.

3. **Aucun lien avec le lot 2** : `grep -rln 'nomenclature\|codeInsee'
   tests/e2e/` → aucun fichier ; le gabarit village du même spec (images
   suivies : 17 fichiers sous `src/gabarits/village/maquette/images/`)
   passe, ainsi que les 79 autres tests.

## Options

1. **Ne rien corriger dans le lot 2** : rejouer la suite e2e depuis le
   checkout principal, où les 37 images vivent — le lot 2 ne touche aucun
   fichier e2e.
2. **Réparer la garde** (hors périmètre du brief — fichier de la tâche 10) :
   poser le saut au niveau du `describe` quand `!avecPhotos` (comme
   `littoral-captures` l. 166), pour obtenir 4 skipped au lieu de
   1 failed + 3 did not run dans tout worktree neuf. Deux lignes, à décider
   par Matthieu, idéalement sur `main`.
3. **Copier les 37 images dans le worktree** (le `.git/info/exclude` est
   partagé : elles resteraient non suivies, sans effet sur le statut) pour
   un passage vert ici même — masque la faille de garde pour une seule
   course.
4. **Versionner les images de maquette** dans le dépôt — décision produit
   (poids du dépôt, provenance des photos), sans rapport avec le lot 2.

## Recommandation

Option **1** pour le lot 2 : l'échec est déterministe, externe et documenté
ici. L'option **2** vaut d'être faite à l'occasion sur `main` : elle
rendrait la suite e2e honnête dans tout worktree neuf, indépendamment du
lot 2.
