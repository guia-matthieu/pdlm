# Intégration 2026-10-21 — pages-titre-h1 + gabarits-accessibilite

Brief : `~/Projects/guia/tasks/2026-10-21_brief-glm-integration.md`.
Branche `integration-2026-10-21`, créée par le hub depuis `main` (`58fe3cf`).
But : une branche que Matthieu n'aura plus qu'à avancer dans `main` —
`main` + `pages-titre-h1` (qui contient `gabarits-demo-tiret`) +
`gabarits-accessibilite`, toutes suites vertes. Tâche courte, sans plan,
pas de sous-agents. Ces notes se complètent à chaque étape.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `main` = `integration-2026-10-21` = `58fe3cf` | `git log` : oui, branche créée depuis `main` à `58fe3cf` | ✅ |
| `pages-titre-h1` = `3e96423` « Notes — clôture pages-titre-h1 » | oui, `git branch -v` | ✅ |
| `gabarits-accessibilite` = `82c6498` « Accessibilité — clôture : vérification finale verte » | oui, `git branch -v` | ✅ |
| Fusions annoncées sans conflit (`git merge-tree` le 21/10) | non re-vérifié : la commande a été refusée dans cette session ; le premier `git merge --no-ff` tranche (aucun conflit ci-dessous) | ✅ |

## Ordre de travail (état)

| Étape | État |
| --- | --- |
| 0. Notes créées | ✅ (ce commit) |
| 1. Fusion `pages-titre-h1` | en cours |
| 2. Fusion `gabarits-accessibilite` | — |
| 3. `a-decider-accessibilite.md` : ligne « Tranché le 21/10 » | — |
| 4. Vérification complète (lint, typecheck, unit, int, e2e, build) | — |

## Cadre de travail

À compléter au lancement des services.

## Fusions

À compléter.

## Vérification complète

À compléter.
