# Pages de contenu — le titre rendu en `h1`

Brief : `~/Projects/guia/tasks/2026-10-21_brief-glm-pages-titre-h1.md`.
Branche `pages-titre-h1`, partie de `gabarits-demo-tiret` à `37f4c13`. Une
correction courte, sans plan. Ces notes se complètent à chaque commit.

## Constat repris

Les pages de contenu (route `[lang]/[slug]`) n'ont aucun `h1` : le `titre`
n'entre que dans `<title>`, les blocs commencent à `h2` (mesures dans
`gabarits-accessibilite:docs/qc/a-decider-accessibilite.md`). Décision de
Matthieu : **option 1**, un `h1` visible tiré du `titre`.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `agenda/page.tsx` l. 33-34 : `<section className="bloc bloc-texte"><h1>…` | l. 33-34, exactement cette forme | ✅ |
| `RenduBlocs.tsx` l. 38 : le bloc `hero` émet un `h1` | l. 38 `<h1>{bloc.titre}</h1>` dans `bloc-hero__texte` | ✅ |
| Spec existant visitant les pages de contenu | `tests/e2e/frontend.e2e.spec.ts` l. 30 (`/mentions-legales` en fumigation) — spec neuf créé à la place (`tests/e2e/pages-titre-h1.e2e.spec.ts`) | ✅ |

## Ce qui a changé (commit `Pages — un h1 tiré du titre de la page`)

- `src/app/(frontend)/[lang]/[slug]/page.tsx` : avant `<RenduBlocs>`, dans
  `ContenuEnLangue`, rend `<section className="bloc bloc-texte"><h1>{doc.titre}</h1></section>`
  — même forme que l'agenda, aucun CSS neuf — sauf si la page porte un bloc
  `hero` (qui émet déjà le sien).
- `src/lib/blocs.ts` (nouveau) : `aUnBlocHero(blocs)`, fonction pure
  (`blocs.some(b => b.blockType === 'hero')`).
- `tests/unit/blocs.spec.ts` (nouveau) : 3 tests (vide / sans hero / hero
  présent après d'autres blocs).
- `tests/e2e/pages-titre-h1.e2e.spec.ts` (nouveau) : pour `village` et
  `littoral` (commune composée par PATCH puis restaurée, vérifié par GET),
  sur `/mentions-legales` et `/vie-municipale` : exactement un `h1`, de texte
  égal au `titre` lu par `/api/pages` ; plus `/marche` de Valvert
  (`valvert.localhost`, semée avec un hero en premier bloc) : un seul `h1`,
  celui du hero.

## Preuve rouge avant / vert après

**Avant** (code de `37f4c13`, spec joué contre le `page.tsx` inchangé) :

```
  1 failed
    [chromium] › tests/e2e/pages-titre-h1.e2e.spec.ts:62:9 › Pages de contenu : un h1 tiré du titre › village › mentions-legales : un seul h1, égal au titre
  3 did not run
  1 passed (21.1s)
```

Échec mesuré : `locator('h1')` → `Expected: 1, Received: 0` (14 sondages à 0
éléments). Le test hero de Valvert passait déjà — c'est attendu, il protège
la non-régression.

**Après** (commit appliqué) :

```
  ✓  1 [chromium] › … village › mentions-legales : un seul h1, égal au titre (436ms)
  ✓  2 [chromium] › … village › vie-municipale : un seul h1, égal au titre (325ms)
  ✓  3 [chromium] › … littoral › mentions-legales : un seul h1, égal au titre (329ms)
  ✓  4 [chromium] › … littoral › vie-municipale : un seul h1, égal au titre (300ms)
  ✓  5 [chromium] › Page à bloc hero : le hero garde le seul h1 › marche de Valvert : un seul h1, celui du hero (655ms)

  5 passed (7.3s)
```

Typecheck `npx tsc --noEmit -p .` : sortie vide (exit 0) avant commit ;
`tests/unit/blocs.spec.ts` : `Tests 3 passed`.

## Journal

- (ce commit) — code + fonction pure + tests, preuves avant/après ci-dessus.
