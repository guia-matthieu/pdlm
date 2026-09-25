# Front public : gabarits, frise du territoire et couleurs étendues (design)

Date : 2026-09-25 · Statut : conception validée section par section en conversation le 25/09 ; spec écrite, **à relire par l'utilisateur**

## Contexte et décisions

La recherche du 24-25/09 (`docs/recherche/2026-09-25_front-beau/`, non versionnée) a établi que les sites de communes des agences payantes gagnent par la **composition** (fonds alternés, chevauchements, identité locale dessinée) et non par les couleurs. Une première maquette qui ne changeait que les couleurs et les polices a été rejetée (« pauvre, très basique ») ; la maquette v2 « Village » (`G-maquette-v2/`) a été validée (« excellente proposition »). L'utilisateur a ensuite exigé : « il faut absolument que les couleurs soient facilement configurables avec un choix étendu. C'est l'identité graphique de la commune qui se joue. »

Aujourd'hui, `Communes.apparence` porte deux champs hexadécimaux libres (`couleurPrincipale`, défaut `#264653`, et `couleurAccent`), injectés en variables CSS sur `<body>` dans `src/app/(frontend)/layout.tsx`. Aucune garantie de contraste, aucun gabarit, aucune frise.

Décisions prises avec l'utilisateur :

- **Qui règle.** L'intégrateur (rôle `operateur`) pose le gabarit, la frise et une première palette à la mise en route ; la mairie (rôle `admin` de la commune) ajuste ensuite ses couleurs et sa photo d'accueil dans un écran simple avec aperçu.
- **Couleurs : 3 choisies, le reste dérivé.** Principale, accent, terre. Le système dérive le reste et garantit la lisibilité **sans jamais refuser un choix** ; chaque dérivée peut être forcée en réglage avancé.
- **Gabarits : Village + Littoral.** Deux gabarits au lancement, le second choisi pour contraster franchement ; un troisième viendra quand une commune réelle le demandera.
- **Architecture : option A.** Un gabarit = une feuille de style + la composition de l'accueil + un kit de frise. Écartées : « CSS seule » (retombe dans le même-site-autres-couleurs rejeté) et « accueil composé en blocs par l'intégrateur » (chaque site devient unique à maintenir).

Hors périmètre : un troisième gabarit ; l'extraction des couleurs d'un blason ou d'un logo ; les pièces de frise dessinées par un illustrateur (le kit de départ est dessiné en code) ; la prévisualisation d'autres pages que l'accueil ; les changements d'apparence programmés ; la gestion du site par téléphone (spec séparée, suivante).

Invariants numérotés à partir de I23 : I14 à I17 sont pris par la spec multilingue, I18 à I22 par la spec mesure d'audience.

## Section 1 : données et droits

Tout vit dans le groupe `Communes.apparence` ; aucune nouvelle collection.

| Champ | Type | Contenu | Modifiable par |
|---|---|---|---|
| `gabarit` | select | `village` \| `littoral`, défaut `village` | `operateur` |
| `frise` | array | lignes `{ piece: select, taille: 'petite' \| 'moyenne' \| 'grande', ecart?: number }`, ordre = gauche à droite | `operateur` |
| `couleurPrincipale` | text | `#RRGGBB` (existant) | `operateur`, `admin` commune |
| `couleurAccent` | text | `#RRGGBB` (existant) | `operateur`, `admin` commune |
| `couleurTerre` | text | `#RRGGBB` (nouveau) | `operateur`, `admin` commune |
| `couleursForcees` | group, replié « Réglages avancés » | `texte`, `pale`, `profond`, `picto1`…`picto6`, tous vides par défaut ; vide = dérivé | `operateur`, `admin` commune |
| `photoAccueil` | relation → `media` | photo du héros ; le texte alternatif vient du média | `operateur`, `admin` commune |

Règles :

