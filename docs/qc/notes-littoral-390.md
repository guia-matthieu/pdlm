# Littoral 390 — rive mairie sur une colonne

Brief : `~/Projects/guia/tasks/2026-10-15_brief-glm-littoral-390.md`.
Branche `gabarits-littoral-390`, base `main` à `23a0183`. Une correction CSS,
sans plan. Ces notes se complètent à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `docs/qc/notes-tache-10.md` l. 111 et l. 115 | l. 111 (`littoral-2a7f9e-photos-390`) et l. 115 (`littoral-9b3d57-photos-390`) : horaires un mot par ligne, courriel sur trois lignes | ✅ |
| `theme.css` l. 324-386 (rive en bureau) | l. 326 `.section-mairie` en flex, l. 366 `.mairie__tel { white-space: nowrap }` | ✅ |
| `theme.css` l. 893-935 (première rupture) | l. 893 `@media (max-width: 56.25rem)`, l. 912-918 grille `repeat(2, auto)` | ✅ |
| `theme.css` bloc commençant l. 1013 | l. 1013 `@media (max-width: 43.75rem)` | ✅ |

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets` → postgres, minio (healthy), createbuckets up.
- Serveur de développement : `npm run dev -- --port 3007` lancé par cette
  session, arrêté à la fin. Playwright le réutilise (`E2E_PORT=3007`,
  `reuseExistingServer` hors CI, playwright.config.ts l. 74).
- Aucune migration, aucun champ Payload touché.

## Journal

(en cours)
