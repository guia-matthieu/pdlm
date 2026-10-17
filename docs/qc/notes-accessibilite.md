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
'wcag22aa','best-practices'])` — les règles `best-practices` étaient donc
auditées aussi (relevées sans bloquer) : aucune n'a été trouvée.

### Résultat : zéro violation sur tout le périmètre

Les 44 combinaisons rendent **0 nœud en violation** (sortie complète : 44
lignes `AUDIT … : 0 noeud(s)`, `2 passed (31.9s)`). Le tableau par règle est
donc vide — aucune règle axe à corriger, aucune correction commitée, et le
test final n'a pas de règle corrigée à faire échouer sur `651e31f`
(l'exigence du brief est conditionnée aux règles corrigées).

### Preuve que ce zéro n'est pas un zéro à vide

Sonde jetable `zz-sonde.tmp.spec.ts` : une `<img id="sonde-sans-alt">` sans
`alt` injectée dans le `main` de l'accueil est bien relevée par le même
harnais (`withTags` identiques) :

```
SONDE règles relevées : image-alt
  1 passed (3.7s)
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

### RGAA vu en passant (hors périmètre, non corrigé)

- `/mentions-legales` (page de contenu) n'a pas de `h1` : ses blocs
  commencent à `h2` (mesuré : `<title>` présent, trois `<h2>`, aucun `h1`).
  `page-has-heading-one` (best practice) n'a pas retenti. À trancher par un
  humain (donner un bloc titre aux pages, ou l'accepter).


## Corrections

Aucune : l'audit avant ne relève aucune violation (voir ci-dessus), il n'y a
donc ni commit de correction, ni règle à faire échouer sur `651e31f`, ni
`a-decider-accessibilite.md` (aucune correction arrêtée pour cause
d'apparence). Le reste de la tâche porte sur le test de non-régression.

## Test

(à compléter)

## Clôture

(à compléter)

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
- Audit avant — 44 combinaisons (2 gabarits × 7 pages × 2 largeurs en palette
  démo + 2 jeux × 2 pages × 2 largeurs), zéro violation, preuve par sonde
  (image-alt), incomplets documentés.
