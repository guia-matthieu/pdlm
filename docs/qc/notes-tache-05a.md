# Notes QC — tâche 5, première moitié : kit de frise et illustrations du gabarit Village

Exécutée le 05/10/2026 dans le worktree `~/Projects/glm.gabarits`, branche
`gabarits-couleurs`, depuis `316e2a5`. La seconde moitié (`theme.css`, chargement
des polices, composition de `gabarit.ts`) est pour la session suivante.

Commits (hors ces notes) :

- `42512cb` kit de frise complet, porté de `frise.py` ;
- `be6d327` illustrations complètes (7 scènes, héros, 17 pièces) ;
- polices et licences ;
- correctif du menu en double de la démonstration.

## Ce qui a été porté

### Kit de frise — `src/gabarits/village/frise.ts` (`frise.py`)

| `frise.py`      | Kit TypeScript | Remarque |
|-----------------|----------------|----------|
| `maison`        | `maison`       | aplat, sans trait |
| `maison_basse`  | `maisonBasse`  | nom en camelCase (déjà celui du kit provisoire) |
| `eglise`        | `eglise`       | trait : la croix, **à l'identique** (`x+75`, `x+70`, `x+81`) |
| `sapin`         | `sapin`        | h = 50, pas d'un `h` libre : la taille passe par `taille` |
| `arbre`         | `arbre`        | r = 20 |
| `mairie`        | `mairie`       | aplat, sans trait |
| `colline`       | `horizon()`    | `colline(96, 110, [(260,70),(620,92),(980,58),(1260,88)])`, test sur la chaîne exacte |

Échelles `petite: 0.72`, `moyenne: 1`, `grande: 1.3`. Signature `(x, sol, taille)`.

**Corrections par rapport au kit provisoire** (qui s'en écartait) :

- croix de l'église : `x+76`/`x+71` au lieu de `x+75`/`x+70` (1 px) ;
- fenêtres de la maison, de la maison basse et de la mairie, rosace de l'église,
  mât de la mairie : ils sont retirés du **kit de frise** (ils n'existent pas dans
  `frise.py`) et vivent désormais dans les illustrations, comme dans la maquette.
  Sur la frise du héros, les traits blancs sur aplat blanc étaient invisibles,
  sauf le mât de la mairie qui dépassait du toit ;
- largeur du sapin 54,6 (= 50·0,42·2,6 du Python) au lieu de 55.

### Illustrations — `src/gabarits/village/illustrations.ts` (`illustrations_village.py`)

17 pièces (`PIECES_ILLUSTRATION`) : les 6 de la frise (aplats repris de `frise.ts`,
détails de la maquette ajoutés) + `ecole`, `preau`, `halle`, `commerce`,
`kiosque`, `fanions`, `lavoir`, `pont`, `barque`, `panneau`, `vigne`. Dimensions
et `HAUTEURS` identiques au Python.

| Scène (Python `SCENES`) | Pièces, taille, écart | Relief |
|---|---|---|
| `sentiers`     | sapin G 0 · panneau M 26 · arbre M 90 · sapin M 6 | chemin, soleil 0,22 |
| `patrimoine`   | lavoir P 0 · église G 10 · arbre P 8 | soleil 0,8 |
| `commerces`    | commerce M 0 · halle M 8 · commerce P 8 | soleil 0,2 |
| `associations` | arbre G 0 · fanions M −12 · arbre G −12 · kiosque M 14 | soleil 0,78 |
| `ecole`        | arbre G 0 · école M 8 · préau P 4 | soleil 0,25 |
| `mer`          | sapin M 0 · pont M 4 · barque P 18 | plan d'eau + rides, pas de premier plan |
| `nature`       | sapin G 0 · sapin M −6 · arbre G 10 · sapin G 8 | vignes, oiseaux 0,7, soleil 0,3 |
| `heros()`      | 10 pièces (sapin → sapin), zoom 1,1, sol à 0,86·h | vignes, oiseaux 0,82, soleil 0,66, cadrage `xMaxYMax` |

Fidélité : couches dans l'ordre de `_scene` (ciel, soleil, oiseaux, collines,
vignes, eau/sol, formes/traits/accents, premier plan, chemin) ; pièces posées par
`translate(x y) scale(s)` comme en Python, donc les traits suivent l'échelle ;
barque abaissée de `5·zoom`. Gardés : repli sur `nature` pour tout nom inconnu et
`Object.hasOwn` (`182b778`), avec leurs tests (`gabarits-kits.spec.ts`, inchangé).
Aucune couleur littérale : classes `i-*` seulement, testé.

