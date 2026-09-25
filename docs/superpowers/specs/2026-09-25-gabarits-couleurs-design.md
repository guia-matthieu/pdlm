# Front public : gabarits, frise du territoire et couleurs étendues (design)

Date : 2026-09-25 · Statut : conception validée section par section en conversation le 25/09 ; relue contre le code le 25/09 ; **points bloquants tranchés par l'utilisateur le 25/09** (tableau en fin de document) ; maquettes Village et Littoral validées le 25/09 ; section 6 (gabarits tiers) ajoutée à la demande de l'utilisateur le 25/09 ; à relire avant le plan

## Contexte et décisions

La recherche du 24-25/09 (`docs/recherche/2026-09-25_front-beau/` dans le checkout `~/Projects/glm`, non versionnée ; absente de ce worktree) a établi que les sites de communes des agences payantes gagnent par la **composition** (fonds alternés, chevauchements, identité locale dessinée) et non par les couleurs. Une première maquette qui ne changeait que les couleurs et les polices a été rejetée (« pauvre, très basique ») ; la maquette v2 « Village » (`G-maquette-v2/`) a été validée (« excellente proposition »). L'utilisateur a ensuite exigé : « il faut absolument que les couleurs soient facilement configurables avec un choix étendu. C'est l'identité graphique de la commune qui se joue. »

Aujourd'hui, `Communes.apparence` porte deux champs hexadécimaux libres (`couleurPrincipale`, `couleurAccent`), injectés en variables CSS sur `<body>` dans `src/app/(frontend)/layout.tsx` ; `styles.css` (`:root`) leur donne à tous deux le défaut `#264653`. L'accueil (`src/app/(frontend)/page.tsx`) rend la page publiée de slug `accueil` (blocs). Aucune garantie de contraste, aucun gabarit, aucune frise.

Décisions prises avec l'utilisateur :

- **Qui règle.** L'intégrateur (rôle `operateur`) pose le gabarit, la frise et une première palette à la mise en route ; la mairie (rôle `admin` de la commune) ajuste ensuite ses couleurs, sa photo d'accueil et le contenu de l'accueil dans un écran simple avec aperçu.
- **Couleurs : 3 choisies, le reste dérivé.** Principale, accent, terre. Le système dérive le reste et garantit la lisibilité **sans jamais refuser un choix** ; chaque dérivée peut être forcée en réglage avancé.
- **Gabarits : Village + Littoral.** Deux gabarits au lancement, le second choisi pour contraster franchement ; un troisième viendra quand une commune réelle le demandera.
- **Architecture : option A.** Un gabarit = une feuille de style + la composition de l'accueil + un kit de frise (qui sert aussi aux illustrations par défaut). Écartées : « CSS seule » (retombe dans le même-site-autres-couleurs rejeté) et « accueil composé en blocs par l'intégrateur » (chaque site devient unique à maintenir).
- **Contenu de l'accueil : structure par défaut, éditable.** Les démarches les plus courantes sont préremplies et la mairie les modifie ; la mosaïque « Vivre au village » est éditable. Un emplacement sans photo reçoit une **illustration stylisée** tirée du kit du gabarit, jamais une photo générique ni un vide (utilisateur, 25/09).
- **La page « accueil » à blocs est conservée** et rendue dans une section « texte libre » du gabarit.
- **Versions activées sur `Communes`** pour permettre le retour arrière.

Hors périmètre : un troisième gabarit ; l'extraction des couleurs d'un blason ou d'un logo ; les pièces de frise dessinées par un illustrateur ; la prévisualisation d'autres pages que l'accueil ; les changements d'apparence programmés ; **l'inscription des habitants aux alertes** (SMS / e-mail : liste d'inscrits, envoi, désinscription — c'est un service à part entière, renvoyé à la spec « gestion par téléphone ») ; la gestion du site par téléphone.

Invariants numérotés à partir de I23 : I14 à I17 sont pris par la spec multilingue, I18 à I22 par la spec mesure d'audience.

## Section 1 : données et droits

Deux groupes sur `Communes` ; aucune nouvelle collection. **Versions activées** sur `Communes` (`versions: { maxPerDoc: 20 }`, sans brouillons) : table `_communes_v` créée par la migration ; l'historique couvre toute la fiche.

