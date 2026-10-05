# Contrat de gabarit — version 1

Un gabarit est un dossier `src/gabarits/<nom>/` qui compose l'accueil d'un site
communal. Ce contrat dit ce qu'un gabarit **reçoit**, ce qu'il **fournit**, et
ce qui lui est **interdit** : un gabarit tiers qui le respecte et passe la
suite de conformité (`tests/e2e/gabarits-conformite.e2e.spec.ts`,
`tests/unit/gabarits-kits.spec.ts`) est techniquement recevable, qu'il vienne
du projet ou d'un contributeur extérieur (I31). La revue humaine reste
nécessaire pour le goût et la maintenabilité.

Un gabarit tiers est du code relu, jamais un téléversement. ⛽ Pas de thème
téléversé depuis l'admin : du CSS ou du HTML arbitraire peut charger des
ressources tierces (traçage), casser la lisibilité ou introduire du script.

## Ce que le gabarit reçoit

- **Les variables CSS de la commune**, posées en inline sur `<body>` par le
  layout (I23 : recalculées à chaque rendu, jamais stockées) — liste figée et
  versionnée :
  `--principale-sure`, `--pale`, `--profond`, `--encre`, `--accent`,
  `--accent-sur-profond`, `--texte-sur-accent`, `--terre-sure`,
  `--picto-1` … `--picto-6`.
- **Les variables fixes** (dans `styles.css`, jamais issues de la commune) :
  `--alerte`, `--alerte-texte`, `--focus`.
- **Les sections communes** (`src/gabarits/sections/`) : `heros`, `demarches`,
  `mairie`, `texteLibre`, `actualites`, `agenda`, `mosaique` — il choisit
  lesquelles, dans quel ordre (`gabarit.accueil`), avec quelle `variante`, et
  le cadrage du héros (`haut` ou `panorama`). Leur balisage est décrit plus
  bas (« Le balisage des sections ») : c'est lui que `theme.css` met en forme.
- **L'en-tête et le pied de page communs** (`.entete-site`, `.nav-principale`,
  `.selecteur-langue`, `.bandeau-alertes`, `.pied-page`), qu'il met en forme
  sans en changer le balisage. Avec `friseAuPied: true`, la frise de la
  commune est aussi rendue en tête du pied (`.pied-page__frise`).
