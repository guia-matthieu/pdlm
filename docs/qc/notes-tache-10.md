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
