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

Captures relancées :

    E2E_PORT=3000 npx playwright test gabarits-captures
    → 8 passed (32,6 s)   [littoral et village, avec et sans photos]

Sorties « avant » : `test-results/gabarits/t10/` (390 et 1440).

Relevé DOM par spec Playwright jetable (`tests/e2e/zz-mesure-mosaique.tmp.spec.ts`,
supprimé en fin de session) : commune `saint-ex` composée comme le spec de
captures (gabarit + tuiles de la maquette avec photos), mesurée à
375/390/600/700/701/1440 px, puis remise en état. Chiffres clés :

| Gabarit @390 | Pistes | Rangées | scrollWidth | Forme |
| --- | --- | --- | --- | --- |
| littoral | 163,5 / 163,6 | auto | 390 | tuiles paires décalées de 37,4 px (2,2rem) ; hauteurs visuelles toutes différentes : 555 / 468 / 204,4 (scène) / 533 |
| village | 163,5 ×2 | 198 px (11rem) | 390 | tuile 1 pleine largeur 345×414, tuiles 2-3 côte à côte, **tuile 4 seule à gauche : case vide à sa droite** (défaut de notes-tache-10 l. 104 reproduit) |

À 700 px, même forme dans les deux gabarits (pistes 318,5×2 ; littoral :
hauteurs constantes 555/468/398,2/533 ; village : tuile 1 à 655×414).

**Sonde sur la hauteur des img littoral** (spec jetable `zz-sonde2`, l. 31 de
`MediaImage.tsx`) : chaque `img` porte `width="800" height="1000"` ; hauteur
calculée **1000px**, rendue 555 (boîte ensuite réduite par la mise en page) ;
poser `aspect-ratio` en direct ne change rien ; `height: auto` — ou retirer
l'attribut — rend 196,25 px = 163,547 × 5/6 (ratio honoré) ; attribut remis →
1000. Conclusion mesurée : la hauteur de l'attribut html **écrase
`aspect-ratio`**. Le correctif littoral pose donc `height: auto` en plus du
3/2 — écart au libellé du brief (« aspect-ratio » seul), motivé par cette
mesure.

## 2. Correction littoral

Dans le bloc existant `@media (max-width: 43.75rem)` (l. 1013), après les
règles mairie, rien d'autre dans le fichier :

```css
  .mosaique {
    grid-template-columns: 1fr;
  }

  .mosaique > li:nth-child(n) {
    margin-top: 0;
  }

  .mosaique img,
  .mosaique__scene,
  .mosaique__scene svg,
  .mosaique > li:first-child img,
  .mosaique > li:first-child .mosaique__scene {
    aspect-ratio: 3 / 2;
  }

  .mosaique img {
    height: auto;
  }
```

Les sélecteurs `li:first-child` reprennent ceux de l. 783-786 (même
spécificité, plus loin dans le fichier : le 5/6 cède). Le libellé reste sous
l'image (aucune règle touchée).

Vérification immédiate (même spec jetable, littoral seul) :

| Viewport | Pistes | Tuiles | Marges | Visuels | scrollWidth |
| --- | --- | --- | --- | --- | --- |
| 375 | 332,5 | 332,5 pleine largeur | 0 | 221,7 (= 332,5 × 2/3) | 375 |
| 390 | 347,5 | 347,5×271 | 0 | 231,7 (= 3/2) | 390 |
| 600 | 557,5 | idem | 0 | 371,7 (= 3/2) | 600 |
| 700 | 657,5 | idem | 0 | 438,3 (= 3/2) | 700 |
| 701 | 318,5×2 | décalées | 37,4 px | 555/468/398,8/533 | 701 |
| 1440 | 4 pistes | décalées | 76,5/27,2/98,6 | 555/468/340,5/533 | 1440 |

Les blocs 701 et 1440 ont été comparés programmatiquement au relevé « avant »
complet (sauvegardé le temps de la session) : **identiques** — rien ne change
au-dessus de la rupture.

## 3. Correction village

Nouveau bloc après celui de 860 px (le fichier écrit ses ruptures en px),
fin du fichier :

```css
@media (max-width: 700px) {
  /* La mosaïque sur une colonne : une tuile par ligne, pleine largeur. */
  .mosaique {
    grid-template-columns: 1fr;
  }
  /* span 2 créerait une colonne implicite et ferait déborder la page :
     la 1re tuile redevient auto, mais garde ses deux rangées. */
  .mosaique--une-haute > li:nth-child(1) {
    grid-column: auto;
  }
}
```

Rangées de 11rem et `nth-child(2)` à une rangée : hérités du bloc 860 px,
qui s'applique encore sous 700. La 1re tuile garde `grid-row: span 2`
(l. 573-576, non touchée) : 2×11rem + gouttière = 414 px. Le libellé reste
posé sur l'image (aucune règle touchée).

Vérification immédiate (même spec jetable, village seul) :

| Viewport | Pistes | Tuiles | scrollWidth |
| --- | --- | --- | --- |
| 375 | 330 | toutes 330 pleine largeur ; 414 puis 198 ×3 | 375 |
| 390 | 345 | idem | 390 |
| 600 | 555 | idem | 600 |
| 700 | 655 | idem | 700 |
| 701 | 319×2 | 656×414 + 319×198 ×3 (forme 1+2+1 d'avant) | 701 |
| 1440 | 317,25×4 | 652,5×558 + 317,3×558/270 | 1440 |

Blocs 701 et 1440 comparés programmatiquement au relevé « avant » :
**identiques**. La case vide à droite de la tuile 4 a disparu sous 700 px.

## 4. Mesure après

(vierge)

## 5. Test — `tests/e2e/mosaique-390.e2e.spec.ts`

(vierge)

## 6. Vérification finale

(vierge)

## Journal

- `0ef2678` — squelette de ces notes (ancres vérifiées, cadre).
- `1079acd` — mesure avant (§ 1) ; correction littoral + vérification (§ 2).
- (ce commit) — correction village + vérification (§ 3).
