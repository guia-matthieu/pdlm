# Notes — Instance de démonstration en ligne

Brief : `~/Projects/guia/tasks/2026-10-25_brief-glm-demo-en-ligne.md`.
Branche : `demo-en-ligne` (créée par le hub depuis `main` `cbac12a`), worktree
`~/Projects/glm.demo`. Ces notes servent de point de reprise : chaque partie y
consigne ce qui est fait, les sorties réelles des commandes et les pièges.

## Journal

| Commit | Partie | Contenu |
| --- | --- | --- |
| (ci-dessous) | A | Seed `demo-en-ligne.ts` + garde-fous + tests + script npm |

## Cadre de travail

- Le code applicatif (`src/` hors `src/seed/`) n'est pas touché en A et B :
  pas de test d'intégration requis par le brief. L'essai Docker (C) vaut
  preuve de bout en bout.
- Aucun `.env` dans le dépôt ; l'essai de la partie C utilise
  `/tmp/pdlm-demo-essai/.env` (hors dépôt, supprimé à la fin).

## Partie A — seed de démonstration en ligne

Fichiers : `src/seed/demo-en-ligne.ts` (script), `src/seed/garde-fous-demo.ts`
(logique pure), `tests/unit/garde-fous-demo.spec.ts` (tests),
`src/seed/contenu-demo.ts` (options de réutilisation), `package.json`
(script npm).

### Ce qui a été fait

- `npm run seed:demo-en-ligne` = `payload run src/seed/demo-en-ligne.ts`
  (calqué sur `npm run seed`). En production, depuis l'image `migrator` :
  `node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts` — c'est la
  commande éprouvée par le README (recette multilingue,
  `scripts/instantane-contenu.ts`) ; la partie C la rejoue en vrai.
- Le script ne vérifie pas `NODE_ENV` : il doit tourner en production, à la
  différence de `src/seed/index.ts` qui la refuse (et loggue des mots de
  passe) — d'où des upserts réécrits ici plutôt qu'un import.
- Environnement : `DEMO_DOMAIN` + `DEMO_MDP_OPERATEUR`/`DEMO_MDP_ADMIN`/
  `DEMO_MDP_REDACTEUR`, obligatoires, mots de passe ≥ 16 caractères. Les
  messages d'erreur nomment les variables fautive**s** sans jamais afficher de
  valeur (garanti par le test « aucun message d'erreur ne révèle la valeur
  testée »).
- Communes (idempotent, relance = aucun doublon) :
  - `saint-ex` « Saint-Exupéry-les-Bains », `apparence.gabarit: 'village'`,
    couleurs non saisies → défauts de `src/lib/couleurs.ts` au rendu ;
  - `port-lavanne` « Port-Lavanne », `apparence.gabarit: 'littoral'` + palette
    `#2a7f9e`/`#f2b134`/`#d2462f` (palette littoral éprouvée par les captures
    e2e `tests/e2e/gabarits-captures.e2e.spec.ts`) ;
  - gabarit et couleurs = champs du groupe `apparence` de `communes`
    (`src/collections/Communes.ts`), posés à la création seulement : une
    relance n'écrase pas les retouches faites dans l'admin ;
  - domaine canonique `<slug>.<DEMO_DOMAIN>` en français, puis activation —
    l'ordre impose I6 (activation sans canonique fr → `ValidationError`) ;
    l'activation ne se fait que si la commune est inactive (pas de version de
    fiche à chaque relance, `versions.maxPerDoc: 20`).
- Garde-fou hostname : `estHostnameDemo` (fin par `.<DEMO_DOMAIN>` et plus
  long que le domaine seul) appliqué dans `assurerCommune`, testé en unitaire.
- Comptes (courriels `.invalid`, RFC 2606 — acceptés par la validation
  Payload, regex TLD `\.[a-z]{2,}$` du champ email, vérifiée dans
  `node_modules/payload/dist/fields/validations.js`) :
  `operateur@pdlm.invalid` (opérateur), `admin@pdlm.invalid` et
  `redacteur@pdlm.invalid` (mandats sur `saint-ex`). Création seule : un
  compte existant garde son mot de passe (les `DEMO_MDP_*` ne sont lus qu'à la
  création — repris dans `docs/deploiement-demo.md`). Rien n'est journalisé.
- Contenu : `seedContenuDemo(payload, saintEx, portLavanne, admin, {
  nomSecondaire: 'Port-Lavanne', traductionsCorses: false })` — le contenu
  existant est réutilisé, pas copié ; les deux options nouvelles (défauts =
  comportement inchangé pour le seed de dev) renomment l'accueil de la seconde
  commune et sautent les traductions corses (la démo en ligne n'est pas la
  démo multilingue).
- Agenda vivant : `contenu-demo.ts` ne crée les événements que si l'agenda est
  vide ; `redaterEvenements` re-date ensuite « Marché de printemps » (J+5,
  6 h) et « Conseil municipal (séance publique) » (J+12, 2 h) **à chaque
  exécution** (update ciblé par titre, aucun doublon) — relancer le seed
  périodiquement rafraîchit la démo (cf. partie D).

### Preuves (sorties réelles)

    $ npm run lint
    > pdlm@0.1.0 lint
    > cross-env NODE_OPTIONS=--no-deprecation eslint .
    (aucune sortie — 0 erreur)

    $ npm run typecheck
    > pdlm@0.1.0 typecheck
    > tsc --noEmit
    (aucune sortie — 0 erreur)

    $ npm run test:unit
     Test Files  36 passed (36)
          Tests  339 passed (339)
      Duration  5.48s

    $ npx … vitest run … tests/unit/garde-fous-demo.spec.ts
     Test Files  1 passed (1)
          Tests  7 passed (7)

`src/payload-types.ts` inchangé (`git status --short` ne le liste pas).

### Pièges rencontrés

- La logique des garde-fous vit dans `garde-fous-demo.ts`, module sans effet
  de bord à l'import : `demo-en-ligne.ts` travaille au chargement du module
  (top-level await, pattern `payload run`), l'importer dans vitest lancerait
  le seed.
- `figerPrivileges` (hook `beforeChange` de Users) s'applique aussi en
  `overrideAccess` (les hooks tournent toujours) mais laisse passer les appels
  sans `req.user` — les créations du seed passent telles quelles.
