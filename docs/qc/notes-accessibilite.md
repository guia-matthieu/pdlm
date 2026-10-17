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

### Méthode

Spec jetable `zz-audit.tmp.spec.ts` (non commise, supprimée à la fin) :
connexion opérateur, puis pour chaque gabarit (`village`, `littoral`, posé par
PATCH sur la commune de démo `saint-ex`) :

- **palette de démonstration** (celle d'origine de la commune, repassée par
  PATCH) : accueil, `actualites`, une actualité (`inscription-ecole-municipale`,
  trouvée par `/api/actualites`), `agenda`, `documents`, une page de contenu
  (`accessibilite`, première page publiée hors `accueil` et hors routes
  réservées, trouvée par `/api/pages` filtrée par tenant) et
  `mesure-d-audience` — à 390 et 1440 px ;
- **jeux des captures** `#2a7f9e` et `#9b3d57` (posés/remis comme
  `gabarits-captures`) : accueil + fiche actualité, à 390 et 1440 px.

Soit 44 combinaisons. La collection `documents` étant vide en base de dev, un
document PDF (`audit-accessibilite — registre des délibérations`,
catégorie délibérations) était créé par le spec puis supprimé et vérifié 404
par GET. `AxeBuilder.withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa',
'wcag22aa','best-practice'])` — les règles `best-practice` (non bloquantes,
relevées ici) sont donc auditées aussi.

**Erratum (relecture)** : la première passe écrivait le tag au pluriel
(`best-practices`). Ce tag n'existe pas : axe ignore silencieusement un tag
inconnu, donc **aucune règle best-practice n'avait tourné** — mesuré après
relecture : `best-practice` apparaît 30 fois dans
`node_modules/axe-core/axe.min.js`, `best-practices` zéro fois ; les tags de
`page-has-heading-one` sont `["cat.semantics","best-practice"]`. L'audit des
44 combinaisons a été **relancé** avec le tag correct (sortie complète
ci-dessous), sondes à l'appui.

### Résultat : zéro violation WCAG, une règle best-practice

Relance complète : 44 lignes `AUDIT …`, `2 passed (31.8s)`. **Aucune
violation des tags WCAG** (`wcag2a`…`wcag22aa`) sur tout le périmètre — le
tableau par règle WCAG est vide, donc aucune règle à corriger, aucune
correction commitée, et le test final n'a pas de règle corrigée à faire
échouer sur `651e31f` (l'exigence du brief est conditionnée aux règles
corrigées). Côté best-practice, une règle retentit :

