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
  le cadrage du héros (`haut` ou `panorama`).
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
  accueil: [{ section, variante? }], cadrageHeros }`. `versionContrat` vaut le
  numéro de version de ce document que le gabarit respecte.
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
  `#fff`, `#ffffff`, `#000`, `#000000`, `transparent` ; toute `var(--x)` est
  une variable du contrat, une variable fixe, ou une variable locale déclarée
  dans le même fichier.
- ses polices auto-hébergées dans `polices/`, chacune avec son fichier de
  licence voisin.
- un `README.md` (intention, crédits, licences) et une maquette statique de
  référence.

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