- **I23 — Les couleurs dérivées ne sont jamais stockées.** Elles sont recalculées au rendu depuis les couleurs choisies (et forcées). Une amélioration de l'algorithme profite à toutes les communes ; la base ne contient aucune valeur périmée.
- **I24 — Rien n'est refusé sauf le format.** La seule validation d'une couleur est `^#[0-9a-fA-F]{6}$` (comme aujourd'hui). Une couleur illisible est acceptée et rendue lisible par la dérivation.
- **Changer de gabarit ne perd rien.** Les couleurs sont gardées. Les lignes de frise dont la pièce n'existe pas dans le kit du nouveau gabarit sont **conservées en base, ignorées au rendu**, et l'admin affiche un avertissement listant ces lignes. L'option `piece` est donc l'union des pièces de tous les kits ; la validation d'appartenance au kit se fait au rendu, pas à l'enregistrement.
- **Frise vide = pas de frise.** Le héros se termine sur un fondu, sans frise « par défaut » générique.
- **Le rédacteur ne touche pas à l'apparence** : accès en lecture seule sur tout le groupe.
- **Migration** : ajout des colonnes ; les valeurs existantes de `couleurPrincipale` / `couleurAccent` restent, `couleurTerre` vide prend son défaut au rendu (même valeur que le défaut de `styles.css`).

## Section 2 : dérivation des couleurs

Module pur `src/lib/couleurs.ts`, sans accès réseau ni base : entrée = couleurs choisies + forcées, sortie = un dictionnaire de variables CSS. Calculs en **OKLCH** (bibliothèque `culori`, MIT, côté serveur uniquement ; aucun JavaScript envoyé au visiteur).

Signature :

```ts
type Choix = { principale: string; accent: string; terre: string }
type Forcees = Partial<Record<'texte' | 'pale' | 'profond' | `picto${1|2|3|4|5|6}`, string>>
export function deriver(choix: Choix, forcees?: Forcees): {
  variables: Record<string, string>          // '--principale-sure': '#1f5a45', …
  controles: { role: string; couleur: string; fond: string; contraste: number; seuil: number; force: boolean }[]
  avertissements: string[]                   // harmonie, contraste d'une forcée
}
```

| Variable | Source | Garantie (si non forcée) |
|---|---|---|
| `--principale-sure` (texte, liens, boutons) | principale | contraste ≥ 4,5:1 sur `#ffffff` : si non atteint, baisser la clarté L en gardant teinte et saturation (recherche dichotomique, saturation réduite si hors gamut sRGB) ; si atteint, couleur inchangée |
| `--pale` (fonds de section) | principale | L = 0,96, saturation plafonnée à 0,03 ; texte `--encre` dessus ≥ 4,5:1 |
| `--profond` (agenda, pied de page) | principale | texte blanc dessus ≥ 7:1 |
| `--accent` | accent | inchangé (décor) |
| `--accent-sur-profond` (grandes dates) | accent | ≥ 3:1 sur `--profond` (texte large), éclairci si besoin |
| `--texte-sur-accent` | accent | `#000000` ou `#ffffff`, le plus contrasté (≥ 4,58:1 pour toute couleur) |
| `--terre-sure` | terre | pictogramme blanc dessus ≥ 3:1 (élément non textuel, RGAA 3.3) |
| `--picto-1` … `--picto-6` | principale-sûre, terre-sûre, puis 4 teintes réparties sur le cercle en évitant ±30° autour des deux premières | même bande de clarté que les deux premières ; blanc dessus ≥ 3:1 |
| `--alerte`, `--alerte-texte`, `--focus` | **fixes** | jamais issus de la commune ; anneau de focus double noir + blanc, visible sur tout fond |

- **I25 — Chaque garantie du tableau tient pour toute couleur choisie valide**, vérifié par test de propriété.
- **Couleur forcée** : utilisée telle quelle ; son contraste mesuré figure dans `controles` avec `force: true` et, sous le seuil, un avertissement (« texte des liens : 2,1:1, illisible »). Jamais de refus.
- **Harmonie** (avertissements, jamais bloquants) : écart perceptif ΔE OKLab < 0,08 entre deux couleurs choisies → « l'accent se confond avec la principale » (seuil à étalonner sur la maquette, valeur de départ).
- **Accords proposés** : `accords(principale): string[]` rend 4 à 5 couleurs (complémentaire, deux voisines, triade) utilisées comme pastilles cliquables dans l'admin.
- **Cas nommés de référence** : `#2f7d5b` (4,99:1 sur blanc, mesuré le 25/09) doit ressortir **inchangée** ; une principale claire (`#7fc8a0`) doit être assombrie jusqu'à ≥ 4,5:1 en gardant sa teinte (écart de teinte OKLCH < 2°) ; jaune pur `#ffff00`, gris moyen `#777777`, noir, blanc. ⚠️ Le `#1f5a45` de la maquette v2 a été choisi à la main, ce n'est pas une sortie attendue de la dérivation.

## Section 3 : gabarits et frise

Un gabarit = un dossier `src/gabarits/<nom>/` :

- `gabarit.ts` — données seules : `{ nom, libelle, polices: string[], accueil: { section: NomSection; variante?: string }[] }`.
- `theme.css` — la mise en forme propre au gabarit, qui ne référence les couleurs que par les variables de la section 2.
- `frise.ts` — le kit : `horizon(): string` (chemin SVG de la ligne d'horizon) et `pieces: Record<NomPiece, (x: number, sol: number, taille: Taille) => { formes: string[]; traits: string[] }>`.

Les **sections d'accueil sont des composants React communs** (`src/gabarits/sections/`) : héros, démarches, carte mairie, actualités, agenda, mosaïque, abonnement aux alertes. Un gabarit choisit lesquelles, dans quel ordre et avec quelle variante (`actualites: 'une-decalee' | 'bandeau'`, etc.). Un composant propre à un gabarit reste possible, par exception. Les **pages intérieures et les blocs existants** (Hero, TexteRiche, Image, Galerie, Accordeon, Boutons, Contact) sont communs et ne varient que par `theme.css`.

- **I26 — Ajouter un gabarit ne modifie ni le schéma de données (hors l'option du select), ni les autres gabarits.**
- **I27 — Le site public reste sans `<script>` et sans ressource tierce**, quel que soit le gabarit (polices auto-hébergées, SVG intégré).

Différences visibles attendues entre les deux gabarits :

| | Village | Littoral |
|---|---|---|
| Héros | photo haute, H1 massif en bas à gauche, frise pleine blanche qui mange le bas de la photo | photo panoramique basse, beaucoup de ciel, H1 plus fin, horizon marin en trait qui coupe la photo |
| Horizon | collines | ligne de mer, légère houle |
| Pièces | maison, maison basse, église, mairie, sapin, arbre | phare, quai / jetée, barque, cabane de plage, pin parasol, église de port, mairie |
| Polices | Bricolage Grotesque + Atkinson Hyperlegible Next | parmi les polices OFL de la recherche B, registre plus aéré ; fixées à la validation de la maquette Littoral |
| Rythme | sections pleines, chevauchements marqués | grandes respirations blanches, fonds pâles en bandes horizontales |
| Carte mairie | chevauche le héros | posée sur la ligne d'horizon |

Frise :

- **Composition (opérateur)** : lignes « pièce + taille (+ écart) », gauche → droite ; les positions sont calculées (répartition sur la largeur 1440, l'écart ajoute de l'air) ; pas de placement au pixel. Aperçu SVG en direct dans l'admin (composant client de l'admin ; l'admin peut exécuter du JavaScript).
- **Rendu public** : SVG généré côté serveur, intégré au HTML, `aria-hidden="true"`, rendu deux fois (silhouette pleine en bas du héros, trait dans le pied de page), comme `G-maquette-v2/frise.py`.
- **Licence** : les pièces sont du code du dépôt (AGPL) ; les futures pièces dessinées par un illustrateur seront sous licence libre compatible, commandées une fois pour tous les gabarits.

## Section 4 : écran d'ajustement et aperçu

Onglet **« Apparence »** dans la fiche commune. L'`admin` de la commune y voit les couleurs, la photo d'accueil et les réglages avancés (repliés) ; l'`operateur` voit en plus le gabarit et la frise.

Déroulé :

1. Trois pastilles (principale, accent, terre), chacune avec sélecteur de couleur, champ hexadécimal et pastilles d'accords cliquables.
2. **Aperçu en direct** de la vraie page d'accueil de la commune avec les couleurs **non enregistrées**, interrupteur ordinateur / téléphone ; mise à jour < 1 s après un changement (délai anti-rebond ~300 ms).
3. **Bande de contrôle** sous l'aperçu : les dérivées réellement utilisées (`controles` de la section 2), chacune avec son contraste ; toutes conformes sauf valeur forcée.
4. « Enregistrer » ; les versions Payload permettent le retour arrière.

Aperçu :

- Route **`/apercu/apparence`** sur le domaine de la commune : rend l'accueil du gabarit en lisant `principale`, `accent`, `terre`, les forcées et `gabarit` dans les paramètres d'URL au lieu de la base. `noindex`, `Cache-Control: no-store`.
- L'admin l'affiche dans un **iframe** dont il recharge l'URL à chaque changement. Le Live Preview de Payload n'est pas utilisé (il ajoute un composant client aux pages publiques).
- **I28 — La route d'aperçu n'est servie qu'à un utilisateur connecté ayant un rôle (`admin`, ou `operateur`) sur la commune résolue par le domaine.** La commune n'est jamais lue dans l'URL. Sinon : 404.
- **I29 — Les paramètres de l'aperçu sont validés** (`^#[0-9a-fA-F]{6}$` pour les couleurs, liste fermée pour `gabarit`) ; tout paramètre invalide ou inconnu est ignoré et remplacé par la valeur en base. Aucune valeur de paramètre n'est écrite telle quelle dans le HTML.
- **En-tête** : `frame-ancestors` de la route d'aperçu autorise l'origine de l'admin ; le site public garde son en-tête actuel.

## Section 5 : tests et ordre de construction

Tests :

- **Couleurs** : tests de propriété (quelques milliers de couleurs tirées avec une graine fixe) : I25 sur chaque ligne du tableau ; cas nommés de la section 2 ; forcée sous le seuil → avertissement et aucune correction.
- **Frise** : chaque pièce de chaque kit rend des chemins SVG syntaxiquement valides pour les trois tailles ; frise vide → aucun SVG ; pièce hors kit → ignorée sans erreur et signalée.
- **Gabarits** : pour chaque gabarit, rendu de l'accueil avec les données de démonstration → sections attendues dans l'ordre de `gabarit.ts`, zéro `<script>`, zéro URL tierce (I27), variables des 3 couleurs présentes.
- **Accès** : rédacteur → aucun champ d'apparence modifiable ; admin commune → ni `gabarit` ni `frise` ; route d'aperçu → 404 pour anonyme, pour un utilisateur d'une autre commune, et paramètre mal formé ignoré (I28, I29).
- **Rendu** : captures Playwright de l'accueil, ordinateur (1440) et téléphone (390), pour chaque gabarit × deux jeux de couleurs très différents ; **regardées avant fusion** (les tests ne voient pas une composition ratée) ; audit axe sans violation sur l'accueil de chaque gabarit.

Ordre de construction :

0. **Maquette statique Littoral** hors du code, même format que `G-maquette-v2/` ; validation visuelle par l'utilisateur. Seule étape qui dépend de son regard ; les étapes 5-6 en dépendent.
1. `src/lib/couleurs.ts` + tests.
2. Données, migration, droits (section 1).
3. Moteur de gabarits + Village : l'accueil actuel (`src/app/(frontend)/page.tsx`) est remplacé par le gabarit Village porté depuis la maquette v2.
4. Kit de frise Village, champ frise, aperçu SVG dans l'admin.
5. Littoral (kit, `theme.css`, composition).
6. Onglet Apparence, route d'aperçu, bande de contrôle.

## Points non vérifiés

- Le seuil ΔE d'harmonie (0,08) est une valeur de départ, à étalonner.
- Le comportement d'un iframe d'aperçu sur le domaine de la commune depuis l'admin servi sur un autre domaine (cookies de session `SameSite`) n'a pas été testé ; si la session n'est pas transmise, la route d'aperçu passera sous le domaine de l'admin avec la commune résolue depuis la session (I28 inchangé dans l'esprit : jamais depuis l'URL).
- `culori` : version et poids à relever au moment du plan.
