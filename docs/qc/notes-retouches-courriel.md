# Retouches courriel — pied de page, rive mairie littoral 1440

Brief : `~/Projects/guia/tasks/2026-10-16_brief-glm-retouches-courriel.md`.
Branche `gabarits-retouches-courriel`, partie de `main` à `398585a` (suites
1440 fusionnées). Deux retouches courtes, sans plan. Ces notes se complètent
à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `Mairie.tsx` l. 25 (arobase) et l. 49-58 (rendu du courriel) | l. 25 `const arobase = … ?? -1` ; l. 49-58 : `<a className="mairie__courriel">` avec `<span>`/`<wbr>`/`<span>` | ✅ |
| `PiedDePage.tsx` l. 56-58 : courriel rendu brut | l. 56-59 : `{t.courriel} <a href={`mailto:${c.email}`}>{c.email}</a>` | ✅ |
| `littoral/theme.css` l. 326-391 : rive mairie | l. 326-337 `.section-mairie` en `flex; flex-wrap: wrap` ; l. 339-344 casettes (marge/box `1.8rem`) ; l. 390-392 `.section-mairie p:not(:has(strong)) { max-width: 22rem }` | ✅ |
| `village/theme.css` : règle `.mairie__courriel` | l. 385-388 `.mairie__courriel span { white-space: nowrap }` | ✅ |
| `tests/e2e/suites-1440.e2e.spec.ts` | lu en entier : 11 tests, `lignesCourriel` (l. 89-121) mesure par Range par caractère dans `.section-mairie` | ✅ |

Repérages complémentaires (grep, une fois) :

- `PiedDePage` n'est rendu que par `src/app/(frontend)/[lang]/layout.tsx`
  (l. 7, l. 128). Ce layout importe la feuille globale
  `src/app/(frontend)/styles.css` (l. 26) **et** la `theme.css` du gabarit
  par `<link precedence>` (l. 96-97, via `src/gabarits/fichiers.ts`). La
  feuille globale est donc chargée partout où `PiedDePage` peut apparaître,
  avec ou sans thème.
- Échelle du littoral : `html { font-size: 106.25 % }` (l. 62-63) → en
  **propriété**, `22rem` = 374 px. Les media queries, elles, basculent entre
  700 et 701 px pour `43.75rem` (mesure suites-1440 : 1 colonne à 700, 2 à
  701) : leur `rem` vaut bien 16 px (valeur initiale), les ruptures sont à
  700 et 900 px.
- Ruptures littoral : `@media (max-width: 56.25rem)` (l. 899, rive en grille
  2 colonnes) et `@media (max-width: 43.75rem)` (l. 1019, 1 colonne, avec
  reset `max-width: none` des `p:not(:has(strong))` l. 1036-1039 — le
  commentaire du fichier y explique le pourquoi des filets pleine largeur).
- `.mairie__courriel` n'est utilisé ni par les tests e2e ni ailleurs dans
  `src/` que `Mairie.tsx` l. 53 et les deux `theme.css` — la classe reste
  néanmoins exigée par le brief (elle marque le lien de la carte mairie).

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets`. Serveur de développement sur le **port 3000** (sur 3007,
  Payload refuse les écritures), lancé par cette session, arrêté à la fin.
- `.env` du worktree non lu, aucune migration, aucun champ Payload touché.
- Événements de démonstration : à vérifier au démarrage (décalés au 23/10
  par la session précédente, `notes-suites-1440.md` § Tâche A).

## Tâche A — le courriel du pied de page se coupe aussi après l'arobase

### Mesures avant (code de `398585a`)

Spéc jetable (non commis) mesurant, par Range par caractère, les lignes du
lien `mailto:` du pied (`.pied-page a[href^="mailto:"]`) et de la carte
mairie (`.section-mairie a[href^="mailto:"]`) — courriel de test
`secretariat.mairie@commune-saint-exupery-sur-mer.fr` :

| Gabarit | Largeur | Pied | Carte mairie |
| --- | --- | --- | --- |
| village | 390 | `secretariat.mairie@commune-` / `saint-exupery-sur-mer.fr` | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` |
| village | 1440 | `secretariat.mairie@commune-saint-exupery-` / `sur-mer.fr` | idem ✅ |
| littoral | 390 | `secretariat.mairie@commune-` / `saint-exupery-sur-mer.fr` | idem ✅ |
| littoral | 1440 | `secretariat.mairie@commune-saint-exupery-` / `exupery-sur-mer.fr` | idem ✅ |