Tests nouveaux : `tests/unit/village-kit.spec.ts` (pièces de `frise.py`, trois
tailles, croix de l'église, horizon) et `tests/unit/village-illustrations.spec.ts`
(17 pièces et dimensions, 7 compositions et héros, relief par scène, aucun
littéral, repli). Chacun a été vu échouer avant le code.

**Pour la session suivante** : le thème doit définir les classes que la maquette
a ajoutées et que `styles.css` n'a pas : `i-accents`, `i-rangs`, `i-oiseaux`,
`i-rides`, `i-chemin` (voir `K-village-illustre/theme.css` l. 755-830). Sans
elles, ces éléments se rendent en noir plein (`fill` par défaut). Les classes
déjà dans `styles.css` (`i-ciel`…) utilisent `--couleur-*` alors que la maquette
utilise `--principale-sure`, `--accent` : à unifier au passage.

## Vérification à l'œil

`docs/recherche/2026-09-25_front-beau/K-village-illustre/planche-ts.mts` (hors
git) rend les 7 scènes, le héros et un échantillon de frise avec
`deriver(DEFAUTS)` (`#264653` / `#e2a72e` / `#b36b00`) :

- planche : `…/K-village-illustre/captures/planche-ts-desktop.png` (et `-mobile`) ;
- référence : `…/captures/planche-scenes-desktop.png` ;
- rejouer : `npx tsx docs/recherche/2026-09-25_front-beau/K-village-illustre/planche-ts.mts`.

Comparaison scène par scène : mêmes pièces aux mêmes places dans les 7 scènes et
le héros (chemin des sentiers, lavoir/église/arbre, halle entre deux commerces à
store, fanions entre deux arbres avec kiosque, arbre/école à clocheton/préau,
pont et barque sur l'eau, forêt avec vigne et oiseaux).

Écarts vus :

- couleurs : normaux, la référence est en vert sapin / lie-de-vin, la mienne en
  bleu-vert du plan ; le ciel (`--pale`) est un bleu très clair, le chemin un
  beige ;
- la planche TS est rendue avec ma propre feuille de style de planche (copie des
  classes de la maquette), pas avec `theme.css` du dépôt : elle prouve la
  géométrie, pas la mise en forme finale ;
- aucun autre écart à l'œil. Je n'ai pas fait de diff numérique des chemins avec
  le Python : les arrondis diffèrent (2 décimales ici, `%.0f` pour les collines
  en Python), sans effet visible.

## Polices

Copiées de `K-village-illustre/polices/` vers `src/gabarits/village/polices/` :
`bricolage-grotesque-latin-wght.woff2`, `AtkinsonHyperlegibleNext-Regular-latin.woff2`,
`bricolage-LICENSE.txt`. Licence d'Atkinson Hyperlegible Next (SIL OFL 1.1) :
`atkinson-LICENSE.txt`, récupérée par `curl` à
`https://raw.githubusercontent.com/googlefonts/atkinson-hyperlegible-next/main/OFL.txt`
(dépôt `github.com/googlefonts/atkinson-hyperlegible-next`, copyright « 2020-2024 The
Atkinson Hyperlegible Next Project Authors »). Non branchées : à faire dans `theme.css`.
Le critère 8 de la conformité (une licence voisine par police) est une
convention de nom : à confirmer à l'étape suivante.

## Menu en double

**Cause : le grain de démonstration.** `Navigation.tsx` rend toujours trois liens
fixes après les entrées du menu (Actualités, Agenda, Documents — `ctx.t.documents`
→ `/documents`). `src/seed/contenu-demo.ts` (l. 299) ajoutait en plus
`{ label: 'Documents', url: '/documents' }` au menu « Principal » de Saint-Ex.
Corrigé dans le grain : le menu ne garde que « Vie municipale ». Le code du menu
est inchangé. Limite : le grain ne crée le menu que s'il n'y en a aucun
(`nbMenus === 0`) ; une base déjà amorcée garde l'ancienne entrée et doit être
corrigée à la main dans l'admin (ou la base recréée).

## Vérifications finales

- `npm run typecheck` : sans sortie (0 erreur).
- `npm run lint` : `✖ 40 problems (0 errors, 40 warnings)` (avertissements existants).
- `npm run test:unit` : `Test Files 26 passed (26)`, `Tests 197 passed (197)`.
- `npm run test:e2e` : `38 passed (1.1m)`.

## Non vérifié

- Rendu dans la vraie page (le thème est de la session suivante) : les scènes ne
  sont vues que sur ma planche.
- `test:int` non lancé (hors périmètre demandé).
- `prettier --check` signale `src/seed/contenu-demo.ts`, déjà non conforme avant mon
  changement (je n'ai pas reformaté le fichier).
- Le correctif du menu n'a pas été rejoué sur une base neuve.