### Groupe `apparence`

| Champ | Type | Contenu | Modifiable par |
|---|---|---|---|
| `gabarit` | select | `village` \| `littoral`, défaut `village` | `operateur` |
| `frise` | array | lignes `{ piece: text, taille: 'petite' \| 'moyenne' \| 'grande', ecart?: number }`, ordre = gauche à droite | `operateur` |
| `couleurPrincipale` | text | `#RRGGBB` (existant) | `operateur`, `admin` commune |
| `couleurAccent` | text | `#RRGGBB` (existant) | `operateur`, `admin` commune |
| `couleurTerre` | text | `#RRGGBB` (nouveau) | `operateur`, `admin` commune |
| `couleursForcees` | group, replié « Réglages avancés » | `texte`, `pale`, `profond`, `picto1`…`picto6`, vides par défaut ; vide = dérivé | `operateur`, `admin` commune |
| `photoAccueil` | relation → `media` | photo du héros ; texte alternatif pris du média ; **passe par `validerRelationsTenant` comme `logo` (I4)** | `operateur`, `admin` commune |

- `piece` est un **`text`** (pas un `select`) : un `select` Postgres imposerait `ALTER TYPE … ADD VALUE` à chaque nouvelle pièce, donc une migration par kit, contraire à I26. L'appartenance au kit est vérifiée au rendu ; l'admin propose la liste des pièces du gabarit courant.

### Groupe `accueil` (nouveau)

| Champ | Type | Contenu | Modifiable par |
|---|---|---|---|
| `demarches` | array, 0-8 lignes | `{ picto: select, titre: text, precision?: text, lien?: text }` | `operateur`, `admin` commune |
| `mosaique` | array, 0-4 lignes | `{ libelle: text, lien?: text, photo?: relation → media (validerRelationsTenant), illustration: select }` | `operateur`, `admin` commune |