Le pied coupait donc au trait d'union (comportement par défaut du
navigateur : repli autorisé après `-` et `/`). Un seul `mailto:` par
emplacement, `scrollWidth` = viewport partout, déjà corrects avant.

### Modification

- Nouveau composant partagé `src/components/Courriel.tsx` : rend `null` si
  l'adresse est absente (garde-fou « téléphone sans courriel » conservé),
  sinon un unique `<a class="courriel" href="mailto:…">` découpé en
  `<span>partie­locale@</span><wbr /><span>domaine</span>`. Champ de type
  email : l'arobase est garantie par la validation Payload.
- `Mairie.tsx` : le bloc courriel appelle `<Courriel … className="mairie__courriel" />`
  (classe conservée sur le lien de la carte mairie) ; la ligne `arobase`
  disparaît.
- `PiedDePage.tsx` : `{t.courriel} <Courriel adresse={c.email} />`.
- CSS : **une seule règle globale** `.courriel span { white-space: nowrap }`
  dans `src/app/(frontend)/styles.css` (juste après la règle `a`), et retrait
  des deux règles `.mairie__courriel span` de `village/theme.css` et
  `littoral/theme.css`. Pourquoi la feuille globale : le layout frontal
  importe `styles.css` en même temps que la `theme.css` du gabarit (repérage
  ci-dessus), et l'aperçu (`(apercu)/layout.tsx`) l'importe aussi — la règle
  vaut donc partout où `PiedDePage` ou `Mairie` peut être rendu, y compris
  hors thème, comme l'exige le brief. Les sélecteurs de thèmes ne
  couvraient que la carte mairie.

### Mesures après

Même spéc jetable, même courriel de test :

| Gabarit | Largeur | Pied | Carte mairie |
| --- | --- | --- | --- |
| village | 390 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| village | 1440 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| littoral | 390 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| littoral | 1440 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |

Coupure uniquement après l'arobase aux quatre emplacements, un seul
`mailto:` avec l'adresse entière (href mesuré), `scrollWidth` = viewport
partout, carte mairie inchangée. `suites-1440` repassée : 11/11 verts.

## Tâche B — littoral 1440 : la rive mairie sur une seule rangée

### Analyse et mesures avant (code de `398585a`)

