# Notes — RPNT lot 2 : code INSEE et nomenclature des domaines

Brief : `~/Projects/guia/tasks/2026-10-21_brief-glm-rpnt-lot2-insee-nomenclature.md`.
Spec : `docs/superpowers/specs/2026-10-01-conformite-rpnt-design.md`, sections 1 et 2
UNIQUEMENT (c'est le lot 2). Ces notes servent de point de reprise : chaque étape y
consigne ce qui est fait, les sorties réelles des commandes et les pièges rencontrés.

## Étape 1 — champ `codeInsee` sur Communes (+ migration, + types)

Décisions appliquées (du brief, non rouvertes) :

- Champ texte facultatif de haut niveau, posé après le groupe `coordonnees`
  (le code postal reste dans `coordonnees.codePostal`, intact).
- Validation serveur, style `validerCodeInsee` calqué sur `validerCouleur` :
  vide accepté, sinon `5 chiffres` ou `2A`/`2B` + 3 chiffres (Corse).
  Message d'erreur en français.
- `unique: true, index: true` comme le slug : unicité SEULEMENT quand le champ
  est rempli (Postgres autorise plusieurs NULL dans un index unique).
- Description : « Code INSEE, pas le code postal (Quimper : 29232, pas 29000) »
  + renvoi vers l'API Découpage administratif `geo.api.gouv.fr/communes`.
  Aucun appel réseau, aucun téléchargement fait par pdlm.
- Pas d'`access` au niveau du champ : l'accès `update` de la collection
  (`Communes.ts`) limite déjà aux opérateurs + admins de la commune ; rédacteur
  et mandataire prennent un 403 pour toute la fiche (couvert par
  `communes-apparence.int.spec.ts` et `mandataire-i36`, le test ci-dessous
  re-prouve le rédacteur sur `codeInsee` précisément).
- Le champ n'entre PAS dans le contrôle I6 : on peut activer une commune sans
  code INSEE (test dédié).

Tests (`tests/int/communes-code-insee.int.spec.ts`, motif copié de
`communes-apparence.int.spec.ts`) :

1. **Rouge avant code** (`npm run test:int -- communes-code-insee`) : Payload
   ignore alors le champ inconnu, `c.codeInsee` vaut `undefined` → échecs sur
   formats acceptés, formats refusés (aucune erreur levée), unicité (aucune
   contrainte) et écritures admin/opérateur. Le 403 rédacteur et l'activation
   sans code passent déjà (déjà garantis par l'existant) — attendu.
2. Ajout du champ dans `src/collections/Communes.ts`.
3. `npm run payload migrate:create rpnt_lot2_code_insee` → une migration
   (colonne `code_insee` sur `communes` ET `_communes_v`, index unique sur la
   seule table vivante — même forme que `gabarits_couleurs` pour `slug`).
4. `npm run generate:types` → `src/payload-types.ts` régénéré, commité avec.
5. Application sur la base de dev du worktree + aller-retour
   (`migrate:down` puis `migrate`) prouvé ci-dessous.
6. Vert.

Aller-retour de la migration (sorties réelles, base de dev du worktree) :

```
$ npm run payload -- migrate:status
    20261012_075826_tailles_heros_panorama │ 1 │ Yes
    20261021_150512_rpnt_lot2_code_insee   │   │ No     ← en attente
$ npm run payload -- migrate            → Migrating/Migrated: 20261021_150512_rpnt_lot2_code_insee (9ms), Done.
$ psql … information_schema.columns WHERE table_name='communes' AND column_name='code_insee'
  → code_insee                                     ← colonne présente
$ npm run payload -- migrate:down       → Migrated down: 20261021_150512_rpnt_lot2_code_insee (6ms), Done.
$ psql (même requête)                   → 0        ← colonne absente
$ npm run payload -- migrate            → Migrated: 20261021_150512_rpnt_lot2_code_insee (8ms), Done.
$ psql (même requête)                   → 1        ← colonne revenue
$ psql "SELECT count(*) FROM communes / domaines"  → 2 / 5   ← le seed a survécu à l'aller-retour
```

`migrate` et `migrate:down` posent une question interactive (« data loss will
occur… (y/N) ») dès que la base contient des données : répondu `y` par stdin
piping (`printf 'y\n' | …`), jamais `--force-accept-warning` (ignoré pour ce
prompt-là).

Tests, rouge puis vert :

```
rouge : Tests  5 failed | 1 passed (6)   ← champ inconnu : Payload l'ignore
        (seul le 403 rédacteur passe déjà : accès collection préexistant)
vert  : Tests  6 passed (6)
```

### Environnement du worktree (à savoir pour rejouer)

Le worktree était neuf : **pas de `.env`** (le brief interdit d'y toucher).
Aucun fichier `.env` n'a donc été créé — toutes les commandes reçoivent leur
environnement inline (`env DATABASE_URI=… PAYLOAD_SECRET=… S3_…=…`). Le secret
de session est jetable (`openssl rand -hex 32`, local au conteneur de dev) ;
les valeurs S3 viennent de `docker-compose.dev.yml`/`.env.example`. Bases
dédiées au worktree dans le conteneur partagé `pdlm-postgres-1`, motif des
branches précédentes (`pdlm_gabarits_dev`, `pdlm_mandats_dev`) :

- `pdlm_rpnt_dev` — dev/e2e : 13 migrations puis `npm run seed`
  (Saint-Exupéry-les-Bains + Valvert, comptes démo).
- `pdlm_rpnt_test` — int : 13 migrations (une seule fois, cf. piège 2).

Pièges rencontrés (pour la revue) :

1. **`migrate:create` diff contre le dernier snapshot `.json`, pas contre la
   base.** Un premier `migrate:create` lancé SANS l'env S3 a produit un
   `DROP COLUMN media.prefix/_objectkey` parasite et laissé un snapshot
   orphan ; le second, lancé avec, ne voyait plus le champ. Nettoyage des
   `.ts`/`.json` orphelins + `git checkout -- src/migrations/index.ts
   src/payload-types.ts`, puis régénération avec l'env complet → migration
   finale : colonne `code_insee` + index unique sur `communes`,
   `version_code_insee` sur `_communes_v` (index simple, comme `slug`),
   `down` symétrique.
2. **Les bases de tests int n'ont jamais les colonnes S3** (`prefix`,
   `_objectkey`) : chaque run vitest pousse le schéma config-sans-S3
   (`vitest.setup.ts` force `S3_ENABLED=false`). Vérifié identique sur les
   bases `pdlm_test` et `pdlm_test_gabarits` existantes — état normal, rien
   à corriger.
3. `payload-types.ts` régénéré sans `UMAMI_URL` : diff de 5 lignes
   exactement (juste `codeInsee`), la description `mesure.active` « non
   installée » étant déjà celle du fichier commité (cf. notes-tache-10).

## Étape 2 — générateur `src/lib/nomenclature.ts`

Fonctions pures, aucune dépendance à Payload ni au réseau (décision du brief) :

- `etiquetteDomaine(nom)` — transcription ANCT : minuscules, NFD puis retrait
  des accents combinants, espaces/apostrophes/tirets réduits à un tiret,
  tirets de bord coupés. Rend `null` si le résultat n'est pas purement ASCII
  `a-z0-9-` : **aucun nom IDN n'est jamais proposé** (« Nœux-les-Mines » →
  aucune forme, pas de `xn--`).
- `formesRecommandees(nom, codeDepartement, homonyme)` — rend un tableau de
  rangs (tableaux) : `nom`, `mairie-nom`, `ville-nom` en `.fr`, le geoTLD du
  département **dans le même rang** (à égalité, jamais après), puis la forme
  `nom<département>` en dernier rang seulement si homonyme. Département absent
  ou illisible : `.fr` seul et pas de forme homonyme (fabriquer
  « quimperXYZ.fr » serait faux). Rend `[]` si le nom ne se transcrit pas.
- `departementDuCodeInsee(codeInsee)` — 2 chiffres, `2A`/`2B`, ou 3 chiffres
  pour l'outre-mer (`974`) ; `null` si absent/illisible. Sert à déduire le
  geoTLD du champ `codeInsee` sans ressaisie.
- geoTLD (recopiés du § 2) : `.bzh` (22, 29, 35, 56, 44), `.corsica` (2A, 2B),
  `.alsace` (67, 68).

Tests (`tests/unit/nomenclature.spec.ts`, style `siret.spec.ts`), rouge puis
vert :

```
rouge : Test Files 1 failed — Failed to resolve import "@/lib/nomenclature"
        Tests  no tests
vert  : Test Files  1 passed (1)
        Tests  14 passed (14)
```

Couverture exigée par le brief : Quimper/29 (`.fr`+`.bzh` à égalité),
L'Île-Rousse/2B (`.corsica` à égalité, apostrophe → tiret),
Saint-Jean-de-Luz/64 (`.fr` seul), homonymes (42 et 2A, dernier rang seulement
si homonyme), Saint-Étienne (accent parti), aucune forme IDN (œ + garde
`/^[\x20-\x7E]+$/` sur toutes les formes proposées).

Deux corrections en cours de route : ma première assertion attendait
« saint-lô » accentué (la transcription est ASCII : « saint-lo »), et la regex
Corse `[12]ab` exigeait trois caractères au lieu de `[12][ab]` — les tests
l'ont attrapé immédiatement.

### Relecture des commits 8a760ab et 98c80a2 — trois corrections

1. **Casse du code INSEE** (8a760ab) : la regex acceptait `2a004` minuscule,
   donc `2a004` et `2A004` coexistaient malgré l'index unique, et le
   rapprochement avec la ligne ANCT échouerait. Corrigé par un
   `hooks.beforeValidate` champ qui met en MAJUSCULES avant validation ET
   unicité ; la regex est resserrée sur `2[AB]` (la minuscule n'y arrive
   plus). Test int ajouté : `2a004` stocké `2A004`, puis `2A004` sur l'autre
   commune refusé `/unique/` — rouge (`expected '2a004' to be '2A004'`)
   avant le hook, vert après. Anciennes lignes éventuelles en minuscules :
   aucune (migration toute récente, aucune saisie réelle).
2. **Mandataire** (8a760ab) : test int ajouté — refus 403, comme le rédacteur
   (même accès collection `update`). Passe d'emblée : preuve ajoutée, pas
   régression corrigée (l'accès préexistait), même statut que le test
   rédacteur à l'étape 1.
3. **Ligatures** (98c80a2) : `etiquetteDomaine` rendait `null` pour
   « Œuilly » (communes réelles 02565 et 51410, homonymes) — aucune
   proposition. Translittération `œ→oe`, `æ→ae` AVANT le test ASCII (NFD ne
   les décompose pas). Tests unitaires ajoutés : `Œuilly` → `oeuilly.fr` …
   `oeuilly02.fr` (homonyme, 02) ; l'ancien garde-fou « Nœux-les-Mines →
   aucune forme » est remplacé : `noeux-les-mines.fr` est bien la forme
   réelle, et l'absence d'IDN reste prouvée par des signes hors latin
   (`Жуан`, `²`). Rouge (`expected null to be 'oeuilly'`) avant, vert après.

Sorties réelles :

```
unitaire rouge : Tests  2 failed | 14 passed (16)
unitaire vert  : Tests  16 passed (16)
int      rouge : Tests  1 failed |  7 passed (8)   (normalisation ; mandataire déjà vert)
int      vert  : Tests   8 passed (8)
typecheck      : tsc --noEmit, aucune erreur
```



## Étape 3 — `evaluerDomaine` (signalement I35, jamais bloquant)

Dans `src/lib/nomenclature.ts`, toujours pure. Rend `{ conforme: true }` ou
`{ conforme: false, critere: 'extension' | 'idn' | 'forme' }`, dans cet ordre
de jugement :

1. signe hors ASCII imprimable → `idn` (écriture directe : `quimpér.fr`) ;
2. hôte ASCII mal formé (moins de deux labels, label vide ou mal délimité) →
   `forme` ;
3. label `xn--…` → `idn` (écriture punycode), AVANT le jugement d'extension :
   `xn--quimpr-fva.fr` signale IDN même si `.fr` est accepté ;
4. dernier label hors liste souveraine du § 1.2 (16 extensions : `.fr`,
   `.eu`, `.alsace`, `.bzh`, `.corsica`, `.paris`, et les 10 ccTLD
   d'outre-mer) → `extension`.

**I35 : jamais bloquant.** `grep -rn "evaluerDomaine" src/` ne montre que sa
définition dans `nomenclature.ts` — aucun `validate`, aucun hook ne l'appelle
(elle servira à l'affichage admin de l'étape 4).

Tests, rouge puis vert :

```
rouge : Tests  4 failed | 16 passed (20)   ← fonction inexistante
vert  : Tests  20 passed (20)
```

Couverture : conformes `.fr`/`.bzh`/`.corsica`/`.alsace`/`.re`, sous-domaine
`www.`, casse ignorée ; non conformes `.com`/`.org` (extension), `quimpér.fr`
et `xn--quimpr-fva.fr` y compris en MAJUSCULES (idn), `sans-point`, `..`,
`-quimper.fr`, chaîne vide (forme).

## Étape 4 — affichage admin sous `hostname` (Domaines)

Pas de fichier `a-decider` : le champ `ui` existait déjà dans le répertoire
(FriseApercu, EffacerHistorique), aucune adaptation multi-tenant nécessaire.

Ce qui est fait :

- `Domaines.ts` : champ `type: 'ui'`, `name: 'nomenclature'`, posé juste sous
  `hostname` — **rien en base, aucune migration**. `importMap.js` régénéré par
  `npm run generate:importmap` **avec l'env S3 complet** (piège connu : sans
  lui, l'entrée `S3ClientUploadHandler` disparaît du diff).
- `src/components/admin/NomenclatureDomaines.tsx` (client) : lit `hostname` et
  `commune` du formulaire (`useFormFields`), va chercher `nom` + `codeInsee`
  de la commune par REST (`depth=0`, `credentials: 'include'`,
  `cache: 'no-store'` — données vives), puis affiche :
  - les rangs du § 2 en liste ordonnée, geoTLD **dans le même rang** (affiché
    « ou ») quand le code INSEE donne un département à geoTLD ;
  - la forme homonyme en ligne séparée (« dernier rang ») ;
  - un indice quand la commune n'a pas de code INSEE (pas de geoTLD ni
    d'homonyme proposés) ;
  - le signalement I35 du hostname saisi en `role="alert"` (critère extension /
    idn / forme), avec la mention explicite que rien n'est bloqué — et la ligne
    « conforme » dans le cas contraire ;
  - le lien vers le référentiel ANCT.
  Aucune écriture, aucun `validate` : purement indicatif.
- ESLint `react-hooks/set-state-in-effect` interdit un `setState` synchrone
  dans l'effet : cache `Record<number, CommuneLégère>` + garde de
  non-regression + `setState` fonctionnel dans le `.then` du fetch.

Captures (`docs/qc/captures-rpnt-lot2/`, 3 PNG — je ne peux pas afficher les
images, le relecteur les regardera ; le texte réel du panneau est collé
ci-dessous comme preuve d'équivalence) :

1. `commune-code-insee.png` — le champ sur la fiche commune (label, saisie
   vide, description avec l'exemple Quimper et le renvoi geo.api.gouv.fr).
2. `domaines-nomenclature.png` — panneau avec `codeInsee: 29232` posé
   temporairement sur Saint-Exupéry-les-Bains (démo d'un geoTLD). Texte réel :

   ```
   Nomenclature des domaines (RPNT § 2)
   saint-exupery-les-bains.fr ou saint-exupery-les-bains.bzh
   mairie-saint-exupery-les-bains.fr ou mairie-saint-exupery-les-bains.bzh
   ville-saint-exupery-les-bains.fr ou ville-saint-exupery-les-bains.bzh
   En cas d'homonymie nationale : saint-exupery-les-bains29.fr ou
     saint-exupery-les-bains29.bzh (dernier rang).
   « saint-exupery-les-bains.fr » est conforme au § 1.2 (extension souveraine).
   ```

3. `domaines-nomenclature-i35.png` — hostname saisi
   `saint-exupery-les-bains.fr.com` (jamais enregistré), même panneau avec :

   ```
   I35 — « saint-exupery-les-bains.fr.com » : extension hors liste souveraine
   du RPNT (.fr, .bzh, .corsica…). Signalement seul : l'enregistrement n'est
   pas bloqué.
   ```

Base de dev : la pose `29232` (PATCH REST opérateur) est retirée en fin de
script, vérifiée par GET (`codeInsee: null`) **et** par
`psql -tc "SELECT id, code_insee FROM communes"` (deux lignes vides).

Pièges rencontrés (script de capture Playwright, jetable, hors commit) :

1. **CSRF sur REST** : une requête qui porte le cookie de session sans en-tête
   `Origin` est rejetée 403 « Vous n'êtes pas autorisé » sur TOUTES les
   collections — `page.request` de Playwright n'envoie ni `Origin` ni
   `Referer`. En-tête `origin` explicite requis dans le script. Le composant
   n'est pas concerné (fetch same-origin du navigateur, `Referer` envoyé).
2. `waitForURL('**/admin**')` matcherait la page de login elle-même
   (`/admin/login` contient `/admin`) : attendre sa disparition, et hydrater
   la page avant de cliquer (`waitUntil: 'networkidle'`), sinon le clic
   n'enregistre pas la connexion.
3. Un champ `ui` n'a pas d'id `field-<name>` : le conteneur à capturer est le
   parent direct du `p.field-label` (le `div.field-type` du composant).
4. **Bug de mon script, pas du produit** : `page.request.patch(url, { data })`
   enrobe le corps en `{"data":{...}}` — champ inconnu que Payload ignore
   silencieusement : PATCH 200 **sans aucun effet** (la réponse du PATCH le
   montrait : `codeInsee: null`). Les données se passent directement. Le
   diagnostic a coûté plusieurs courses : le panneau affichait exactement
   l'état réel de la base, qui n'avait jamais été modifiée.
5. Le `POST /api/communes` visible dans les logs du serveur n'est PAS une
   création : c'est l'hydratation du champ `commune` par l'admin, un find en
   POST (`where[id][in]`, `draft=true`, `select[nom]`).

Après corrections : lint 0 avertissement, `tsc --noEmit` 0 erreur.

## Étape 5 — vérification finale

À venir.
