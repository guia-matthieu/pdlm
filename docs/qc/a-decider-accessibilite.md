Tranché le 21/10 : option 1, branche `pages-titre-h1`

# Accessibilité — à décider : les pages de contenu n'ont pas de `h1`

Constat arrêté pendant l'audit axe du site public (brief 2026-10-17,
`notes-accessibilite.md`), conformément à la règle du brief : une correction
qui change l'apparence voulue s'arrête et se décrit ici. **Rien n'a été
corrigé.**

## Constat mesuré

La règle axe `page-has-heading-one` (impact moderate, tags
`cat.semantics` + `best-practice` — **pas** un tag WCAG, donc non bloquante
pour le test final) retentit sur les pages de contenu, dans les deux
gabarits (`village`, `littoral`), à 390 comme à 1440 px, en palette de
démonstration : 4 nœuds sur l'audit des 44 combinaisons, cible `html`
(la page entière manque son `h1`).

Comptes mesurés sur le HTML rendu (serveur de dev, commune `saint-ex`) :

| Page publiée | Nombre de `h1` | Premier niveau de titre |
| --- | --- | --- |
| `/accessibilite` | 0 | `h2` |
| `/confidentialite` | 0 | `h2` |
| `/mentions-legales` | 0 | `h2` |
| `/vie-municipale` | 0 | `h2` |
| `/` (accueil, pour comparaison) | 1 | `h1` |

## Cause (fichiers et lignes)

- `src/app/(frontend)/[lang]/[slug]/page.tsx:29` — le `titre` de la page
  n'entre que dans les métadonnées (`<title>`, `metaTitle` en secours) ;
- `src/app/(frontend)/[lang]/[slug]/page.tsx:51` — le corps rend
  `RenduBlocs` directement, sans bandeau de titre ;
- `src/components/RenduBlocs.tsx:91` et `:115` — les titres des blocs
  (accordéon, contact, etc.) sont codés en dur `h2`.

Aucun composant du chemin ne rend de `h1` pour une page de contenu : la
hiérarchie rendue commence donc à `h2`, et le `h1` du site n'existe que sur
l'accueil.

## Pourquoi ce n'est pas corrigé ici

Corriger revient à faire un choix d'apparence et de modèle de contenu (bandeau
de titre en tête de page, ou titre invisible/skip, ou refonte de la
hiérarchie des blocs) : c'est précisément le genre de changement que le brief
interdit sans décision humaine (mise en page, hiérarchie visible des pages).
Le RGAA 9.1.1 exige une structure de titres cohérente — l'absence de `h1`
est un manquement probable au sens RGAA même si axe ne le compte pas comme
WCAG ; c'est un arbitrage de design, pas un bug isolé.

## Deux options

1. **Ajouter un bandeau de titre aux pages de contenu** : un `h1` visible en
   tête de `RenduBlocs` (ou juste avant, dans `page.tsx`), rendu à partir du
   `titre` de la page. Les blocs restent en `h2` — hiérarchie conforme,
   `page-has-heading-one` se tait. Coût : change l'apparence de toutes les
   pages de contenu (une zone de titre de plus, à styler dans les deux
   gabarits) et probablement à répercuter sur les maquettes ; la home, qui a
   déjà son `h1` dans le héros, n'est pas touchée.
2. **Accepter l'absence de `h1` sur les pages de contenu** : documenter le
   choix (le `<title>` porte le nom de la page, les blocs commencent à
   `h2`). Rien ne change ; `page-has-heading-one` continuerait à retentir
   dans tout audit best-practice, sans être bloquante au sens WCAG/axe du
   test final. À assumer vis-à-vis du RGAA 9.1.1.

Recommandation (donnée, pas tranchée) : l'option 1 — le RGAA demande un
`h1` par page, le contenu existe déjà (`titre` de la page), et le style d'un
bandeau de titre est un ajout local aux deux gabarits ; mais c'est un
changement d'apparence visible sur toutes les pages de contenu, donc à
décider avec les maquettes sous les yeux.