| Règle (impact, tags) | Combinaisons touchées | Nœuds | Cible | Sort |
| --- | --- | --- | --- | --- |
| `page-has-heading-one` (moderate, `cat.semantics`,`best-practice`) | page de contenu uniquement — gabarits `village` et `littoral`, palette démo, 390 **et** 1440 px (jamais ailleurs : accueil, actualités, agenda, documents, mesure-d-audience, ni les jeux `#2a7f9e`/`#9b3d57` qui ne passent que par accueil + actualité) | 4 | `html` entier (la page n'a aucun `h1`) | non bloquant → `a-decider-accessibilite.md` (voir ci-dessous) |

Cause mesurée : la page de contenu type (`accessibilite`, mais les quatre
pages publiées sont dans ce cas, voir la section suivante) rend ses blocs par
`RenduBlocs`, dont les titres commencent à `h2` (`src/components/RenduBlocs.tsx:91`
et `:115`) ; le `titre` de la page n'entre que dans les métadonnées
(`<title>`, `src/app/(frontend)/[lang]/[slug]/page.tsx:29`). Aucun `h1`
n'est émis.

### Preuve que ce zéro n'est pas un zéro à vide

Sonde jetable `zz-sonde.tmp.spec.ts`, deux sondes sur le même harnais : une
règle WCAG (`image-alt` — `<img>` sans `alt` injectée dans le `main` de
l'accueil) et une règle best-practice (`page-has-heading-one` sur
`/mentions-legales`, page sans `h1`) retentissent toutes deux :

```
SONDE accueil : image-alt
SONDE mentions-legales : page-has-heading-one
  2 passed (5.1s)
```

### Vérifications incomplètes (contrastes non tranchés par axe)

Sur l'accueil du gabarit d'origine de la commune (`littoral`, identifié par
le `link` `gabarits/littoral/theme.css`), axe laisse des `color-contrast`
**incomplets** (il ne peut pas décider : couleurs dérivées/fond à étages) sur
le `h1` du héros, les boutons primaire/secondaire, les titres et liens de
sections, les dates de l'agenda et les libellés de mosaïque, à 390 comme à
1440. Ce ne sont pas des violations : ces contrastes sont précisément ceux
que le test 5 de `gabarits-conformite` **mesure dans la page rendue** sur
trois palettes extrêmes (`#ffff00`, `#777777`, `#3b0a14`) — garantie plus
forte qu'axe, déjà verte. Rien à exclure pour autant : aucune violation à
exclure, le test final n'a ni `exclude` ni `disableRules`.

### Compte des `h1` par page de contenu publiée (relecture)

Mesuré sur le HTML rendu (curl du serveur de dev, host nu = commune de démo) :

| Page publiée | HTTP | Nombre de `h1` |
| --- | --- | --- |
| `/accessibilite` | 200 | **0** |
| `/confidentialite` | 200 | **0** |
| `/mentions-legales` | 200 | **0** |
| `/vie-municipale` | 200 | **0** |
| `/` (accueil, hors pages de contenu) | 200 | 1 |

Toutes les pages de contenu publiées n'ont aucun `h1` (elles commencent à
`h2`) ; l'accueil, lui, en a un. Le point est inscrit sans correction dans
`docs/qc/a-decider-accessibilite.md` — la règle axe correspondante
(`page-has-heading-one`) est best-practice, non bloquante pour le test final
(tags WCAG seuls, conformément au brief et à la relecture).


## Corrections

Aucune violation WCAG à corriger (voir l'audit avant). Le seul constat
arrêté est un point à décider, pas une correction :
`docs/qc/a-decider-accessibilite.md` (pages de contenu sans `h1`). Le reste
de la tâche porte sur le test de non-régression.

## Relectures

- **Message reçu après le commit d'audit avant (a931d3f)** : « le tag axe
  s'écrit 'best-practice' (singulier), pas 'best-practices'. Avec ton
  orthographe, aucune règle best-practice n'a tourné — c'est pourquoi
  page-has-heading-one n'a pas retenti sur /mentions-legales sans h1.
  Relance l'audit des 44 combinaisons avec 'best-practice' (sonde à
  l'appui : une règle best-practice connue doit retentir), et écris dans les
  notes le tableau par règle des best-practice trouvées (non bloquantes).
  Vérifie aussi, pour chaque page de contenu publiée, la présence d'un h1
  (compte). Si des pages n'ont pas de h1, inscris-le dans
  docs/qc/a-decider-accessibilite.md avec deux options, sans corriger. Le
  test final garde les tags WCAG seuls, comme prévu. Réponse dans les
  notes. »
- **Appliqué et mesuré** : le tag pluriel était bien une erreur (mesures et
  erratum dans « Audit avant → Méthode ») ; l'audit des 44 combinaisons a
  été relancé avec `best-practice` (sondes `image-alt` et
  `page-has-heading-one` au vert avant la relance) ; le tableau par règle
  des best-practice trouvées est dans « Audit avant → Résultat » ; le compte
  des `h1` par page publiée est dans « Audit avant → Compte des h1 » ;
  `docs/qc/a-decider-accessibilite.md` est écrit avec deux options, sans
  correction ; le test final garde `TAGS = ['wcag2a','wcag2aa','wcag21a',
  'wcag21aa','wcag22aa']` seuls.

## Test

`tests/e2e/accessibilite.e2e.spec.ts` (fichier neuf), paramétré comme le
brief le demande — boucle `for (const [nom] of Object.entries(GABARITS))`
(une par gabarit du registre, sans toucher au test 4 de
`gabarits-conformite`) :

- **45 tests** : 1 sonde (une `<img>` sans `alt` injectée doit être relevée
  par les mêmes tags — preuve qu'un vert n'est pas un zéro à vide) + par
  gabarit : 7 pages × 2 largeurs en palette démo (14) + 2 jeux × 2 pages ×
  2 largeurs (8), soit 22 ;
- `TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']` seuls
  (best-practice volontairement hors test, conformément au brief et à la
  relecture : `page-has-heading-one` est à décider, pas bloquante) ;
- page née d'un contexte explicite (exigence d'axe) ; accueil et pages
  fixes en dur, slugs de l'actualité et de la page de contenu lus par
  l'API au `beforeAll` (résolus au passage dans chaque test — un premier
  jet les résolvait à la collecte, avant le `beforeAll` : `goto(undefined)`,
  corrigé) ; document créé pour la page `documents` si la collection est
  vide, puis supprimé et vérifié 404 ; `apparence` de la commune reposée
  sur son état d'origine, **vérifiée par GET** ; aucune exclusion — ni
  `exclude` ni `disableRules` (aucune violation à exclure) ;
