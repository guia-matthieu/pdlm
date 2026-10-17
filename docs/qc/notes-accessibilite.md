# Accessibilité — axe sur tout le site public

Brief : `~/Projects/guia/tasks/2026-10-17_brief-glm-accessibilite-axe.md`.
Branche `gabarits-accessibilite`, partie de `main` à `651e31f`. Audit axe
étendu à tout le site public, corrections règle par règle, test de
non-régression. Ces notes se complètent à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `gabarits-conformite.e2e.spec.ts` l. 300-307 (axe, accueil seul, défaut) | test « 4 — axe : aucune violation d'accessibilité sur l'accueil », `AxeBuilder` sans `withTags` ni viewport | ✅ |
| `gabarits-captures.e2e.spec.ts` l. 300-340 (pose composition + couleurs) | l. 300-321 `habiller(jeu, avec)` : PATCH commune (3 couleurs, photos), PATCH des 4 actualités | ✅ |
| `gabarits-captures.e2e.spec.ts` l. 405-415 (remise en état) | l. 398-417 : PATCH champ par champ + images des actualités de démo, puis `nettoyer()` | ✅ |
| `src/gabarits/registre.ts` | `GABARITS` : `village` requis, `littoral` compris | ✅ |
| Palettes captures `#2a7f9e` et `#9b3d57` | l. 26-28 `JEUX` : `{ principale: '#2a7f9e', accent: '#f2b134', terre: '#d2462f' }`, `{ principale: '#9b3d57', accent: '#7fc4c9', terre: '#e08a2c' }` | ✅ |

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets`. Serveur de développement sur le **port 3000** (sur 3007,
  Payload refuse les écritures), démarré par Playwright (`webServer`,
  `reuseExistingServer`) pour les specs, arrêté par lui-même ; `lsof -i :3000`
  vérifié vide au départ.
- `.env` du worktree non lu, aucune migration, `DATABASE_URI` jamais pointée
  sur `pdlm`. Événements de démonstration : à contrôler au premier run
  (décalés au 23/10, `notes-suites-1440.md` § Tâche A — au 17/10 ils sont
  encore à venir, à re-vérifier).
- Périmètre : pages `src/app/(frontend)/[lang]/` — accueil, `actualites`,
  une actualité, `agenda`, `documents`, une page de contenu `[slug]`,
  `mesure-d-audience` ; gabarits `village` et `littoral` ; largeurs 390 et
  1440 px ; palette de démonstration + les deux jeux des captures (sur
  l'accueil et une page intérieure au moins) ; tags axe
  `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`.

## Audit avant

(à compléter)

## Corrections

(à compléter — une règle par commit)

## Test

(à compléter)

## Clôture

(à compléter)

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