La rive est en `flex; flex-wrap: wrap` (l. 326-337 à l'époque). La casette
des horaires est un `p` contenant `strong` — exclue du plafond
`.section-mairie p:not(:has(strong)) { max-width: 22rem }` (l. 390-392),
elle s'étale sur la largeur de son texte. Spéc jetable, courriel de démo
(`mairie@saint-exupery-sur-mer.fr`) — largeur des casettes, lignes des
horaires, `scrollWidth` :

| Largeur | Casettes (mairie, tel, horaires, adresse, courriel) | Lignes horaires | Rangées |
| --- | --- | --- | --- |
| 390 | 347,5 × 5 (1 colonne) | 4 | 5 |
| 700 | 657,5 × 5 (1 colonne) | 3 | 5 |
| 701 | 370,5 / 254 / 370,5 / 254 / 370,5 (grille 2 col.) | 4 | 3 |
| 900 | 569,5 / 254 / 569,5 / 254 / 374 (grille 2 col.) | 4 | 3 |
| 901 | 111 / 216 / **579,3** / 261,8 / 255,9 | 3 | 2 (courriel à la 2ᵉ) |
| 1100 | idem 901 | 3 | 2 |
| 1280 | idem 901 | 3 | 2 |
| 1440 | idem 901, adresse finit à 1277 ; **courriel seul au retour à la ligne** (x=78,3, top=836, résidu ≈ 85 px) | 3 | 2 |

### Modification

Levier unique : la largeur maximale de la casette des horaires, à 22rem
comme les autres. Concrètement, dans `littoral/theme.css` :

- la règle bureau passe de `.section-mairie p:not(:has(strong))` à
  `.section-mairie p` — toutes les casettes de la rive sont plafonnées
  (22rem = 374 px mesurés, `html` du littoral à 106,25 %) ;
- dans le bloc `@media (max-width: 56.25rem)` existant (rive en grille),
  reset `.section-mairie p:has(strong) { max-width: none }` : sous 900 px,
  la casette des horaires garde sa largeur d'avant — les ruptures et tout
  le reste du bloc sont inchangés, rien ne bouge en grille.

Tailles de police, marges, filets et ruptures `@media` : non touchés.

### Mesures après

Mêmes mesures, mêmes colonnes :

| Largeur | Casettes (mairie, tel, horaires, adresse, courriel) | Lignes horaires | Rangées |
| --- | --- | --- | --- |
| 390 | 347,5 × 5 | 4 | 5 |
| 700 | 657,5 × 5 | 3 | 5 |
| 701 | 370,5 / 254 / 370,5 / 254 / 370,5 | 4 | 3 |
| 900 | 569,5 / 254 / 569,5 / 254 / 374 | 4 | 3 |
| 901 | 111 / 216 / 374 / 261,8 / 255,9 | 4 | 2 (adresse + courriel à la 2ᵉ) |
| 1100 | idem 901 | 4 | 2 (courriel seul à la 2ᵉ) |
| 1280 | idem 901 | 4 | 2 (courriel seul à la 2ᵉ) |
| 1440 | 111 / 216 / 374 / 261,8 / 255,9 — courriel finit à 1327,6 (bord droit 1361,7) | 4 | **1** |

- 1440 : les cinq casettes sur **une rangée** (chevauchement vertical de
  toutes ; tops 737,5 à 763,3, alignement flex). `scrollWidth` 1440.
- 390, 700, 701, 900 : largeurs **strictement identiques** à avant
  (écart 0 px, tolérance ±1 px).
- 901 à 1280 : deux rangées, observé et accepté (le brief admet une 2ᵉ
  rangée, pas un débordement). Aucun débordement : `scrollWidth` = viewport
  aux huit largeurs. Les horaires passent de 3 à 4 lignes — le texte se
  replie dans 374 px au lieu de 579,3 ; tailles de police inchangées.
- Le plafond de 22rem suffit : pas besoin d'une autre valeur.
- `suites-1440`, `littoral-captures`, `littoral-mairie-390` repassés :
  16/16 verts.

## Test

Ajouts à `tests/e2e/suites-1440.e2e.spec.ts` (pas de fichier neuf) :

- `lignesCourriel` prend un conteneur (`.section-mairie` par défaut,
  `.pied-page` pour le pied) ;
- pour chaque gabarit et chaque largeur (390, 1440) : « courriel long au
  pied : replié après l'arobase seulement » — même contrôle que la carte
  mairie (`attenduCourriel` : adresse entière, un seul lien, coupure
  seulement après l'@) sur le lien du pied. Chaque test repose son état
  par PATCH (il doit tenir isolé par `-g`, pas seulement enchaîné) ;
- littoral : « à 1440 px, la rive mairie tient sur une rangée (courriel
  de démonstration) » — repose les coordonnées de démo par PATCH, puis
  compte les rangées : dans l'ordre du DOM, chaque casette de
  `.section-mairie` doit commencer après la fin de la précédente
  (tolérance 1 px) ; un retour à la ligne du flex fait échouer.

### Rouge — anciens fichiers `src/` posés depuis `398585a`

Fichiers posés : `styles.css`, `PiedDePage.tsx`, `Mairie.tsx`,
`littoral/theme.css`, `village/theme.css` (contenus `398585a`) et
`Courriel.tsx` supprimé (inexistant là-bas), puis `git checkout --`
de chacun après le run :

```
$ E2E_PORT=3000 npx playwright test suites-1440 -g 'au pied|la rive mairie tient'
  ✘  village … à 390 px, courriel long au pied : replié après l’arobase seulement
  ✘  littoral … à 390 px, courriel long au pied : replié après l’arobase seulement
    Error: la coupure 1 se fait après l’arobase : ["secretariat.mairie@commune-","saint-exupery-sur-mer.fr"]
  2 failed, 3 did not run   (describe serial : les suivants sautent au 1ᵉʳ échec)
$ … -g 'à 1440 px, courriel long au pied'
  ✘ village  Error: ["secretariat.mairie@commune-saint-exupery-","sur-mer.fr"]
  ✘ littoral Error: ["secretariat.mairie@commune-saint-exupery-","exupery-sur-mer.fr"]
  2 failed
$ … -g 'la rive mairie tient'
  ✘ littoral … la rive mairie tient sur une rangée — Error: les cinq casettes sur une seule rangée
  1 failed
```

Les cinq nouveaux tests échouent donc sur l'ancien code, chacun pour le
défaut visé (coupure au trait d'union au pied ; courriel rejeté en 2ᵉ
rangée).

### Vert — code neuf

```
$ E2E_PORT=3000 npx playwright test suites-1440
Running 16 tests using 1 worker
  ✓  1-8  village  : 390 et 1440 — capture 1 ligne, long, long au pied, © du pied
  ✓  9-16 littoral : 390 et 1440 — capture 1 ligne, long, long au pied,
                     téléphone sans courriel, rive sur une rangée à 1440
  16 passed (19.5s)
```

## Clôture

### Vérification finale (sorties réelles)

```
$ npm run lint            → 0 erreur, 45 avertissements (préexistants)
$ npm run typecheck       → tsc --noEmit, aucune erreur
$ npm run test:unit       → Test Files 31 passed (31), Tests 297 passed (297)
$ E2E_PORT=3000 npx playwright test gabarits-captures gabarits-conformite \
    littoral-captures village-captures littoral-mairie-390 mosaique-390 \
    suites-1440
  51 passed (1.9m)
```

(Le typecheck signalait en cours de route une erreur dans le spéc jetable
de mesures, supprimé depuis ; relancé après suppression : aucune erreur.)

### Captures — `docs/qc/captures-retouches-courriel/`

Rive mairie littoral 1440 (courriel de démo) et pieds village/littoral à
390 et 1440 (courriel long), recadrées par capture d'élément
(`.section-mairie`, `.pied-page`) :

| Fichier | Dimensions |
| --- | --- |
| `rive-mairie-littoral-1440.png` | 1440 × 119 |
| `pied-village-390.png` | 390 × 717 |
| `pied-village-1440.png` | 1440 × 328 |
| `pied-littoral-390.png` | 390 × 716 |
| `pied-littoral-1440.png` | 1440 × 335 |

La hauteur de la rive (119 px) est celle de la plus haute casette
(horaires, 117,3 px mesurés) : une seule rangée — deux rangées
auraient donné ≈ 190 px. L'outil de lecture n'a pas affiché ces images
(envoi vers un stockage externe) : dimensions contrôlées par lecture de
l'en-tête PNG (IHDR), rendu prouvé par les tests e2e ci-dessus.

### État final

- `git diff --stat 398585a -- src/` — six fichiers, exactement ceux
  annoncés : `Courriel.tsx` (neuf), `Mairie.tsx`, `PiedDePage.tsx`
  (appels au composant), `styles.css` (règle `nowrap` globalisée, +7),
  `village/theme.css` (retrait de la règle, −6), `littoral/theme.css`
  (retrait de la règle courriel + plafond de la rive, +17/−7).
- `git status --short` vide après le commit de clôture ; spéc jetable
  `zz-retouches.tmp.spec.ts` supprimé ; serveur de développement arrêté
  (`lsof -i :3000` : rien).
- `src/payload-types.ts` n'a pas bougé. Événements de démonstration
  restés au 23/10 (contrôlés à chaque run, non redécalés).

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
- Tâche A — composant `Courriel` partagé, règle `nowrap` globalisée dans
  `styles.css`, mesures avant/après ci-dessus.
- Tâche B — plafond 22rem étendu à toutes les casettes de la rive littoral,
  reset dans le bloc grille 56.25rem ; 1440 sur une rangée, 390/700/701/900
  inchangés, mesures ci-dessus.
- Test — cinq tests ajoutés à `suites-1440.e2e.spec.ts` : rouges sur les
  fichiers `398585a` reposés, verts sur le code neuf (16/16), sorties
  ci-dessus.
- Clôture — lint 0 erreur, typecheck 0, unit 297/297, e2e 51/51 sur les
  sept fichiers ; cinq captures recadrées ; jetable supprimé, serveur
  arrêté, dépôt propre.