- préconditions par test : réponse 200, `main#contenu` visible, et le lien
  `gabarits/<nom>/theme.css` rendu (le bon gabarit est posé) ;
- exigence « échoue sur `651e31f` pour chaque règle corrigée » : sans objet,
  aucune règle corrigée (l'audit n'a trouvé aucune violation WCAG).

Sortie du premier passage complet :

```
  45 passed (52.4s)
```

## Clôture

Vérification finale, sorties réelles :

```
$ npm run lint            → 0 erreur, 45 avertissements (préexistants), exit 0
$ npm run typecheck       → tsc --noEmit, rien, exit 0
$ npm run test:unit
 Test Files  31 passed (31)
      Tests  297 passed (297)
   Duration   4.18s
```

La passe e2e des dix fichiers, commande du brief :

```
$ E2E_PORT=3000 npx playwright test gabarits-captures gabarits-conformite \
    littoral-captures village-captures littoral-mairie-390 mosaique-390 \
    suites-1440 focus frontend accessibilite

  102 passed (2.6m)
  EXIT 0
```

Par fichier (comptés dans la sortie) : `accessibilite` 45,
`suites-1440` 16, `gabarits-conformite` 14, `gabarits-captures` 8,
`mosaique-390` 6, `littoral-mairie-390` 3, `frontend` 3, `focus` 3,
`village-captures` 2, `littoral-captures` 2 — les dix verts, dont le test 4
de `gabarits-conformite` (accueil, par défaut), inchangé.

Aucune correction de `src/` : `git diff --stat 651e31f -- src/` est vide —
ni l'admin, ni `src/lib/couleurs.ts`, ni rien d'autre. Les specs jetables
(`zz-audit`, `zz-sonde`, `zz-incomplet` `.tmp.spec.ts`) sont supprimées ;
`git status --short` vide ; serveur de dev arrêté (`lsof -i :3000` vide).

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
- Audit avant — 44 combinaisons (2 gabarits × 7 pages × 2 largeurs en palette
  démo + 2 jeux × 2 pages × 2 largeurs), zéro violation, preuve par sonde
  (image-alt), incomplets documentés.
- Relecture — tag `best-practice` corrigé (singulier), audit des 44
  combinaisons relancé avec sondes : toujours zéro violation WCAG ; une
  règle best-practice (`page-has-heading-one`, 4 nœuds, pages de contenu
  sans `h1`) → tableau dans les notes et
  `a-decider-accessibilite.md` (deux options, sans correction).
- Test e2e — `accessibilite.e2e.spec.ts` : 45 tests verts (1 sonde + 2 × 22),
  remise en état vérifiée par GET.
- Clôture — vérification finale : lint 0 erreur, typecheck 0, unit 297/297,
  dix fichiers e2e verts (102 tests), specs jetables supprimées, arbre
  propre, `src/` intact depuis `651e31f`.
