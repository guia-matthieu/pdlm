# Contribuer à pdlm

Merci de l'intérêt porté à ce projet. Ce document décrit comment proposer un
changement.

## Avant de commencer

- Pour un changement de comportement (nouvelle fonctionnalité, changement de
  règle d'accès, nouvel invariant de sécurité), ouvrir une _issue_ décrivant
  le besoin avant d'écrire du code — certains choix (isolation multi-tenant,
  politique de fichiers, rôles) sont documentés et volontairement contraints ;
  autant vérifier la compatibilité avant d'investir du temps.
- Pour une correction de bug, un rapport reproductible (étapes, comportement
  observé, comportement attendu) suffit à démarrer.
- Toute vulnérabilité de sécurité suit une procédure séparée — voir
  [`SECURITY.md`](SECURITY.md), pas d'issue publique.

## Environnement de développement

Voir le [README](README.md#démarrage--développement) pour l'installation.
Prérequis : Node 22 (`.nvmrc`), Docker, npm.

## Style et conventions du code

- **Français** pour les noms de champs, fonctions métier, messages d'erreur
  utilisateur et commentaires ; anglais pour les termes techniques standards
  du framework (`CollectionConfig`, `beforeChange`…).
- Un commentaire au-dessus d'une règle non évidente référence l'invariant
  qu'elle protège (ex. `// I6 : …`) — les invariants sont listés dans le plan
  d'implémentation (`~/.claude/plans/`, non versionné) ; à défaut, une phrase
  explique le _pourquoi_, pas le _quoi_.
- ESLint et Prettier font foi pour le format : `npm run lint`. Exception
  assumée — `src/payload-types.ts` et
  `src/app/(payload)/admin/importMap.js` sont générés par Payload
  (`npm run generate:types`, `npm run generate:importmap`) et commités **dans
  leur format brut de générateur**, pas reformatés à la main : reformater ces
  deux fichiers ne fait que salir le prochain diff, `next dev` les régénère
  de toute façon à chaque démarrage.

## Tests

Ce projet suit une discipline TDD : **le test qui échoue est écrit avant le
correctif**, pas après.

- `npm run test:unit` — logique pure, dépendances simulées.
- `npm run test:int` — contre une vraie instance Payload/PostgreSQL
  (`pdlm_test`, base jetable). Préféré à un test unitaire simulé dès qu'une
  règle dépend du comportement réel de la base (clés étrangères, contraintes
  d'unicité, transactions) — un mock aurait laissé passer plusieurs défauts
  découverts en recette sur ce projet.
- `npm run test:e2e` — Playwright, parcours utilisateur réels.

Toute affirmation « les tests passent » doit être vérifiée par une exécution
réelle et récente, jointe à la pull request (sortie de commande, pas une
paraphrase) — lint, `tsc`, unit, int et, si le changement touche le parcours
utilisateur, e2e.

## Sécurité et invariants

Les invariants du plan (isolation multi-tenant par commune, contrôle d'accès
contextualisé par rôle, journal d'audit fail-closed, politique de fichiers)
sont des garanties testées, pas des conventions informelles. Un changement
qui les affecte doit :

1. Ajouter ou étendre un test d'intégration qui l'aurait fait échouer avant
   le changement (preuve du problème, pas seulement de la correction).
2. Documenter dans le message de commit **pourquoi** l'invariant change, pas
   seulement ce qui change.

## Commits et pull requests

- Un commit = un changement de nature homogène (ne pas mélanger un
  renommage et un changement de comportement). Le message explique le
  _pourquoi_, pas une paraphrase du diff.
- La pull request résume : le problème, le correctif, les tests exécutés
  (avec leur résultat réel).
- Pas de force-push sur une branche partagée sans prévenir.

## Licence

En contribuant, vous acceptez que votre contribution soit distribuée sous
les termes de la licence [AGPL-3.0](LICENSE) de ce projet.