- **Préremplissage** (hook `beforeChange` à la création d'une commune, et migration pour les communes existantes sans lignes) : Déchets ; Papiers d'identité ; État civil ; Urbanisme ; École et cantine ; Conseil municipal. Les démarches qui ont une fiche nationale reçoivent son lien service-public.fr (papiers d'identité, état civil, urbanisme) ; les autres sont préremplies **sans lien**, et l'admin les marque « à compléter ».
- `picto` : liste fermée de pictogrammes **GemeentenIconen (CC0)**, fichiers SVG dans le dépôt.
- `illustration` (mosaïque) : liste fermée de scènes (`sentiers`, `patrimoine`, `commerces`, `associations`, `ecole`, `mer`, `nature`) ; utilisée quand `photo` est vide.
- Mosaïque préremplie de 4 tuiles sans photo (Balades et sentiers → `sentiers`, Patrimoine → `patrimoine`, Commerces → `commerces`, Associations → `associations`), sans lien.

### Règles

- **I23 — Les couleurs dérivées ne sont jamais stockées.** Recalculées au rendu depuis les choisies (et forcées).
- **I24 — Rien n'est refusé sauf le format.** La seule validation d'une couleur est `^#[0-9a-fA-F]{6}$`. Une couleur illisible est acceptée et rendue lisible par la dérivation.
- **I30 — Aucun emplacement vide n'est rendu.** Photo absente → illustration du kit ; lien absent → l'élément n'est pas rendu (démarche) ou n'est pas cliquable (tuile de mosaïque, qui garde son illustration) ; section sans élément → section non rendue.
- **Changer de gabarit ne perd rien.** Couleurs et contenus gardés ; les lignes de frise dont la pièce n'existe pas dans le nouveau kit sont conservées en base, ignorées au rendu, et listées en avertissement dans l'admin. Idem pour une scène d'illustration absente du kit : repli sur `nature`.
- **Frise vide = pas de frise** dans le héros et le pied de page (le héros se termine sur un fondu).
- **Le rédacteur ne touche ni à `apparence` ni à `accueil`** (lecture seule). Il continue d'éditer la page « accueil » à blocs, comme toute page.
- **Défauts** : vivent dans `src/lib/couleurs.ts` (plus dans `styles.css` seul) : principale `#264653` (inchangée), accent `#e2a72e`, terre `#b36b00`. L'avertissement d'harmonie (section 2) ne porte que sur des couleurs **saisies**, jamais sur un défaut.
- **Migration** : colonnes des deux groupes, table des versions, préremplissage `accueil` des communes existantes ; `couleurPrincipale` / `couleurAccent` existantes inchangées.

## Section 2 : dérivation des couleurs

Module pur `src/lib/couleurs.ts`, sans accès réseau ni base. Calculs en **OKLCH** avec `culori` (4.0.2, MIT, relevé le 25/09), côté serveur et admin uniquement.

```ts
type Choix = { principale?: string; accent?: string; terre?: string }   // absent = défaut
type Forcees = Partial<Record<'texte' | 'pale' | 'profond' | `picto${1|2|3|4|5|6}`, string>>
export function deriver(choix: Choix, forcees?: Forcees): {
  variables: Record<string, string>          // '--principale-sure': '#…', …
  controles: { role: string; couleur: string; fond: string; contraste: number; seuil: number; force: boolean }[]
  avertissements: string[]                   // harmonie, contraste d'une forcée
}
export function accords(principale: string): string[]   // 4 à 5 propositions
```

| Variable | Source | Garantie (si non forcée) |
|---|---|---|
| `--principale-sure` (texte, liens, boutons) | principale | ≥ 4,5:1 sur `#ffffff` : si non atteint, baisser la clarté L en gardant teinte et saturation (dichotomie ; saturation réduite si hors gamut sRGB) ; sinon inchangée |
| `--pale` (fonds de section) | principale | L = 0,96, saturation ≤ 0,03 ; texte `--encre` dessus ≥ 4,5:1 |
| `--profond` (agenda, pied de page) | principale | texte blanc dessus ≥ 7:1 |
| `--accent` | accent | inchangé (décor) |
| `--accent-sur-profond` | accent | ≥ 3:1 sur `--profond`, éclairci si besoin. **Réservé au texte large** (≥ 24 px, ou ≥ 18,66 px en gras) : `theme.css` ne l'emploie que pour les grandes dates de l'agenda, avec une taille minimale qui respecte ce seuil à toutes les largeurs |
| `--texte-sur-accent` | accent | `#000000` ou `#ffffff`, le plus contrasté (≥ 4,58:1 pour toute couleur) |
| `--terre-sure` | terre | pictogramme blanc dessus ≥ 3:1 (élément non textuel, RGAA 3.3) |
| `--picto-1` … `--picto-6` | principale-sûre, terre-sûre, puis 4 teintes réparties en évitant ±30° autour des deux premières | même bande de clarté que les deux premières ; blanc dessus ≥ 3:1 |
| `--alerte`, `--alerte-texte`, `--focus` | **fixes** | jamais issus de la commune ; anneau de focus bicolore (existant dans `styles.css`) |

- **I25 — Chaque garantie du tableau tient pour toute couleur choisie valide**, vérifié par test de propriété.
- **Couleur forcée** : utilisée telle quelle ; contraste dans `controles` avec `force: true` ; sous le seuil, avertissement (« texte des liens : 2,1:1, illisible »). Jamais de refus.
- **Harmonie** (avertissements, jamais bloquants, sur couleurs saisies seulement) : ΔE OKLab < 0,08 entre deux couleurs → « l'accent se confond avec la principale » (valeur de départ, à étalonner).
- **Anciens noms de variables** : `styles.css` et les blocs emploient `--couleur-principale`, `--couleur-accent`, `--couleur-fond-alt`, `--couleur-erreur`… Ils restent, redéfinis en **alias** des nouvelles variables (`--couleur-principale: var(--principale-sure)`, `--couleur-accent: var(--accent)`, `--couleur-fond-alt: var(--pale)`, `--couleur-erreur: var(--alerte)`) ; les blocs n'ont pas à changer dans ce lot. Le layout n'injecte plus que la sortie de `deriver()`.
- **Cas nommés** : `#2f7d5b` (4,99:1) ressort **inchangée** ; `#7fc8a0` (1,97:1) est assombrie jusqu'à ≥ 4,5:1 avec un écart de teinte OKLCH < 2° ; `#777777` (4,48:1, juste sous le seuil) est légèrement assombrie ; `#ffff00`, `#000000`, `#ffffff`. Contrastes WCAG recalculés le 25/09. Le `#1f5a45` de la maquette v2 a été choisi à la main, ce n'est pas une sortie attendue.

## Section 3 : gabarits, frise et illustrations

Un gabarit = un dossier `src/gabarits/<nom>/` :

- `gabarit.ts` — données seules : `{ nom, libelle, polices: string[], accueil: { section: NomSection; variante?: string }[], cadrageHeros: 'haut' | 'panorama' }`.
- `theme.css` — la mise en forme propre au gabarit, qui ne référence les couleurs que par les variables de la section 2.
- `frise.ts` — le kit : `horizon(): string` et `pieces: Record<string, (x: number, sol: number, taille: Taille) => { formes: string[]; traits: string[] }>`.
- `illustrations.ts` — `scene(nom: Scene, largeur: number, hauteur: number): string` : une scène SVG composée **à partir des pièces du kit** (arbres et chemin pour `sentiers`, église pour `patrimoine`, rangée de maisons pour `commerces`, etc.), aux couleurs `--pale`, `--principale-sure`, `--terre-sure`, `--accent` ; plus `heros(largeur, hauteur)`, grande scène qui remplace la photo d'accueil absente.

**Sections d'accueil communes** (`src/gabarits/sections/`) : héros, démarches, carte mairie, texte libre, actualités, agenda, mosaïque. Un gabarit choisit lesquelles, dans quel ordre et avec quelle variante. La section « inscription aux alertes » de la maquette **n'est pas construite** dans ce lot (hors périmètre). La section **texte libre** rend les blocs de la page publiée de slug `accueil` avec `RenduBlocs` (existant) ; page absente ou vide → section non rendue (I30). La route `/accueil` reste joignable avec sa canonique vers `/` (comportement actuel de `[slug]/page.tsx`).

**Textes fixes** des sections (« Vos démarches », « Au village ce mois-ci »…) : dans les dictionnaires `src/i18n/` de la spec multilingue, jamais en dur dans les composants.

- **I26 — Ajouter un gabarit ne modifie ni le schéma de données (hors l'option du select `gabarit`), ni les autres gabarits.**
- **I27 — Un gabarit n'ajoute ni script ni ressource tierce.** (Next.js envoie ses propres scripts et la mesure d'audience peut ajouter le sien : ce n'est pas l'objet de l'invariant.) Polices auto-hébergées, SVG intégré au HTML.

| | Village | Littoral |
|---|---|---|
| Héros | photo haute, H1 massif en bas à gauche, frise pleine blanche qui mange le bas de la photo | photo panoramique basse, beaucoup de ciel, H1 plus fin, horizon marin en trait qui coupe la photo |
| Horizon | collines | ligne de mer, légère houle |
| Pièces | maison, maison basse, église, mairie, sapin, arbre | phare, quai / jetée, barque, cabane de plage, pin parasol, église de port, mairie |
| Polices | Bricolage Grotesque + Atkinson Hyperlegible Next | parmi les polices OFL de la recherche B, registre plus aéré ; fixées à la validation de la maquette Littoral |
| Rythme | sections pleines, chevauchements marqués | grandes respirations blanches, fonds pâles en bandes horizontales |
| Carte mairie | chevauche le héros | posée sur la ligne d'horizon |

**Cadrages d'image** : `Media.imageSizes` n'a qu'un `hero` 1600×900 recadré au centre. Ajout de `heros-haut` (1600×1100) et `panorama` (2000×800), recadrés au point focal (`focalPoint` Payload) ; les médias existants doivent être régénérés — mécanisme (script ou re-téléversement) à établir au plan, point non vérifié.

Frise :

- **Composition (opérateur)** : lignes « pièce + taille (+ écart) », gauche → droite ; positions calculées sur la largeur 1440 ; pas de placement au pixel. Aperçu SVG en direct dans l'admin (composant client de l'admin).
- **Rendu public** : SVG généré côté serveur, intégré au HTML, `aria-hidden="true"`, deux fois (silhouette pleine en bas du héros, trait dans le pied de page), comme `G-maquette-v2/frise.py`.
- **Licence** : pièces et scènes sont du code du dépôt (AGPL) ; de futures pièces dessinées seront sous licence libre compatible.

## Section 4 : écran d'ajustement et aperçu

Onglet **« Apparence »** dans la fiche commune : l'`admin` de la commune y voit les couleurs, la photo d'accueil, les réglages avancés (repliés) et le groupe `accueil` ; l'`operateur` voit en plus le gabarit et la frise.

Déroulé :

1. Trois pastilles (principale, accent, terre) : sélecteur, champ hexadécimal, pastilles d'accords cliquables.
2. **Aperçu en direct** de l'accueil de la commune avec les couleurs et le gabarit **non enregistrés** ; interrupteur ordinateur / téléphone ; mise à jour < 1 s (anti-rebond ~300 ms). La frise, la photo et le groupe `accueil` apparaissent dans l'aperçu **tels qu'enregistrés** ; la frise a son propre aperçu SVG en direct au-dessus de sa liste. Le dire dans l'interface (« photo et contenus : visibles après enregistrement »).
3. **Bande de contrôle** : les dérivées réellement utilisées, chacune avec son contraste.
4. « Enregistrer » ; « Versions » permet de restaurer un état précédent.

Aperçu — **sous le domaine de l'admin** (la connexion n'existe que là : `src/proxy.ts` redirige `/admin` des domaines communaux vers `ADMIN_URL`, CORS et CSRF sont limités à cette origine) :

- Route **`/apercu/apparence`**, dans un groupe de routes **hors** de `(frontend)` (sous l'hôte de l'admin, `resolveCommune()` rend `null` et le layout `(frontend)` répond 404) et hors de `[lang]` (paramètre `lang`, défaut `fr`). La route charge elle-même la commune et la passe aux sections.
- Paramètres : `commune` (id), `gabarit`, `principale`, `accent`, `terre`, forcées, `lang`.
- **I28 — La route d'aperçu n'est servie qu'à un utilisateur connecté qui est `operateur`, ou `admin` de la commune demandée (`aRoleSur(user, id, 'admin')`).** Sinon : 404. La commune figure dans l'URL (un opérateur n'a pas de liste de communes, un admin peut en avoir plusieurs) : la garantie est le contrôle de rôle, pas l'absence de l'identifiant.
- **I29 — Les paramètres de l'aperçu sont validés** (`^#[0-9a-fA-F]{6}$` pour les couleurs, listes fermées pour `gabarit` et `lang`, entier pour `commune`) ; tout paramètre invalide ou inconnu est ignoré et remplacé par la valeur en base. Aucune valeur de paramètre n'est écrite telle quelle dans le HTML.
- **En-têtes** : l'iframe est same-origin (admin → admin), donc COEP / COOP actuels ne bloquent pas. Exception dans `next.config.ts` `headers()`, entrée `source: '/apercu/:path*'` placée **après** la matrice générale `/(.*)` : `Content-Security-Policy` avec `frame-ancestors 'self'`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`. Un test d'intégration lit les en-têtes réellement servis sur cette route et sur une page publique (la précédence entre deux entrées qui posent la même clé se vérifie, elle ne se suppose pas).

## Section 5 : tests, documentation, ordre de construction

Dépendances de test à ajouter : `fast-check` (MIT, tests de propriété) et `@axe-core/playwright` (audit axe).

Tests :

- **Couleurs** : propriété (graine fixe) : I25 sur chaque ligne du tableau ; cas nommés ; forcée sous le seuil → avertissement sans correction ; défauts non saisis → aucun avertissement d'harmonie.
- **Frise et illustrations** : chaque pièce et chaque scène de chaque kit rend un SVG valide pour toutes les tailles ; frise vide → aucun SVG ; pièce ou scène hors kit → ignorée ou repli, sans erreur.
- **Gabarits** : la **suite de conformité commune** de la section 6 (I31), exécutée sur Village et Littoral ; en plus, page `accueil` vide → pas de section texte libre.
- **Données** : création d'une commune → 6 démarches et 4 tuiles préremplies ; `photoAccueil` et `mosaique.photo` d'une autre commune refusées (I4) ; une version créée à chaque enregistrement.
- **Accès** : rédacteur → aucun champ `apparence` / `accueil` modifiable ; admin commune → ni `gabarit` ni `frise` ; aperçu → 404 pour anonyme, pour l'admin d'une autre commune, paramètres mal formés ignorés (I28, I29) ; en-têtes servis vérifiés.
- **Rendu** : captures Playwright de l'accueil, 1440 et 390, par gabarit × deux jeux de couleurs très différents × avec et sans photos ; **regardées avant fusion** ; audit axe sans violation.

Documentation : réécrire la section « Accessibilité (RGAA) » du README, qui demande aujourd'hui de vérifier le contraste à la main (I24 et I25 rendent ce paragraphe faux).

Ordre de construction et branche :

0. **Maquette statique Littoral** hors du code, même format que `G-maquette-v2/`, avec une tuile et un héros illustrés ; validation visuelle par l'utilisateur. — **tout de suite**
1. `src/lib/couleurs.ts` + tests. — **tout de suite, sur `gabarits-couleurs` (base `main`)** : fichier neuf, aucun conflit possible.
2. Données, migration, droits, versions, préremplissage (section 1). — **après fusion d'`umami-collecte` et de `multilingue-socle` dans `main`**, puis rebase de `gabarits-couleurs` : les trois chantiers touchent `Communes.ts`, `layout.tsx`, `lib/commune.ts` et les migrations.
3. Moteur de gabarits + Village (sections, texte libre, illustrations) ; l'accueil passe au gabarit ; **contrat de gabarit** (`src/gabarits/CONTRAT.md`) et **suite de conformité commune** (section 6), écrits en même temps que le premier gabarit qui les utilise.
4. Kit de frise Village, champ frise, aperçu SVG dans l'admin.
5. Littoral (kit, scènes, `theme.css`, composition).
6. Onglet Apparence, route d'aperçu, en-têtes, bande de contrôle, README.

## Section 6 : ouverture à des gabarits tiers

Objectif : qu'un EPCI, une agence ou un contributeur puisse créer un gabarit (« Montagne », « Bourg patrimonial »…) sans lire tout le code et sans pouvoir affaiblir les garanties du produit. Question posée par l'utilisateur le 25/09 (« si on ouvre le projet à des EPCI/mairies »).

**Un gabarit tiers est du code relu, jamais un téléversement.** Il entre par une contribution au dépôt (ou un fork AGPL), passe la revue et la suite de conformité, puis est déployé par l'hébergeur. ⛔ **Pas de thème téléversé depuis l'admin** : du CSS ou du HTML arbitraire peut charger des ressources tierces (traçage), casser la lisibilité (RGAA) ou introduire du script — exactement les garanties qui font la valeur du produit.

### Le contrat de gabarit (`src/gabarits/CONTRAT.md`, versionné)

Ce qu'un gabarit **reçoit** et **doit fournir**, et rien d'autre :

- **Reçoit** : les variables CSS de la section 2 (liste figée et versionnée : `--principale-sure`, `--pale`, `--profond`, `--accent`, `--accent-sur-profond`, `--texte-sur-accent`, `--terre-sure`, `--picto-1`…`6`, `--encre`, `--alerte*`, `--focus`) ; les sections communes et leurs variantes (`NomSection`, avec les données que chacune rend) ; les scènes et pièces de son propre kit ; les textes fixes via `src/i18n/`.
- **Fournit** : `gabarit.ts` (composition, polices, cadrage du héros), `theme.css`, `frise.ts` (kit + `horizon()`), `illustrations.ts` (`scene()`, `heros()` pour toutes les valeurs de `illustration`), ses polices auto-hébergées avec leur licence, un `README.md` (intention, crédits, licences), et une **maquette statique** de référence.
- **N'a pas le droit** : définir une couleur de commune en dur ; charger une ressource hors de l'origine ; ajouter un script ; toucher au schéma de données ou à un autre gabarit (I26) ; employer `--accent-sur-profond` hors texte large.
- **Version du contrat** : un numéro dans `CONTRAT.md` ; chaque gabarit déclare la version qu'il respecte ; une variable ou une section retirée = version majeure, avec une note de migration.

### La suite de conformité commune

Une seule suite, paramétrée par la liste des gabarits : **un gabarit qui la passe est techniquement recevable**, qu'il vienne du projet ou d'un tiers. La revue humaine reste nécessaire pour le goût et la maintenabilité.

- **I31 — Tout gabarit passe la suite de conformité commune avant fusion.** Elle vérifie, pour chaque gabarit :
  1. l'accueil se rend avec les données de démonstration, sections dans l'ordre de `gabarit.ts` ;
  2. **aucune URL tierce** et **aucun `<script>` ajouté** (I27 : comparaison avec le rendu d'une page intérieure) ;
  3. `theme.css` ne contient **aucune couleur littérale** hors d'une liste blanche (`#fff`, `#000`, `transparent`) et ne référence que des variables du contrat ;
  4. audit **axe sans violation** sur l'accueil ;
  5. rendu avec **trois palettes extrêmes** (jaune pur, gris moyen `#777777`, bordeaux très sombre) : contrastes du texte mesurés dans la page rendue ≥ 4,5:1 ;
  6. **commune vide** (ni photo, ni lien, ni frise) : aucun emplacement vide (I30), toutes les illustrations présentes ;
  7. chaque pièce et chaque scène du kit rend un SVG valide pour toutes les tailles ;
  8. licences présentes pour chaque police et chaque image fournie ;
  9. captures 1440 et 390 produites dans un dossier d'artefacts, **à regarder** lors de la revue.

### Ce qui est hors de ce lot

Le guide « créer un gabarit » (pas à pas, à partir d'une maquette statique comme `G-maquette-v2/` et `J-maquette-littoral/`) et un éventuel catalogue de gabarits contribués : à écrire quand un premier EPCI en aura besoin. Le contrat et la suite sont faits **maintenant**, parce qu'ils coûtent peu au moment d'écrire les deux premiers gabarits et beaucoup après.

## Points non vérifiés

- Le seuil ΔE d'harmonie (0,08) est une valeur de départ, à étalonner.
- Régénération des tailles d'image pour les médias existants : mécanisme à établir.
- Calendrier de fusion d'`umami-collecte` et de `multilingue-socle` : inconnu de cette spec ; les étapes 2 à 6 en dépendent.

## Relecture contre le code (25/09) et résolution

Relecture faite par une session séparée sur `gabarits-couleurs` (dfd381b), les branches `multilingue-socle` et `umami-collecte`, et `G-maquette-v2/` ; tranchée avec l'utilisateur le 25/09.

| Constat | Résolution | Où |
|---|---|---|
| I27 « sans `<script>` » faux (Next.js, mesure d'audience) | reformulé : un gabarit n'ajoute ni script ni ressource tierce | § 3, § 5 |
| Aperçu impossible sur le domaine de la commune (pas de session) | aperçu sous le domaine de l'admin, hors `(frontend)`, commune en paramètre contrôlée par rôle | § 4, I28 |
| COEP / `frame-ancestors` / en-têtes posés par un composant | iframe same-origin ; exception `headers()` sur `/apercu/:path*`, testée | § 4 |
| `Communes` sans versions | versions activées (utilisateur) | § 1 |
| Démarches / mosaïque / abonnement sans données | groupe `accueil` prérempli et éditable ; illustration du kit si pas de photo (utilisateur) ; inscription aux alertes hors périmètre | § 1, § 3, I30 |
| Page `accueil` à blocs | conservée, rendue en section texte libre (utilisateur) | § 3 |
| `photoAccueil` hors I4 | `validerRelationsTenant` | § 1 |
| Défaut « terre » et avertissement d'harmonie sur défauts | défauts dans `couleurs.ts`, accent distinct, avertissement sur saisies seulement | § 1, § 2 |
| Anciens noms de variables CSS | alias | § 2 |
| Textes fixes et `[lang]` | dictionnaires `src/i18n/` ; aperçu hors `[lang]` avec paramètre | § 3, § 4 |
| Aperçu partiel (photo, frise) | assumé et dit dans l'interface | § 4 |
| `piece` en `select` | `text` validé au rendu | § 1 |
| `--accent-sur-profond` hors texte large | restriction écrite | § 2 |
| Un seul cadrage d'image | deux tailles ajoutées ; régénération à établir | § 3 |
| README RGAA | réécriture à l'étape 6 | § 5 |
| Dépendances de test absentes | `fast-check`, `@axe-core/playwright` | § 5 |
| Chemins de la recherche hors du worktree | précisé | Contexte |
| Branche de base | étapes 0-1 maintenant, 2-6 après les deux fusions (utilisateur) | § 5 |
