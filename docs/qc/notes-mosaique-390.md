# Mosaïque 390 — une tuile par ligne sous 700 px

Brief : `~/Projects/guia/tasks/2026-10-16_brief-glm-mosaique-390.md`.
Branche `gabarits-mosaique-390`, partie de `gabarits-littoral-390` à
`75efdf6`. Deux corrections CSS (mosaïque littoral et village), sans plan.
Ces notes se complètent à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `src/gabarits/sections/Mosaique.tsx` (mosaïque) | 83 lignes ; `.mosaique > li` > (`a` \| `.mosaique__tuile`) > (`img` \| `.mosaique__scene`) + `.mosaique__libelle` | ✅ |
| Littoral `theme.css` l. 993-1004 : 2 colonnes + décalage sous 900 px | l. 993-1004, dans `@media (max-width: 56.25rem)` ouvert l. 893 (56,25 rem = 900 px) : `repeat(2, 1fr)` et `li:nth-child(even) { margin-top: 2.2rem }` | ✅ |
| Littoral l. 783-786 : 1re tuile en 5/6 | `.mosaique > li:first-child img, … .mosaique__scene { aspect-ratio: 5 / 6 }` | ✅ |
| Littoral bloc `@media (max-width: 43.75rem)` l. 1013 | l. 1013, dernier bloc du fichier (1035 lignes) | ✅ |
| Village `theme.css` l. 833-839 : 2 colonnes de 11rem sous 860 px | l. 833-839 dans `@media (max-width: 860px)` ouvert l. 781 | ✅ |
| Village l. 573-576 : 1re tuile `grid-column: span 2; grid-row: span 2` | `.mosaique--une-haute > li:nth-child(1)` l. 573-576 | ✅ |
| Village : ruptures en px, nouveau bloc après celui de 860 px | 860 (l. 781) et 1100 sont les seules ruptures en px ; le bloc 860 est le dernier du fichier (851 lignes) | ✅ |
| `docs/qc/notes-tache-10.md` l. 104 : case vide village à 390 | l. 104 (`village-2a7f9e-photos-390`) : « mosaïque 1+2+1 […], la case de droite de sa rangée reste vide » | ✅ |
| `gabarits-captures.e2e.spec.ts` l. 300-340 et l. 405-415 | `habiller` (pose la mosaïque avec/sans photos, l. 300-321) et `afterAll` (restaure `accueil.mosaique`, l. 412) | ✅ |

Contexte utile repéré en lisant le défaut : la base partagée
`src/app/(frontend)/styles.css` l. 897-903 met déjà `.mosaique img` et
`.mosaique__scene svg` en `aspect-ratio: 4 / 5 ; object-fit: cover` — le
thème littoral ne fait que surmoduler (5/6 en première tuile, l. 783-786).
Le village, lui, force `height: 100 %` dans des rangées fixes
(`theme.css` l. 591-598) : ses images remplissent toujours la case.

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets` → postgres déjà lancé, minio healthy, createbuckets up.
- Serveur de développement sur le **port 3000** (cf. notes-littoral-390 §
  cadre : sur 3007, Payload refuse les écritures — CSRF), lancé par cette
  session, arrêté à la fin. Playwright le réutilise (`E2E_PORT=3000`).
- Aucune migration, aucun champ Payload touché.

## 1. Mesure avant (base `75efdf6`)

(vierge — rempli au premier relevé)

## 2. Correction littoral

(vierge)

## 3. Correction village

(vierge)

## 4. Mesure après

(vierge)

## 5. Test — `tests/e2e/mosaique-390.e2e.spec.ts`

(vierge)

## 6. Vérification finale

(vierge)

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
