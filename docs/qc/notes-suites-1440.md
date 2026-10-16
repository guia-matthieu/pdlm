# Suites 1440 — courriel mairie, © du pied, test I30

Brief : `~/Projects/guia/tasks/2026-10-16_brief-glm-suites-1440.md`.
Branche `gabarits-suites-1440`, partie de `main` à `c6c03a7` (mosaïque 390
fusionnée). Trois corrections courtes, sans plan. Ces notes se complètent à
chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `gabarits-conformite.e2e.spec.ts` l. 346 : test 6 « commune vide » | l. 346-429 ; vide `coordonnees` (l. 352) mais pas `horaires` ; `origine` (l. 140-173) ne relit pas `horaires` | ✅ |
| `src/gabarits/Accueil.tsx` l. 74 : carte mairie si `telephone \|\| adresse \|\| email \|\| identite.horaires` | l. 74 exactement | ✅ |
| `docs/qc/notes-littoral-390.md` l. 189-207 : incident I30 résidu d'horaires | l. 189-207 : résidu `communes_locales` id 596, « le test I30 vide les coordonnées mais pas les horaires » | ✅ |
| `notes-littoral-390.md` l. 48-52 et l. 113 : courriel 3 lignes à 1440, casette 255,8 px | l. 48-52 (1440 : casettes 111 / 216 / 579,3 / 261,8 / **255,8**, courriel **3 lignes**) ; l. 113 (390 après correction : adresse 2 lignes, etc.) | ✅ |
| `src/gabarits/sections/Mairie.tsx` l. 48-50 : rendu du courriel | l. 48-52 : `<a href={`mailto:${coordonnees.email}`}>{coordonnees.email}</a>` | ✅ |
| `littoral/theme.css` l. 366 : `white-space: nowrap` du téléphone | l. 362-368 : `.mairie__tel { … white-space: nowrap; … }` | ✅ |
| `notes-tache-10.md` l. 98 : © village 1440 à x=23, colonnes à x=59 | l. 98 : « **© décalé à gauche, village 1440 seulement** : “© 2026 …” commence à x=23 quand les colonnes du pied commencent à x=59 » | ✅ |
| `village/theme.css` l. 666 `.pied-page__colonnes`, l. 693 `.pied-page__mentions`, rupture l. 848 | l. 666-671 (max-width var(--largeur), padding 3rem 1.25rem 2rem), l. 693-700 (margin 0 auto, padding 1rem 1.25rem 1.6rem), l. 848 (`.pied-page__colonnes { grid-template-columns: 1fr }` dans le bloc 860 px) | ✅ |
| `payload.config.ts` l. 58-61 et 107 : CSRF | l. 56-60 : `http://localhost:3000` admis en dev seulement ; l. 107 : `csrf: originesAutorisees` | ✅ |
| `gabarits-captures.e2e.spec.ts` l. 300-340 (`habiller`) et l. 405-415 (remise en état) | l. 299-321 `habiller` ; beforeAll pose `coordonnees` + `horaires` (l. 350-354) ; afterAll restaure `horaires: origine.horaires ?? null` (l. 411) | ✅ |

CSS utile repéré en lisant : la base partagée `src/app/(frontend)/styles.css`
pose `.pied-page__colonnes` (l. 426 : `max-width: 72rem; margin: 0 auto`) et
`.pied-page__mentions` (l. 453 : `max-width: 72rem; margin: 2rem auto 0`) ;
le village surmodule les deux (max-width `--largeur` = 76 rem, l. 30 ; le
`margin: 0 auto` des colonnes vient de la base). Le littoral, lui, met
`max-width: none; margin: 0` partout avec `padding: … var(--gouttiere)`
(l. 838-844 et 882-889) — d'où son alignement aux deux largeurs.

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets` → minio healthy, createbuckets started.
- Serveur de développement sur le **port 3000** (CSRF : `payload.config.ts`
  l. 60 n'admet que `http://localhost:3000` en dev), lancé par cette session,
  arrêté à la fin. Playwright le réutilise (`E2E_PORT=3000`).
- Aucune migration, aucun champ Payload touché. `.env` du worktree non lu.

## Tâche A — test I30 : vider aussi les horaires

### Incident rencontré avant la preuve (données de dev, pas le code)

