# Notes QC — tâche 2 : Données, droits, versions, préremplissage

Exécutée le 04/10/2026 dans le worktree `~/Projects/glm.gabarits`, branche
`gabarits-couleurs`. Commit : `cca7775` (« Apparence — gabarit, frise, 3
couleurs, accueil prérempli, versions (I4, I24) »).

## Ce qui a été fait

1. **Ancres re-vérifiées** (étape 1) — les trois ancres du plan existent :
   `name: 'apparence'` (`src/collections/Communes.ts:296` avant édition),
   `champMedia: 'logo'` (l. 141), `tests/helpers/communeTest.ts`. L'ordre des
   hooks correspond au plan (logo → `preparerMesure`). Aucun correctif au plan
   n'était nécessaire.
2. **URL service-public.fr vérifiées une par une** avant d'entrer dans le code
   (voir sorties ci-dessous) : N358, N359, N319 répondent 200 après
   redirection vers `service-public.gouv.fr`.
3. **Test d'intégration écrit et vu échouer d'abord** :
   `tests/int/communes-apparence.int.spec.ts` — 5 tests du plan (étape 2),
   `describe('droits')` (étape 4 : rédacteur refusé, admin accepté, gabarit et
   frise ignorés pour un non-opérateur) et `describe('R4')` (décision 14 :
   traduction corse passe, ajout/retrait/réordonnancement refusés, français
   inchangé après traduction corse).
