# Gabarit « Littoral »

Le gabarit des communes du bord de mer : le port, le phare, les dunes et les
goélands, la marée qui monte et descend entre les bandes. Contrat :
`../CONTRAT.md`, version 1.

## Intention

Le Littoral tient son rythme de la **marée** : des bandes pleine largeur —
pâle, profonde — séparées par des vagues, et une typographie de revue (serif
pour les titres, sans-serif pour la lecture) :

- un **héros** pleine largeur en cadrage panorama — la photo posée sous le
  titre, ou le port dessiné quand elle manque — qui se termine sur la **frise
  du territoire au trait**, blanche ;
- la **rive de la mairie** : téléphone, horaires, adresse en casettes séparées
  par des filets, puis les **démarches** en deux colonnes, chacune avec sa
  pastille de couleur ;
- la **marée** sépare chaque bande : texte libre sur fond pâle avec son
  chapeau serif, puis les **actualités** dont la une est un grand pavé pâle au
  visuel débordant jusqu'au bord de l'écran ;
- l'**agenda** sur le fond profond, les dates posées sur la **courbe des
  marées** (hautes, basses, hautes, basses), les jours en grands chiffres
  d'accent ;
- la **mosaïque** « Vivre à… », quatre tuiles décalées comme des vagues, le
  libellé en serif sous l'image ;
- le **pied de page** sur le fond profond, précédé de la frise en silhouettes
  pleines sur blanc — la marée s'y retire.

Aucun script, aucune ressource tierce (I27). Aucun emplacement vide (I30) :
là où une photo manque, une scène du kit la remplace.

## Fichiers

| Fichier            | Rôle                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------- |
| `gabarit.ts`       | composition de l'accueil, variantes, polices, cadrage du héros                                                 |
| `theme.css`        | mise en forme, servie à `/gabarits/littoral/theme.css`                                                         |
| `frise.ts`         | kit de frise : phare, jetée, barque, voilier, cabane, pin, église, maison, mairie, goéland, école, portique, dune, rocher ; ligne de mer et ornements |
| `illustrations.ts` | 7 scènes (`sentiers`, `patrimoine`, `commerces`, `associations`, `ecole`, `mer`, `nature`) et le héros dessiné |
| `polices/`         | polices auto-hébergées et leurs licences                                                                       |
| `maquette/`        | les captures du rendu                                                                                          |

## Couleurs

Toutes viennent de la commune, par les variables du contrat : `--pale` (ciel
des scènes, bande du texte libre, fond de la une et des vignettes),
`--profond` (agenda, pied, pièces et mer des scènes), `--principale-sure`
(liens, vague de fond des marées, bouton du héros dessiné),
`--accent` (soleil), `--accent-sur-profond` (dates de l'agenda, pastilles de
la courbe, texte large seulement), `--encre` (texte), `--picto-1`…`6`
(pastilles des démarches), `--terre-sure` (traits des scènes). `theme.css` ne
contient aucune couleur littérale hors `#fff`.

## La maquette de référence

La page validée par Matthieu Credou le 14/10/2026 vit hors dépôt, dans
`docs/recherche/2026-09-25_front-beau/J-maquette-littoral/` (source ignorée
par git), générée depuis `L-littoral-scenes/frise_littoral.py`. Ses couleurs
(bleu canard) sont celles de la maquette ; le site rendu prend celles de la
commune.

`maquette/captures/` : le rendu réel de l'application, à 1440 et 390 px, avec
photos (`littoral-photos-*`) et sans aucune photo
(`littoral-sans-photo-*`), produit par `tests/e2e/littoral-captures.e2e.spec.ts`.

Ce que le rendu n'a pas et que la maquette montre (le balisage commun ne le
porte pas) : l'ornement SVG `maree` entre les bandes (approché en CSS par des
vagues en dégradés), la courbe des marées derrière l'agenda (approchée par
des arcs pointillés), la ligne de mer sur la photo de la une et l'ornement
sable sous la mosaïque (aucun crochet pour eux), le blason dans l'en-tête, le
tableau des horaires du pied de page.

## Crédits et licences

- **Polices** — Source Serif 4 (© The Source Serif Project Authors) et
  Public Sans (© The Public Sans Project Authors), toutes deux sous SIL Open
  Font License 1.1 : `polices/source-serif-4-LICENSE.txt`,
  `polices/public-sans-LICENSE.txt`.
- **Dessins** (frise, scènes) — code de ce dépôt, AGPL-3.0-or-later.
- **Pictogrammes des démarches** — GemeentenIconen, CC0 (`public/pictos/`,
  communs à tous les gabarits).
