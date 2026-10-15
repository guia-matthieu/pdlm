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
- Serveur de développement : `npm run dev -- --port 3000` lancé par cette
  session, arrêté à la fin. Playwright le réutilise (`E2E_PORT=3000`,
  `reuseExistingServer` hors CI, playwright.config.ts l. 74).
  **Essai préalable sur le port 3007 abandonné** : `E2E_PORT=3007 npx
  playwright test gabarits-captures --grep "Littoral"` échouait en 403 « Vous
  n'êtes pas autorisé » sur toute mutation (POST `/api/media`, PATCH
  `/api/communes/1`) alors que les GET passaient — le `serverURL` de Payload ne
  couvre pas l'origine `localhost:3007`, contrôle CSRF refuse les écritures.
  Sur 3000, les 4 tests repassent (sortie ci-dessous). Le port de travail est
  donc 3000 pour toute la session.
- Aucune migration, aucun champ Payload touché.

## 1. Mesure avant (base 23a0183 + notes, sans correction)

Captures relancées :

    E2E_PORT=3000 npx playwright test gabarits-captures --grep "Littoral"
    → 4 passed (21.8s)   [jeu #2a7f9e et #9b3d57, avec et sans photos]

Sorties : `test-results/gabarits/t10/littoral-*-390.png` (et 1440).

Relevé DOM par script Playwright jetable (`mesure-mairie.tmp.ts`, supprimé en
fin de session) : commune `saint-ex` composée comme le spec de captures
(gabarit littoral, mêmes coordonnées et horaires, puis remise en état).
Chaque casette de `.section-mairie` est un enfant direct (H2, `A.mairie__tel`,
trois `P`). Nombre de lignes = hauteur ÷ line-height (27,2 px).

| Viewport | Grille (computed) | Casettes (largeur) | Horaires | Adresse | Courriel | scrollWidth |
| --- | --- | --- | --- | --- | --- | --- |
| 390 | `107.469px 208.25px` | 107,5 / 208,3 / 107,5 / 208,3 / 107,5 | **9 lignes** (valeur) | 4 lignes | **4 lignes** | 390 |
| 700 | `369.516px 253.984px` | 369,5 / 254 / 369,5 / 254 / 369,5 | 3 lignes (valeur) | 3 lignes | 2 lignes | 700 |
| 1440 | flex (hors rupture) | 111 / 216 / 579,3 / 261,8 / 255,8 | 3 lignes | 4 lignes | 3 lignes | 1440 |

À 390 : la colonne 1 (107,5 px) reçoit le titre, les horaires et le courriel —
d'où un mot par ligne dans les horaires et un courriel replié sur ses traits
d'union (`saint-`, `exupery-`, `sur-`, `mer.fr`). Pas de débordement horizontal
même avant : les traits d'union offrent des points de coupure. Le défaut
relevé dans notes-tache-10.md l. 111/115 est reproduit.

Remarque sur la rupture : 43,75 rem = 700 px tout rond (dans une requête
média, `rem` s'évalue contre la taille de police initiale, pas contre le
`html { font-size: 106.25 % }` de theme.css l. 62) et `max-width` est inclusif :
à exactement 700 px la requête s'applique. Le « 700 px juste au-dessus de la
rupture » du brief sera donc vérifié aussi à 701 px (mesure après).

## Journal

(en cours)
