# Démo tiret — événements des specs, plages horaires insécables

Brief : `~/Projects/guia/tasks/2026-10-17_brief-glm-demo-tiret.md`.
Branche `gabarits-demo-tiret`, partie de `main` à `651e31f`. Deux corrections
courtes, sans plan. Ces notes se complètent à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `src/seed/contenu-demo.ts` l. 234-274 : événements créés à la date de l'amorçage | l. 233-261 : `Marché de printemps` (+5 J) et `Conseil municipal (séance publique)` (+12 J), créés seulement si la collection est vide | ✅ |
| `src/lib/contenu.ts` l. 90-91 : agenda = événements `dateFin >= now` | l. 90-99 `evenementsCommune` avec `filtreEvenementAVenir()` (`src/lib/dates.ts` l. 22-24 : `dateFin >= now`) | ✅ |
| `Mairie.tsx` l. 34-41 et `PiedDePage.tsx` l. 43-46 : les deux affichages des horaires | `Mairie.tsx` l. 38 `{horaires.texte}` dans un `<span lang>` ; `PiedDePage.tsx` l. 46 idem — grep `src/` : ce sont les deux seuls endroits qui rendent `horaires.texte` | ✅ |
| Specs créant ou lisant `evenements` | `gabarits-conformite` (l. 269 rendu des sections, l. 404 test 6 — **aucune création** : dépend des événements de démo) ; `gabarits-captures` (l. 283 création +12/+25/+33 J, l. 373 nettoyage par titre) ; `littoral-captures` (l. 32, +12 à +33 J) ; `village-captures` (l. 23) ; `frontend` (l. 30 : visite `/agenda`, sans exiger d'événement) | ✅ |

Repérages complémentaires (grep, une fois) :

- Les trois specs de captures créent déjà leurs événements datés de
  `Date.now()` et les suppriment par titre dans `nettoyer()` (appelé en
  beforeAll et afterAll) — mais la suppression n'est pas vérifiée par GET.
- `suites-1440.e2e.spec.ts` : `api`/`json` locaux (l. 52-68),
  `lignesCourriel` mesure les lignes par Range par caractère (l. 91-123),
  `HORAIRES` de démo posée par PATCH en beforeAll (l. 158-162) — le fichier
  n'exige aucun événement.

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets`. Serveur de développement sur le **port 3000**, lancé par
  cette session, arrêté à la fin.
- `.env` du worktree non lu, aucune migration, aucun champ Payload touché.
- Toute écriture en base (événements de démo décalés pour la preuve) est
  remise en état, vérifiée par GET.

## Journal

- e8e6f5d — squelette de ces notes (ancres vérifiées, cadre).
- df882ea — tâche A : helper `evenements`, `gabarits-conformite` crée et
  supprime ses événements, les trois suites de captures passent par le même
  helper (suppression vérifiée 404).
- 66bff4d — tâche B : `horairesInsecables` (insécables + lieur après le
  tiret), appliquée aux deux affichages des horaires ; 8 tests unitaires.
- (ce commit) — tâche C : 8 tests e2e dans suites-1440 (carte mairie et
  pied, village et littoral, 390 et 1440 px) — rouges sur les composants de
  651e31f, verts ensuite.

## Tâche A — les specs ne dépendent plus de l'amorçage

### Ce qui a changé

- `tests/helpers/evenements.ts` (nouveau) : `creerEvenements` (POST datés de
  `Date.now() + jours`, fin à +3 h, `lieu` posé) et `supprimerEvenements`
  (recherche par titre `draft=true&limit=100`, DELETE puis GET dont le 404 est
  exigé) — appelés depuis le navigateur comme les `api()` des specs (cookie de
  session + CSRF).
- `gabarits-conformite.e2e.spec.ts` : le `beforeAll` retire un éventuel résidu
  d'un passage interrompu puis crée deux événements (+3 et +10 J, titres
  « (suite conformité) ») ; l'`afterAll` les supprime (GET 404 vérifié).
- `littoral-captures`, `village-captures`, `gabarits-captures` : leur boucle de
  création devient `creerEvenements(...)` ; le filtre `evenements` de
  `nettoyer()` devient `supprimerEvenements(...)` (suppression maintenant
  vérifiée par GET 404) ; `crees.evenements` (poussé, jamais lu) disparaît.
  Le seed (`src/seed/contenu-demo.ts`) et `src/lib/contenu.ts` ne bougent pas.

### Preuve (sorties réelles, base de dév du worktree)

1. Lecture avant touche (spec jetable, GET authentifié) — dates d'origine
   notées :

   ```
   EVT 1 Marché de printemps | debut=2026-10-23T09:22:35.379Z fin=2026-10-23T15:22:35.379Z | AVENIR
   EVT 2 Conseil municipal (séance publique) | debut=2026-10-23T09:22:35.383Z fin=2026-10-23T11:22:35.383Z | AVENIR
   ```

2. PATCH authentifié des deux événements de démo à -40/-39 J (`PATCHES AU
   PASSE (-40/-39 J)`), puis `gabarits-conformite` **sans création
   d'événements** (état du fichier avant ce changement) :

   ```
     2 failed
       [chromium] › tests/e2e/gabarits-conformite.e2e.spec.ts:242:5 › Suite de conformité — village › 1 et 2 — accueil 200, sections dans l’ordre du gabarit, rien hors de l’origine, aucun script ajouté
       [chromium] › tests/e2e/gabarits-conformite.e2e.spec.ts:242:5 › Suite de conformité — littoral › 1 et 2 — accueil 200, sections dans l’ordre du gabarit, rien hors de l’origine, aucun script ajouté
     12 did not run
   ```

   Échec sur `expect(rendues).toEqual(gabarit.accueil.map((s) => s.section))`
   (l. 266 du fichier d'alors) : sans événement à venir, la section `agenda`
   ne rend plus — la dépendance à l'amorçage que la tâche vise.

3. Même base, événements de démo toujours au passé, `gabarits-conformite`
   **avec la création par la spec** :

   ```
     14 passed (26.4s)
   ```

4. Aucun résidu de test en base (GET, toute la collection, `draft=true`) :

   ```
   EVENEMENTS EN BASE : 2
     2 Conseil municipal (séance publique)
     1 Marché de printemps
   ```

5. Dates d'origine rétablies par PATCH, vérifiées par GET :

   ```
   EVT 1 Marché de printemps | debut=2026-10-23T09:22:35.379Z fin=2026-10-23T15:22:35.379Z | AVENIR
   EVT 2 Conseil municipal (séance publique) | debut=2026-10-23T09:22:35.383Z fin=2026-10-23T11:22:35.383Z | AVENIR
   ```


## Tâche B — une plage horaire ne se coupe plus en deux

### Ce qui a changé

- `src/lib/horaires.ts` (nouveau) : `horairesInsecables(texte)`, fonction
  pure. Une plage « nombre + h + tiret + nombre + h » est reconnue par

  ```
  HEURE = /\d+[ \u00A0]?h\b(?:[ \u00A0]?\d{1,2}(?!\d))?/    (\b exclut « heures »)
  PLAGE = HEURE [ \u00A0]? [–—-] [ \u00A0]? HEURE
  ```

  Dans chaque plage reconnue, les espaces internes deviennent des
  insécables (U+00A0) — entre le nombre et le « h », autour du tiret — puis
  un lieur de mots (U+2060) est posé après le tiret :

  ```
  return texte.replace(PLAGE, (plage) =>
    plage.replace(/ /g, '\u00A0').replace(/([–—-])\u00A0/g, '$1\u2060\u00A0'),
  )
  ```

  Une plage sans espace interne (« 9h-12h ») ressort inchangée. Idempotent :
  une fois traité, le texte ne correspond plus à PLAGE (la classe
  `[ \u00A0]?` ne franchit pas le lieur), le rejouer ne change rien.
- `src/gabarits/sections/Mairie.tsx` et `src/components/PiedDePage.tsx` : le
  `<span>` des horaires rend `horairesInsecables(horaires.texte)` — les
  deux seuls endroits qui affichent les horaires (ancres du tableau de
  départ). La donnée en base ne bouge pas : transformation à l'affichage
  seulement.
- `tests/unit/horaires.spec.ts` (nouveau) : 8 tests — formes courantes
  (« 9 h – 12 h », « 9 h 30 – 12 h », « 14 h — 17 h », « 9 h - 12 h »),
  « 9h-12h » inchangé, phrase complète (ponctuation sécable préservée),
  « 2 heures » non reconnu comme heure, texte sans plage, texte vide,
  texte rendu ne différant que par les espaces, idempotence.

### Mesure avant (code de 651e31f)

Spec jetable `zz-mesure-horaires.tmp.spec.ts` : horaires et coordonnées
posées par PATCH, lignes réelles du bloc mesurées par Range par caractère
(même méthode que `lignesCourriel` de suites-1440), gabarits village et
littoral à 390 et 1440 px, carte mairie et pied ; état remis en fin.
Sorties brutes — **6 casettes sur 8 coupent une plage** (les 2 autres
coupent à la virgule entre deux plages, ce qui est légitime) :

```
=== village 390 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 ","h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 390)
pied : ["Lundi, mardi, jeudi, vendredi : 9 ","h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 390)
=== village 1440 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 ","h, 14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 1440)
pied : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, ","14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 1440)
=== littoral 390 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, ","14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 390)
pied : ["Lundi, mardi, jeudi, vendredi : 9 h ","– 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 390)
=== littoral 1440 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h ","– 17 h. Mercredi : 9 h – 12 h."] (scrollWidth 1440)
pied : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 ","h. Mercredi : 9 h – 12 h."] (scrollWidth 1440)
```

Coupures fautives : le nombre séparé de son « h » (4 fois — village 390
carte et pied, village 1440 carte, littoral 1440 pied) ; ligne commençant
par le tiret (2 fois — littoral 390 pied, littoral 1440 carte).

### L'insécable seule ne suffisait pas (mesure intermédiaire)

Version n'insérant que les insécables, sans lieur : **3 casettes sur 8
coupent encore**, toutes entre le tiret et l'insécable qui suit (espaces
internes notés ici comme des espaces simples, indiscernables dans la
console) :

```
village 390 carte  : ["Lundi, mardi, jeudi, vendredi : ","9 h – 12 h, 14 h – 17 h. Mercredi : 9 h –"," 12 h."]
village 1440 carte : ["Lundi, mardi, jeudi, vendredi : 9 h –"," 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
littoral 1440 pied : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h –"," 17 h. Mercredi : 9 h – 12 h."]
```

(les 5 autres casettes étaient déjà propres ; scrollWidth ≤ largeur partout)

Cause, par sonde navigateur (spec jetable `zz-sonde-tiret.tmp.spec.ts` :
div de 100 px, mêmes Range par caractère ; `\u2060` = lieur U+2060,
invisible) :

```
"nbSeul":    ["xxxxx 9 h –", " 12 h"]       ← insécables seules : coupe après le tiret
"nbPlusWj":  ["xxxxx ", "9 h –\u2060 12 h"]  ← lieur après le tiret : plage soudée
"emNb":      ["xxxxx ", "14 h — 17 h"]      ← tiret cadratin : déjà soudé sans lieur
"compact":   ["xxxxx 9h-12h"]               ← tenait sur une ligne : sans conclusion
"compactWj": ["xxxxx 9h-\u206012h"]
"emWj":      ["xxxxx ", "14 h —\u2060 17 h"]
```

C'est la règle LB12a de la coupure de ligne Unicode (UAX #14) —
`[^SP BA HY] × GL` : l'interdiction de couper avant une insécable (GL) ne
s'applique pas après un tiret demi-cadratin (BA) ni après un trait
d'union (HY). Le CSS est hors de cause : `overflow-wrap: anywhere` ne vise
que le titre du héros village (`src/gabarits/village/theme.css:247`,
`src/gabarits/village/maquette/theme.css:250`), et le littoral n'en a
aucun alors que son pied coupe.

### Écart au texte du brief (documenté)

Le brief prescrit de « remplacer les espaces internes d'une plage par des
insécables » et de « ne toucher à rien d'autre ». Mesuré ci-dessus :
l'insécable seule laisse la plage coupée en deux dans 3 casettes sur 8,
précisément après le tiret. Écart ajouté pour tenir l'exigence même du
brief (« ne se coupe pas en deux ») : un lieur de mots U+2060, invisible
et de largeur nulle, posé après le tiret à l'intérieur de la seule plage
reconnue. Il n'ajoute aucun espace : le texte rendu ne diffère toujours
que par les espaces.

### Après correction

Même mesure, mêmes 8 casettes — **aucune plage coupée** : chaque coupure
tombe après une plage achevée (deux-points ou virgule sécables) ;
`scrollWidth` = largeur partout. Notation : `–\u2060` = tiret + lieur
(U+2060, invisible) ; les autres espaces internes des plages sont des
insécables (U+00A0), rendues par la console comme des espaces simples :

```
=== village 390 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : ","9 h –\u2060 12 h, 14 h –\u2060 17 h. Mercredi : ","9 h –\u2060 12 h."] (scrollWidth 390)
pied : ["Lundi, mardi, jeudi, vendredi : ","9 h –\u2060 12 h, 14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 390)
=== village 1440 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : ","9 h –\u2060 12 h, 14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 1440)
pied : ["Lundi, mardi, jeudi, vendredi : 9 h –\u2060 12 h, ","14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 1440)
=== littoral 390 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 h –\u2060 12 h, ","14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 390)
pied : ["Lundi, mardi, jeudi, vendredi : ","9 h –\u2060 12 h, 14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 390)
=== littoral 1440 px ===
carte mairie : ["Lundi, mardi, jeudi, vendredi : 9 h –\u2060 12 h, ","14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 1440)
pied : ["Lundi, mardi, jeudi, vendredi : 9 h –\u2060 12 h, ","14 h –\u2060 17 h. Mercredi : 9 h –\u2060 12 h."] (scrollWidth 1440)
```

### Tests unitaires, types, lint

```
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

`tsc --noEmit` : rien ; `eslint` sur les quatre fichiers touchés : rien.

## Tâche C — tests e2e : aucune plage coupée

### Ce qui a changé

`tests/e2e/suites-1440.e2e.spec.ts` :

- `lignesHoraires(page, conteneur)` : lignes réelles du bloc horaires —
  mêmes Range par caractère que `lignesCourriel`, sur le `<span>` des
  horaires du bloc (`p:has(strong) span` du conteneur, carte mairie ou
  pied).
- `PLAGE_HORAIRE` : la plage « nombre + h + tiret + nombre + h ».
- `attenduHoraires(lignes, scrollWidth, largeur)` : la page ne déborde
  pas ; le texte rendu, normalisé (insécables redevenant des espaces,
  lieurs retirés), est la phrase entière ; **aucune borne de coupure ne
  tombe strictement à l'intérieur d'une plage** ; aucune ligne ne
  commence par un tiret.
- 8 tests dans la boucle existante des largeurs : carte mairie et pied,
  village et littoral, 390 et 1440 px. Le test de carte repose les
  coordonnées (les tests courriel précédents laissent le courriel long).

Pourquoi des bornes plutôt que « la plage figure entière dans une
ligne » : la fixture répète une plage (« 9 h – 12 h » y figure deux
fois). La première version du test exigeait que chaque plage apparaisse
entière dans une ligne — mesurée trop faible sur le code de 651e31f :
la carte village 390 px, qui coupe « … : 9 | h – 12 h… », passait, car
la même plage, intacte, figure plus loin dans la même ligne
(« Mercredi : 9 h – 12 h. »). La borne de coupure ne trompe pas : une
coupure est fautive si et seulement si elle tombe strictement à
l'intérieur d'une plage de la phrase complète.

### Rouge avant (composants de 651e31f reposés, puis git checkout --)

Le mode série saute les tests qui suivent un échec : quatre passages
filtrés couvrent les 8 casettes. (Piège de filtrage : `--grep-invert
1440` exclut aussi le nom de fichier suites-1440 — inverser sur le
fragment de titre « à 1440 px ».)

Run A — `E2E_PORT=3000 npx playwright test suites-1440 -g "horaires"` :

```
  ✘ village 390 px, horaires de la carte mairie
  ✓ littoral 390 px, horaires de la carte mairie
  ✘ littoral 390 px, horaires du pied
  2 failed, 1 passed (12.1s)
    Error: la coupure 1 tombe dans la plage « 9 h – 12 h » : ["Lundi, mardi, jeudi, vendredi : 9 ","h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
    Error: la coupure 1 tombe dans la plage « 9 h – 12 h » : ["Lundi, mardi, jeudi, vendredi : 9 h ","– 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
```

Run B — idem `--grep-invert "à 390 px"` :

```
  ✘ village 1440 px, horaires de la carte mairie
  ✘ littoral 1440 px, horaires de la carte mairie
  2 failed
    Error: la coupure 1 tombe dans la plage « 9 h – 12 h » : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 ","h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
    Error: la coupure 1 tombe dans la plage « 14 h – 17 h » : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h ","– 17 h. Mercredi : 9 h – 12 h."]
```

Run C — `-g "horaires du pied" --grep-invert "à 390 px"` :

```
  ✓ village 1440 px, horaires du pied
  ✘ littoral 1440 px, horaires du pied
  1 failed, 1 passed (8.6s)
    Error: la coupure 1 tombe dans la plage « 14 h – 17 h » : ["Lundi, mardi, jeudi, vendredi : 9 h – 12 h, 14 h – 17 ","h. Mercredi : 9 h – 12 h."]
```

Run D — `-g "horaires du pied" --grep-invert "à 1440 px"` :

```
  ✘ village 390 px, horaires du pied
  ✘ littoral 390 px, horaires du pied
  2 failed
    Error: la coupure 1 tombe dans la plage « 9 h – 12 h » : ["Lundi, mardi, jeudi, vendredi : 9 ","h – 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
    Error: la coupure 1 tombe dans la plage « 9 h – 12 h » : ["Lundi, mardi, jeudi, vendredi : 9 h ","– 12 h, 14 h – 17 h. Mercredi : 9 h – 12 h."]
```

Bilan : **6 casettes rouges sur 8** — exactement les 6 fautives de la
mesure avant (tâche B). Les 2 casettes vertes avant correction (village
1440 pied, littoral 390 carte) coupent à la virgule entre deux plages :
coupure légitime, rien à y corriger — leur test est vert avant et après.

### Vert après (composants restaurés)

`E2E_PORT=3000 npx playwright test suites-1440` :

```
  24 passed (26.9s)
```

`tsc --noEmit` : rien ; `eslint` sur le spec : rien.
