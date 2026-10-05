# Gabarit « Village »

Le gabarit des communes de l'intérieur : un village sur sa colline, ses
toits à deux pans, son église, sa mairie. Contrat : `../CONTRAT.md`, version 1.

## Intention

Un site de commune gagne par sa **composition**, pas par ses couleurs : fonds
alternés, chevauchements, identité locale dessinée. Village pose donc :

- un **héros** pleine largeur — la photo de la commune, ou la grande scène
  dessinée quand elle manque — qui se termine sur la **frise du territoire**,
  silhouette blanche du village composée par l'opérateur ;
- la **carte mairie** qui chevauche cette frise (téléphone, horaires, adresse) à
  côté des **démarches**, chacune avec sa pastille de couleur ;
- les **actualités** sur une bande pâle au bord arrondi, la plus récente en une
  (photo doublée d'un aplat d'accent, texte sur une carte qui la chevauche),
  les suivantes en brèves ;
- l'**agenda** sur le fond profond, les jours en grands chiffres d'accent ;
- la **mosaïque** « Vivre à… », une grande tuile, une haute, deux simples ;
- le **pied de page** sur le fond profond, précédé de la même frise, au trait.

La page « accueil » du rédacteur (section texte libre) se place entre le bloc
démarches + mairie et les actualités ; elle n'existe pas dans la maquette.

Aucun script, aucune ressource tierce (I27). Aucun emplacement vide (I30) :
là où une photo manque, une scène du kit la remplace.

## Fichiers

| Fichier            | Rôle                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `gabarit.ts`       | composition de l'accueil, variantes, polices, cadrage du héros                                                 |
| `theme.css`        | mise en forme, servie à `/gabarits/village/theme.css`                                                          |
| `frise.ts`         | kit de frise : maison, maison basse, église, sapin, arbre, mairie ; horizon de collines                        |
| `illustrations.ts` | 7 scènes (`sentiers`, `patrimoine`, `commerces`, `associations`, `ecole`, `mer`, `nature`) et le héros dessiné |
| `polices/`         | polices auto-hébergées et leurs licences                                                                       |
| `maquette/`        | la maquette statique de référence et les captures du rendu                                                     |

## Couleurs

Toutes viennent de la commune, par les variables du contrat : `--pale` (ciel,
bande des actualités), `--profond` (agenda, pied, pièces des scènes),
`--principale-sure` (boutons, sols des scènes), `--accent` (soleil, aplat de la
une, filet de la carte mairie, frise au trait), `--accent-sur-profond` (dates
de l'agenda, texte large seulement), `--encre` (texte), `--picto-1`…`6`
(pastilles des démarches), `--terre-sure` (filet du bandeau d'alertes).
`theme.css` ne contient aucune couleur littérale hors `#fff`.

## La maquette de référence

`maquette/accueil.html` (photos, une tuile illustrée) et
`maquette/accueil-illustre.html` (aucune photo) : la page validée par
Matthieu Credou le 25/09/2026, avec son propre `maquette/theme.css` — celui
qui a été porté, gardé pour comparaison. Elles s'ouvrent telles quelles dans
un navigateur. Leurs couleurs (vert sapin, ocre) sont celles de la maquette ;
le site rendu prend celles de la commune.

`maquette/captures/` : le rendu réel de l'application, à 1440 et 390 px,
avec photos (`village-photos-*`) et sans aucune photo (`village-sans-photo-*`),
produit par `tests/e2e/village-captures.e2e.spec.ts`, et l'accueil de la
commune de démonstration telle qu'elle est (`village-*`), produit par la suite
de conformité.

Ce que le rendu n'a pas et que la maquette montre (le balisage commun ne le
porte pas) : le blason et la mention « Mairie » dans l'en-tête, le bouton
« Nous contacter », le menu replié sur téléphone, la phrase d'accroche du
héros, la phrase d'introduction des démarches, la mention « Ouverte
aujourd'hui », le tableau des horaires du pied de page.

## Crédits et licences

- **Polices** — Bricolage Grotesque (© The Bricolage Grotesque Project
  Authors) et Atkinson Hyperlegible Next (© The Atkinson Hyperlegible Next
  Project Authors), toutes deux sous SIL Open Font License 1.1 :
  `polices/bricolage-LICENSE.txt`, `polices/atkinson-LICENSE.txt`.
- **Dessins** (frise, scènes) — code de ce dépôt, AGPL-3.0-or-later.
- **Photos de la maquette** — Wikimedia Commons, CC0 ; auteurs dans
  `maquette/images/CREDITS.md`. Elles ne servent qu'à la maquette et aux
  captures : aucune n'est servie par l'application.
- **Pictogrammes des démarches** — GemeentenIconen, CC0 (`public/pictos/`,
  communs à tous les gabarits).
