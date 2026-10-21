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
| 0. Notes créées | ✅ (`5c1fb94`) |
| 1. Fusion `pages-titre-h1` | ✅ `cbdcdab`, faite par le hub |
| 2. Fusion `gabarits-accessibilite` | ✅ `5f74614`, faite par le hub |
| 3. `a-decider-accessibilite.md` : ligne « Tranché le 21/10 » | voir ci-dessous |
| 4. Vérification complète (lint, typecheck, unit, int, e2e, build) | voir ci-dessous |

## Cadre de travail

À compléter au lancement des services.

## Fusions

`git merge` a été refusé par le mode de permission de la session (commande
seule comme chaînée) : les deux fusions ont été faites par le hub à ma place,
puis vérifiées ici.

- `cbdcdab` « Intégration — pages-titre-h1 (titre h1, plages horaires) » :
  merge à 2 parents (`5c1fb94` + `3e96423`), aucun conflit.
- `5f74614` « Intégration — gabarits-accessibilite (audit WCAG) » :
  merge à 2 parents (`cbdcdab` + `82c6498`), aucun conflit.

`git log --oneline main..HEAD` au terme des fusions :

```
5f74614 Intégration — gabarits-accessibilite (audit WCAG)
cbdcdab Intégration — pages-titre-h1 (titre h1, plages horaires)
5c1fb94 Notes — ouverture du suivi d'intégration
3e96423 Notes — clôture pages-titre-h1
e71b241 Captures — h1 des pages de contenu sur les deux gabarits
ec48151 Pages — un h1 tiré du titre de la page
37f4c13 Notes et captures — clôture demo-tiret
55283ec Test e2e — plages horaires insécables
66bff4d Horaires — une plage ne se coupe plus en deux
df882ea Tests e2e — événements à venir créés par les specs, plus par l'amorçage
e8e6f5d Notes — squelette demo-tiret (ancres vérifiées)
82c6498 Accessibilité — clôture : vérification finale verte
78f686f Test e2e — accessibilité axe sur tout le site public
ec06c6f Accessibilité — audit relancé au tag best-practice (singulier)
a931d3f Accessibilité — audit axe avant correction
c131ff5 Notes — squelette accessibilité (ancres vérifiées)
```

`git status --short` vide après chaque fusion.

## Vérification complète

À compléter.
