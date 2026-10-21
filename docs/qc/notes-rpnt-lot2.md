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

À venir.

## Étape 3 — `evaluerDomaine` (signalement I35, jamais bloquant)

À venir.

## Étape 4 — affichage admin sous `hostname` (Domaines)

À venir.

## Étape 5 — vérification finale

À venir.
