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
  `/api/communes/1`) alors que les GET passaient. Origine `localhost:3007`
  absente de la liste admise par le contrôle CSRF : en dev elle vaut
  `ADMIN_URL` + `http://localhost:3000` uniquement (payload.config.ts l. 58-61,
  passée à `csrf` l. 107). Sur 3000, les 4 tests repassent (sortie ci-dessous).
  Le port de travail est donc 3000 pour toute la session.
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

## 2. Correction (`e71e1ac`, remplace `45a0024` par amend)

Deux règles ajoutées dans le bloc `@media (max-width: 43.75rem)` (l. 1013), rien
ailleurs dans le fichier :

```css
  /* La rive repasse sur une colonne : une casette par ligne, pleine largeur. */
  .section-mairie {
    grid-template-columns: 1fr;
  }

  /* Adresse et courriel perdent la limite de 22rem du bureau : leurs filets
     doivent couvrir toute la largeur de la casette, comme les autres. */
  .section-mairie p:not(:has(strong)) {
    max-width: none;
  }
```

La seconde règle vient d'une mesure : après la première correction, l'adresse et
le courriel restaient à **374 px** sur une piste de 657,5 px à 700 px. Cause :
`.section-mairie p:not(:has(strong)) { max-width: 22rem }` (theme.css l. 384-386)
— 22 rem × 17 px (racine à 106,25 %, l. 62) = 374 px. Cette limite du bureau
raccourcissait les filets de deux casettes entre ~417 et 700 px, contre le
« pleine largeur » de la décision tranchée ; levée sous 43,75rem uniquement.

**Relecteur (guia-3b), après `e71e1ac`** : l'amend est accepté, mais plus aucun
`--amend` à partir de maintenant — un commit par changement, pour suivre les
diffs entre relectures. Appliqué : les commits suivants sont neufs. (Sa
consigne précédente — sourcer l'explication du 403 — est traitée au paragraphe
du port 3007 ci-dessus, payload.config.ts l. 58-61 et l. 107.)

## 3. Mesure après (`e71e1ac`)

Captures relancées : `E2E_PORT=3000 npx playwright test gabarits-captures
--grep "Littoral"` → **4 passed (15,5 s)**. Les quatre 390 px sont copiées dans
`docs/qc/captures-littoral-390/` (deux jeux de couleurs, avec et sans photos).

Relevé DOM (même script jetable, viewports 375 → 1440) :

| Viewport | Grille (computed) | Casettes (largeur) | scrollWidth |
| --- | --- | --- | --- |
| 375 | `332.5px` | toutes 332,5 | 375 |
| 390 | `347.5px` | toutes 347,5 | 390 |
| 500 | `457.5px` | toutes 457,5 | 500 |
| 600 | `557.5px` | toutes 557,5 | 600 |
| 700 | `657.5px` | toutes 657,5 | 700 |
| 701 | `370.516px 253.984px` | 370,5 / 254 alternées | 701 |
| 1440 | flex (`none`) | 111 / 216 / 579,3 / 261,8 / 255,8 | 1440 |

Lignes réelles à 390 px (caractères groupés par le haut de leur rectangle de
portée — preuve programmatique) :

- Horaires : « Horaires : » / « Lundi, mardi, jeudi, vendredi : 9 h – 12 h, » /
  « 14 h – 17 h. Mercredi : 9 h – 12 h. » — plus aucun mot isolé par ligne.
- Adresse : « 1 quai de la Mairie » / « 01100 Saint-Exupéry-sur-Mer ».
- Courriel : « mairie@saint-exupery-sur-mer.fr » **sur une seule ligne**. La
  décision demandait une règle de coupure seulement « s'il déborde encore » :
  il n'y a pas de règle de coupure à ajouter.

Réserve de méthode : dans le tableau « avant », les nombres de lignes venaient
de hauteur ÷ line-height, qui compte l'étiquette `strong` (`display: block`,
l. 375-376) pour une ligne à part et surestime d'environ une ligne ces `p`
(avant/après utilisent des méthodes différentes). Le point de comparaison reste
valide : à 107,5 px de large, la colonne d'horaires était illisible ; le groupage
des caractères d'avant montrait déjà un mot par ligne.

700/701 : voir la remarque en fin de section 1 — `max-width` est inclusif, la
requête s'applique à 700 px pile (une colonne) ; les deux colonnes reviennent
dès 701. À 1440, largeurs identiques à la mesure avant : rive flex inchangée.

Captures regardées : la pleine page 390 (2a7f9e, photos) a été consultée —
l'empilement général de la rive y est visible, mais le texte est illisible à
l'échelle de restitution (390×7185 réduits). Les recadrages du bloc mairie
n'ont pas été restitués visuellement par l'outil de lecture de cette session
(URL CDN sans rendu, trois essais, y compris sur des fichiers du dépôt) : la
description fine ci-dessus s'appuie sur le groupage programmatique des
caractères rendus. « Documents » apparaît deux fois au menu sur les captures :
attendu (données de développement, hors périmètre, notes-tache-05a.md).

## 4. Test — `tests/e2e/littoral-mairie-390.e2e.spec.ts`

Fichier neuf plutôt qu'un ajout au spec de captures : l'assertion vise une
seule rupture sur une composition minimale (gabarit + coordonnées + horaires,
sans photos ni frise) et doit être rejouée avant/après — quelques secondes,
sans relancer les seize captures.

Trois tests (`describe.serial`, `afterAll` remet la commune en état) :
à 390 chaque casette occupe la largeur entre gouttières à 2 px près et la page
ne déborde pas ; à 600 même assertion (verrouille la levée de la limite 22rem) ;
à 701 deux pistes de grille et aucune casette pleine largeur.

**Avant** (CSS de `23a0183` posé dans le fichier de travail via `git show`,
puis restauration par `git checkout --`) :

    à 390 :  1 failed — casette 1/5 : 107.46875px sur 347.5px
             Expected: > 345.5        (2 did not run — describe.serial)
    à 600 (--grep 600) : 1 failed — casette 1/5 : 269.515625px sur 557.5px
             Expected: > 555.5

**Après** (`e71e1ac`) :

    Running 3 tests using 1 worker
      ✓ à 390 px, chaque casette occupe toute la largeur de la rive, sans défilement (814ms)
      ✓ à 600 px, pleine largeur aussi pour l'adresse et le courriel (limite 22rem levée) (720ms)
      ✓ à 701 px, juste au-dessus de la rupture, les deux colonnes restent (665ms)
    3 passed (6.9s)

## Journal

- `96804de` — squelette de ces notes (ancres vérifiées, cadre).
- `45a0024` → `e71e1ac` (amend accepté par le relecteur, dernier du genre) :
  correction CSS, deux règles dans le bloc 43,75rem + notes sections 1-2.
- (ce commit) — test e2e `littoral-mairie-390` + notes sections 3-4.