Première relance du test 6 sur l'ancienne version : rouge, mais pour **deux**
raisons mêlées — `mairie` en trop **et** `agenda` absent. Mesure par spec
Playwright jetable (`zz-suite1440.tmp.spec.ts`, supprimé en fin de session),
GET `/api/evenements` authentifié :

    MAINTENANT : 2026-10-16T14:41:11Z
    EVT Conseil municipal (séance publique) | debut=2026-10-16T09:22:35Z fin=2026-10-16T11:22:35Z | PASSE
    EVT Marché de printemps           | debut=2026-10-09T09:22:35Z fin=2026-10-09T15:22:35Z | PASSE

Les deux événements de démonstration de `saint-ex` avaient expiré **ce matin**
(leur horodatage 09:22:35 montre un amorçage relatif à la date du jour ;
`src/lib/contenu.ts` l. 90-91 : l'agenda ne rend que `dateFin >= now`). La
section `agenda` disparaissait donc, sur l'ancienne version comme sur la
nouvelle — indépendamment des horaires. Correctif de données : PATCH
authentifié des deux `dateDebut`/`dateFin` à +7 jours (Marché décalé deux
fois, il aurait expiré en cours de session) :

    Conseil municipal : 2026-10-16T09:22Z → 2026-10-16T11:22Z  ⇒  2026-10-23T09:22Z → 2026-10-23T11:22Z
    Marché de printemps : 2026-10-09T09:22Z → 2026-10-09T15:22Z  ⇒  2026-10-16T09:22Z → 2026-10-16T15:22Z  ⇒  2026-10-23T09:22Z → 2026-10-23T15:22Z

C'est la précondition que le spec suppose (le beforeAll ne crée pas
d'événements) ; le relecteur qui relance après le 23/10 devra re-décaler ou
réamorcer.

### Modification

`tests/e2e/gabarits-conformite.e2e.spec.ts`, test 6 seul (l. 348) :
`horaires: null` dans le PATCH qui vide (avec commentaire I30), et
`horaires: origine.horaires ?? null` dans la remise en état du `finally`,
comme les coordonnées. `origine` (l. 141-174) relit et type `horaires` en
conséquence. Aucun autre test, aucun fichier de `src/`.

### Preuve (rouge ancien / vert nouveau / base remise)

Résidu posé par PATCH authentifié (spec jetable) : horaires de `saint-ex`
`null` → `"Résidu de test : lundi 9 h – 12 h."` (vérifié par GET).

Ancien test (posé via `git show c6c03a7:tests/e2e/gabarits-conformite.e2e.spec.ts`)
— **rouge**, village et littoral, pour la seule raison attendue :

    - Expected  - 0
    + Received  + 1
      Array [
        "heros",
    +   "mairie",
        "actualites",
        "agenda",
        "mosaique",
      ]
    2 failed

Nouveau test (fichier de travail restauré) — **vert**, résidu toujours en
base :

    ✓ village › 6 — commune vide : aucun emplacement vide (I30) (1.1s)
    ✓ littoral › 6 — commune vide : aucun emplacement vide (I30) (1.1s)
    2 passed (8.0s)

Base remise en état : GET après le run nouveau → `"Résidu de test : lundi
9 h – 12 h."` (la remise en état du test a bien réécrit les horaires lues au
beforeAll, preuve qu'elles sont capturées et restaurées), puis PATCH `null`
→ GET `null` = état trouvé au départ.

## Tâche B — le courriel ne se coupe qu'après l'arobase

### Mesure avant (code de `c6c03a7`)

Spec jetable (`zz-suite1440.tmp.spec.ts`, réécrit pour B) : commune `saint-ex`
composée comme le spec de captures (gabarit + coordonnées + horaires), mesure
de `.section-mairie` à 390/700/701/1440, remise en état. Lignes réelles du
texte = caractères groupés par le haut de leur rectangle de portée (un Range
par caractère).

| Gabarit @viewport | Lignes du courriel | Casettes (l, px) | scrollWidth |
| --- | --- | --- | --- |
| littoral 390 | **1** | toutes 347,5 | 390 |
| littoral 700 | **1** | toutes 657,5 | 700 |
| littoral 701 | **1** | 370,5 / 254 / 370,5 / 254 / 370,5 | 701 |
| littoral 1440 | **1** | 111 / 216 / 579,3 / 261,8 / **255,8** | 1440 |
| village (4 largeurs) | **1** | 314,4 (390/700/701) ; 370,8 (1440) | = viewport |

**Écart avec `notes-littoral-390.md` l. 48-52** (courriel 4/2/3 lignes, casette
1440 = 255,8) : non reproduit sur le code de `c6c03a7`, polices chargées
(`document.fonts.check('17px "Public Sans"')` = true). Sonde dédiée à 1440 :
le lien, son texte (Range `selectNodeContents`) et la casette font tous
**255,8 px** — hors rupture la rive est `flex` (`theme.css` l. 326) et la
casette épouse son contenu : l'email tient sur une ligne, pile. Hypothèse
(non mesurable rétroactivement) sur les 3 lignes d'alors : mesure prise avant
le chargement des polices (fallback Georgia, plus large, `font-display:
swap`) ; la casette 255,8 d'alors reste inexpliquée pour nous, le CSS 1440
n'a pas bougé depuis `ff93390`.

Le repli aux traits d'union reste le comportement dès que la casette est plus
étroite que le texte (village en carte, colonne 254 du littoral, police de
repli) : la décision du brief s'applique. Preuve complémentaire par un
courriel long (`secretariat.mairie@commune-saint-exupery-sur-mer.fr`),
mesuré **après** correction (§ mesure après) ; le « avant » de ce cas long
sera le rouge du test neuf (§ Test).

### Correction

- `src/gabarits/sections/Mairie.tsx` : le lien porte `mairie__courriel` et
  rend `<span>{locale + '@'}</span><wbr /><span>{domaine}</span>`
  (`lastIndexOf('@')` ; champ de type `email`, l'arobase est garantie par
  la validation Payload — `src/collections/Communes.ts` l. 354). Un seul
  `mailto:`, même adresse, aucun texte ajouté.
- `littoral/theme.css` et `village/theme.css` : une règle chacun, à côté du
  téléphone : `.mairie__courriel span { white-space: nowrap }`.

### Mesure après (même spec, mêmes points)

Courriel de capture (« mairie@saint-exupery-sur-mer.fr » / « …les-bains.fr ») :

| Gabarit @viewport | Lignes | Casettes | scrollWidth |
| --- | --- | --- | --- |
| littoral 390/700/701 | 1 | identiques à avant (347,5 / 657,5 / 370,5-254) | = viewport |
| littoral 1440 | 1 | 111 / 216 / 579,3 / 261,8 / **255,9** (avant 255,8, écart 0,1 px) | 1440 |
| village 390/700/701/1440 | 1 | identiques à avant | = viewport |

Courriel long (force le repli) :

| Gabarit @viewport | Lignes | Texte réel | scrollWidth |
| --- | --- | --- | --- |
| littoral 390 | 2 | `["secretariat.mairie@", "commune-saint-exupery-sur-mer.fr"]` | 390 |
| littoral 700 | 1 | tient en une ligne (casette 657,5) | 700 |
| littoral 701 | 2 | idem 390 | 701 |
| littoral 1440 | 2 | idem (casette 374, base plafonnée à 22rem l. 384-386) | 1440 |
| village 390 | 2 | idem | 390 |
| village 700/701 | 1 | tient (624/625,4) | = viewport |
| village 1440 | 2 | idem 390 | 1440 |

Le `<wbr>` donne bien son occasion de coupure ici : chaque fois que le
courriel ne tient pas, il fait **exactement 2 lignes**, la première se
termine par `@` (spans de 152,4 puis 277,2 px littoral, jamais coupés
eux-mêmes), et le domaine ne déborde jamais (`scrollWidth` = viewport
partout). `littoral-mairie-390` repassé vert après correction (3 passed).

## Journal

- (premier commit) — squelette de ces notes (ancres vérifiées, cadre).
- `8827b66` — tâche A : test 6 vide et restaure `horaires` ; preuve
  rouge/vert ; incident données démo (événements expirés) mesuré et corrigé
  en base.
- (ce commit) — tâche B : mesure avant (écart avec notes-littoral-390
  documenté), correction `Mairie.tsx` + une règle par thème, mesure après
  (standard 1 ligne, long 2 lignes coupées après `@`, casettes ±0,1 px).