- **Les données de la commune** rendues par ces sections (couleurs, frise,
  photo d'accueil, démarches, mosaïque, contenus publiés), déjà lues,
  filtrées et mises dans la langue affichée par `Accueil.tsx` : le gabarit ne
  relit pas la base.
- **Les textes fixes** des sections via les dictionnaires `src/i18n/` — jamais
  en dur dans un composant.
- Le moteur de frise (`composerFrise`, `src/gabarits/frise.ts`) : les lignes
  « pièce + taille (+ écart) » de la commune, posées de gauche à droite sur
  1440, base des pièces à y = 150 dans un viewBox de hauteur 160.

## Ce que le gabarit fournit

- `gabarit.ts` — les données seules : `{ nom, libelle, versionContrat, polices,
  accueil: [{ section, variante? }], cadrageHeros, friseAuPied? }`.
  `versionContrat` vaut le numéro de version de ce document que le gabarit
  respecte. `polices` liste les **noms de fichiers** de `polices/` que
  `theme.css` emploie : eux seuls sont servis et préchargés.
- `frise.ts` — le kit : `horizon(): string` (élément SVG, coordonnées
  absolues dans le viewBox 1440×160) et `pieces: Record<string, (x, sol,
  taille) => { formes: string[]; traits: string[] }>` (chemins `d` en
  coordonnées absolues ; une pièce hors kit est ignorée au rendu et listée à
  l'admin, jamais une erreur). Export libre `ornements` (marées, houles…)
  soumis aux mêmes règles.
- `illustrations.ts` — `scene(nom, largeur, hauteur)` pour **toutes** les
  valeurs de `illustration` (`sentiers`, `patrimoine`, `commerces`,
  `associations`, `ecole`, `mer`, `nature` ; une scène inconnue se replie sur
  `nature`) et `heros(largeur, hauteur)`, la grande scène du héros sans photo.
- `theme.css` — sa mise en forme propre : aucune couleur littérale hors
  `#fff`, `#ffffff`, `#000`, `#000000`, `transparent` (ni `rgb()`, `hsl()`,
  `oklch()` : une transparence s'écrit `color-mix(in oklab, var(--x) 40%,
  transparent)`) ; toute `var(--x)` est une variable du contrat, une variable
  fixe, ou une variable locale déclarée dans le même fichier. Une variable
  locale qui dérive d'une couleur de la commune se déclare sur `body`, pas sur
  `:root` (les variables de la commune sont en inline sur `<body>`).
- ses polices auto-hébergées dans `polices/`, chacune avec sa licence dans un
  fichier voisin nommé `<famille>-LICENSE.txt`, où `<famille>` est le début
  du nom du fichier de police (`bricolage-LICENSE.txt` pour
  `bricolage-grotesque-latin-wght.woff2`).
- un `README.md` (intention, crédits, licences) et une maquette statique de
  référence.

## Comment la feuille et les polices sont servies (décision 19 du plan)

Le gabarit ne fait rien : le moteur sert `theme.css` à
`/gabarits/<nom>/theme.css` et chaque police déclarée à
`/gabarits/<nom>/polices/<fichier>`, depuis l'origine de la commune, et le
layout public les lie dans le `<head>` — après `styles.css`, donc une règle de
`theme.css` l'emporte à spécificité égale. Une commune ne reçoit que la
feuille et les polices de son gabarit. Dans `theme.css`, une police se nomme
par son chemin relatif : `url(polices/x.woff2)`. La feuille s'applique à
toutes les pages du site (en-tête, pied, pages intérieures), pas au seul
accueil ; `main:has(> [data-section])` cible l'accueil.

## Le balisage des sections

Chaque section est un `<section data-section="<nom>" class="section-<nom>">`,
enfant direct de `<main>`, dans l'ordre de `gabarit.accueil`.

| Section | Balisage | Variante |
|---|---|---|
| `heros` | `.section-heros--haut\|--panorama`, `.section-heros--photo` ou `--illustre` ; `.section-heros__image` (photo) ou `.section-heros__scene` (scène du kit) ; `.section-heros__texte` › `h1`, puis `a.section-heros__action` (bouton vers `#demarches`, absent si la section démarches n'est pas rendue) ; `.section-heros__frise` › `svg.frise` (`.frise__horizon`, `.frise__formes`, `.frise__traits`) ou `.section-heros__fondu` | — |
| `demarches` | `id="demarches"` ; `h2` ; `ul.demarches` › `li` › `a` › `.demarche__pastille` (fond `--ton`, posé par la section) › `.demarche__picto`, puis `.demarche__corps` › `b`, `small` | — |
| `mairie` | `h2`, `a.mairie__tel`, `p` (horaires : `strong` + `span`), `p` (adresse), `p` › `a` (courriel) | — |
| `texteLibre` | les blocs de la page « accueil » (`RenduBlocs`) | — |
| `actualites` | `.entete-section` › `h2`, `a` ; `ul` › `li.actu` › `.actu__visuel` (image de l'actualité, sinon `.actu__scene` : scène du kit selon le rang — I30) et `.actu__texte` › `p.section-actualites__date`, `h3` › `a`, `p` | `une` : classe `section-actualites--une` ; scène de la première en 800×600, des suivantes en 400×400 (sans variante : 480×360) |
| `agenda` | `.entete-section` ; `ol` › `li` › `p.section-agenda__date` › `time` › `b.section-agenda__jour` + `span.section-agenda__mois`, `h3`, `p.section-agenda__lieu` | — |
| `mosaique` | `.entete-section` › `h2` ; `ul.mosaique` › `li` › `a` ou `div.mosaique__tuile` › image ou `.mosaique__scene`, puis `span.mosaique__libelle` | `une-haute` : classe `mosaique--une-haute` ; scènes en 800×640, 400×640, puis 400×320 (sans variante : 480×600) |

Une variante change le balisage et les dimensions des illustrations, jamais
les données. En ajouter une se fait dans le moteur (`Variante` de
`types.ts` et la section concernée), consignée ici.

## Ce qui est interdit

- Définir une couleur de commune en dur (elle vient des variables, toujours).
- Charger une ressource hors de l'origine, ou ajouter un script (I27 : Next
  envoie les siens, la mesure d'audience aussi — ce n'est pas l'objet).
- Toucher au schéma de données, à un autre gabarit ou aux sections communes
  (I26 : ajouter un gabarit ne modifie rien d'existant, hors l'option du
  select `gabarit`).
- Employer `--accent-sur-profond` hors texte large (≥ 24 px, ou ≥ 18,66 px en
  gras) : sa garantie est de 3:1 sur `--profond`, pas 4,5:1.
- Écrire du texte sur un fond `--pale` dans une autre couleur que `--encre`
  (décision 17 : `--principale-sure` n'est garantie ≥ 4,5:1 que sur blanc ;
  elle ne sert de fond que sous du texte blanc).
- Un SVG de frise ou d'illustration sans `aria-hidden="true"` : ce sont des
  décors.

## Versions

Une variable ou une section retirée = version majeure, avec une note de
migration ici même. Toute autre addition (une pièce, une variante, une
variable) tient dans la version courante.

| Version | Date | Changement |
|---|---|---|
| 1 | 05/10/2026 | Première version (spec § 6, Q3 : export `ornements`). |
| 1 | 05/10/2026 | Additions (tâche 5, gabarit Village) : service de la feuille et des polices (décision 19), `polices` = noms de fichiers, convention de nom des licences ; balisage des sections décrit ; visuel des actualités, date d'agenda en deux parties, bouton du héros, classes `--photo` / `--illustre` ; variantes `une` et `une-haute` ; `friseAuPied`. |