4. **`src/lib/accueil-defauts.ts`** : `PICTOS`, `SCENES`, `DEMARCHES_DEFAUT`,
   `MOSAIQUE_DEFAUT` (valeurs du plan, figées), plus `LIBELLES_PICTOS` et
   `LIBELLES_SCENES` (libellés français des options `select` de l'admin).
5. **`src/collections/Communes.ts`** : onglet non nommé « Apparence »
   (décision 11) contenant les groupes `apparence` et `accueil` à la racine ;
   `gabarit` (défaut `village`) et `frise` à `access.update` opérateur seul
   (décision 15) ; `couleurTerre` ; `couleursForcees` (9 champs) dans un
   collapsible « Réglages avancés » replié ; `photoAccueil` ;
   `accueil.demarches` (maxRows 8, `defaultValue`) et `accueil.mosaique`
   (maxRows 4, `defaultValue`) ; `titre`/`libelle` localisés avec
   `requisEnFrancais` ; `lien` avec `validerUrlEditoriale` ; `versions: {
maxPerDoc: 20 }` sans brouillons ; retrait du `defaultValue` et de la
   description « Contraste RGAA » de `couleurPrincipale` (le défaut vit dans
   `couleurs.ts`, tâche 1) ; validateur hexa factorisé (`validerCouleur`,
   I24) ; hook `structureAccueilEnFrancais` (R4, décision 14, modèle
   `structureEnFrancais`/`clesLignes` de `Menus`, sans niveau enfants) et les
   deux hooks `validerRelationsTenant` du plan (`apparence.photoAccueil`,
   `accueil.mosaique`), placés après le hook du logo et avant `preparerMesure`.
6. **Pictogrammes** : 6 SVG GemeentenIconen (CC0) copiés depuis
   `G-maquette-v2/icones/` (variantes `-fill`, mapping de `generer.py`) vers
   `public/pictos/{dechets,identite,etat-civil,urbanisme,ecole,conseil}.svg`
   - `LICENCE.md`. Fichiers bruts, non retouchés.
7. **Types régénérés** (`UMAMI_URL=http://stats.localhost S3_ENABLED=true npm
run generate:types`) ; le diff de `src/payload-types.ts` ne contient que
   les champs de la tâche (interface `Commune` + `CommunesSelect`).
   `generate:importmap` exécuté puis rétabli (voir écarts).
8. **Migration** `20261004_133203_gabarits_couleurs` : SQL généré lu en
   entier — il ne touche que les objets de la tâche (types enum, tables
   `communes_apparence_frise`, `communes_accueil_demarches(_locales)`,
   `communes_accueil_mosaique(_locales)`, `_communes_v*`, colonnes
   `apparence_*` de `communes`, `DROP DEFAULT` de
   `apparence_couleur_principale` ; `down` symétrique avec remise du défaut
   `'#264653'`). Préremplissage ajouté à la fin de `up`. Aller-retour vérifié
   sur `pdlm_gabarits_dev` (sorties ci-dessous).

## Écarts au plan, avec motif

1. **Assertions des 3 refus (I4 ×2, format I24) : `rejects.toThrow` → helper
   `refus()` lisant `data.errors[0]`** (message + path). Motif : Payload ne
   met pas le message détaillé dans `error.message` — le refus I4 se lisait
   `"The following field is invalid: apparence.photoAccueil"` et le refus de
   format `"Le champ suivant n'est pas valide : Apparence > … > Couleur de
terre (hex)"`, sans le texte attendu. Le plan référence lui-même
   `relations-tenant.int.spec.ts` (étape 4), dont le helper `refus()` lit
   `data.errors[0].message` et `path` — forme reprise à l'identique, messages
   et chemins du plan conservés (`apparence.photoAccueil`, `accueil.mosaique`,
   `/n'appartient pas à cette commune/`, `/#RRGGBB/`). **Validé par le pilote
   du plan** ; les deux premières exécutions du test (échec avec la sortie
   ci-dessous) en sont la preuve.
2. **Préremplissage de la migration réécrit** (étape 6). Deux défauts au
   pseudo-SQL du plan : (a) sa boucle ligne à ligne avec `WHERE NOT EXISTS
(… x._parent_id = c.id)` n'insère que la **première** ligne — dès
   l'itération 1, chaque commune possède une ligne et les itérations 2-6 ne
   trouvent plus aucune cible ; (b) `titre`/`libelle` ne vivent pas dans la
   table principale mais dans `communes_accueil_*_locales` (champs localisés,
   décision 14). Réécrit en **une instruction atomique par liste** (CTE
   `defauts`/`cibles`/`inserees`, ordre porté par les `VALUES`, `'fr'` dans
   les `*_locales`), avec `DEMARCHES_DEFAUT`/`MOSAIQUE_DEFAUT` comme source
   unique (exigence du plan). Vérifié en base : 12/8/12 lignes et contenus
   exacts (sorties ci-dessous).
3. **`titre` et `libelle` sans `required: true`** (le plan du 25/09 écrivait
   « text, required »). Motif : la décision 14 (04/10) impose le modèle
   `Communes.nom` — `localized: true` + `validate: requisEnFrancais` — or un
   champ localisé `required` devient une colonne NOT NULL de `*_locales`,
   interdisant la traduction partielle (commentaire de
   `src/lib/champs-langue.ts`). La décision 14 prime sur le texte de la tâche.
4. **`couleursForcees` : le fragment « group à `admin: { condition }` » du
   plan n'est défini nulle part** (spec § 1 : « group, replié ”Réglages
   avancés" » ; spec § 4 : visibles par l'admin). Implémenté comme
   `collapsible` inconditionnel « Réglages avancés », `initCollapsed: true`,
   contenant le groupe — aucune condition, rien ne la justifie dans la spec.
5. **`importMap.js` régénéré puis rétabli** : le contenu généré est identique
   (33 clés et imports comparés identiques ; seul le style de guillemets
   diffère, le fichier commité étant quoté simple). La tâche n'ajoute aucun
   composant client ; rétabli pour garder le diff minimal.
6. **Snapshots `.json` des migrations anciennes** : `migrate:create` les a
   réécrits en format compact ; contenu comparé identique (`jq -S`) pour les
   3 fichiers ; rétablis.
7. **`payload migrate` demande une confirmation interactive** (« run Payload
   in dev mode… data loss will occur ? ») sur la base dev construite en
   push. Répondu `y` : base dédiée du worktree (`pdlm_gabarits_dev`), semée,
   et le plan demande cet aller-retour sur elle.
8. **Reformatage par le hook de formatage** : dans `Communes.ts`, deux
   régions préexistantes ont été reflowées par Prettier (le `where: {and: …}`
   et le `errors: [{…}]` du hook I15, et l'import `champs-langue` replié sur
   une ligne) — lignes non sémantiquement touchées, laissées telles quelles.
   Par ailleurs le hook reformate ~22 fichiers hors périmètre après chaque
   édition ; ils ont été restaurés après **vérification première main** qu'ils
   sont octet-identiques au Prettier du contenu commité (0 différence sur 22),
   donc sans perte de travail.
9. **Typage des lignes dans le test R4** : les types `Demarche`/`Tuile` sont
   dérivés de `payload-types` (le cast à la main du brouillon élargissait
   `picto` à `string` et faisait échouer `tsc`).
10. **Ajout mineur** : `LIBELLES_PICTOS`/`LIBELLES_SCENES` exportés de
    `accueil-defauts.ts` pour les libellés des `select` (le plan ne
    prévoyait que les 4 constantes ; sans cela, l'admin afficherait les slugs).

## Sorties de vérification (collées telles quelles)

### URL service-public.fr (avant le code)

```
$ curl -sSL -o /tmp/sp.html -w 'HTTP %{http_code} -> %{url_effective}\n' <url> ; grep -o '<title>[^<]*</title>'
== N358
HTTP 200 -> https://www.service-public.gouv.fr/particuliers/vosdroits/N358
<title>Carte d&#39;identité | Service Public</title>
== N359
HTTP 200 -> https://www.service-public.gouv.fr/particuliers/vosdroits/N359
<title>Actes d&#39;état civil | Service Public</title>
== N319
HTTP 200 -> https://www.service-public.gouv.fr/particuliers/vosdroits/N319
<title>Autorisations d&#39;urbanisme | Service Public</title>
```

N358 est désormais titrée « Carte d'identité » sur le site gouv.fr ; la page
couvre aussi le passeport (contenu contrôlé : « Passeport : comment remplir
le formulaire… »). Le dossier correspond bien au libellé « Papiers
d'identité » du plan ; libellé et lien conservés.

### Test vu échouer d'abord (étape 3)

```
$ npx vitest run --config ./vitest.config.mts tests/int/communes-apparence.int.spec.ts
 Test Files  1 failed (1)
      Tests  10 failed (10)
```

Après ajout du `describe('droits')` : 12 échecs (les 2 tests portant sur des
droits préexistants — rédacteur refusé, admin change l'accent — passaient
déjà). Premier échec d'assertion sur `error.message` (motif de l'écart 1) :

```
- Expected:
/n’appartient pas à cette commune/
+ Received:
"The following field is invalid: apparence.photoAccueil"
```

### Migration — aller / retour / aller sur pdlm_gabarits_dev

```
$ echo y | npm run payload migrate
[15:42:25] INFO: Migrating: 20261004_133203_gabarits_couleurs
[15:42:25] INFO: Migrated:  20261004_133203_gabarits_couleurs (49ms)
[15:42:25] INFO: Done.

-- préremplissage vérifié (2 communes existantes : saint-ex, valvert) :
 slug     | demarches | tuiles | apparence_gabarit
 saint-ex |         6 |      4 | village
 valvert  |         6 |      4 | village
-- démarches (commune 1) : _order 1..6, pictos dechets/identite/etat-civil/
   urbanisme/ecole/conseil, titres « Déchets, Papiers d'identité, État civil,
   Urbanisme, École et cantine, Conseil municipal », liens N358/N359/N319 sur
   les lignes 2-4, null ailleurs.
-- mosaïque : _order 1..4, libellés « Balades et sentiers, Patrimoine,
   Commerces, Associations », illustrations sentiers/patrimoine/commerces/
   associations, photo_id null.

$ echo y | npm run payload migrate:down
[15:42:46] INFO: Migrating down: 20261004_133203_gabarits_couleurs
[15:42:46] INFO: Migrated down: 20261004_133203_gabarits_couleurs (32ms)
[15:42:46] INFO: Done.

-- après down : 0 table parmi (communes_accueil_demarches, communes_accueil_
   mosaique, _communes_v, communes_apparence_frise) ; 0 enum gabarits/
   apparence/accueil/_communes_v ; column_default de
   apparence_couleur_principale = '#264653'::character varying (restauré).

$ echo y | npm run payload migrate
[15:43:05] INFO: Migrating: 20261004_133203_gabarits_couleurs
[15:43:05] INFO: Migrated:  20261004_133203_gabarits_couleurs (46ms)
[15:43:05] INFO: Done.

-- après re-up : communes_accueil_demarches = 12, communes_accueil_mosaique
   = 8, communes_accueil_demarches_locales (_locale='fr') = 12.
```

### Suites finales

```
$ npm run test:int
 Test Files  23 passed (23)
      Tests  207 passed (207)
   Duration  28.74s

$ npm run test:unit
 Test Files  21 passed (21)
      Tests  152 passed (152)

$ npm run typecheck  (tsc --noEmit)
— aucune sortie, code 0

$ npm run lint
✖ 50 problems (2 errors, 48 warnings)
-- les 2 erreurs : .superpowers/sdd/2026-09-25-gabarits-couleurs/probe-review{,2}.ts
   (sondes connues, hors périmètre) ; 0 erreur dans src/ et tests/.

$ echo N | npm run payload migrate:create controle
? No schema changes detected. Would you like to create a blank migration file? … no
(aucun fichier créé)

$ git status --short   [après commit de la tâche et remise à zéro du
                        hors-périmètre ; voir écart 8]
— vide
```

Le fichier `tests/int/communes-apparence.int.spec.ts` compte 14 tests
(5 du plan + 4 droits + 5 R4), tous verts dans le run `test:int` ci-dessus.

## Ce qui n'a pas pu être vérifié

- **L'admin rendu** (onglet « Apparence », collapsible replié, masquage
  visuel de `gabarit`/`frise` pour un non-opérateur) : vérifié au niveau API
  (le champ est silencieusement ignoré, valeur relue après écriture), pas
  dans un navigateur — l'écran d'ajustement appartient à la tâche 9.
- **Le rendu des pictogrammes** : fichiers copiés bruts ; leur intégration
  (retrait du `<title>` néerlandais, `aria-hidden`, coloration par CSS) est
  le modèle `picto()` de la maquette et revient aux tâches 4-5.
- **`npm run test:e2e`** : non lancé — l'étape 7 de la tâche ne le demande
  pas (le critère de la tâche est `test:int` + `typecheck` + `lint`).
