# Bloqué — tâche 2, point B10 : un admin de commune ne lit aucune version de SA commune

> **TRANCHÉ le 04/10/2026 — voir la décision 16 du plan.** L'option 2 recommandée ci-dessous ne suffit pas telle quelle : le plugin combine par ET l'accès de la collection et sa contrainte fautive. Le correctif retenu remplace `readVersions` dans un plugin local placé après `multiTenantPlugin`. Ce fichier reste comme trace de la mesure.

Découvert le 04/10/2026 en corrigeant la tâche 2 après relecture (point B10 :
« un admin de commune, avec `overrideAccess: false`, lit les versions de SA
commune après une modification (`payload.findVersions`), et ne lit pas celles
d'une autre »). Conformément à la consigne, le code n'a **pas** été corrigé ;
ce document rend la main.

## Ce que j'ai mesuré

`Communes` porte désormais `versions: { maxPerDoc: 20 }` (tâche 2). Commune A
créée puis modifiée plusieurs fois → 2 lignes dans `_communes_v`
(`parent_id` = A). Requêtes en API locale (`tests/int/communes-apparence.int.spec.ts`,
utilisateur admin de A créé avec `tenants: [{ tenant: A, roles: ['admin'] }]`) :

```ts
await payload.findVersions({
  collection: 'communes',
  where: { parent: { equals: communeA } },
  user: adminA, // admin de la commune A
  overrideAccess: false,
})
```

## La commande et sa sortie

Trois appels comparés (sorties du test de débogage, 04/10) :

| Appel                                           | `totalDocs` |
| ----------------------------------------------- | ----------- |
| `user: adminA` (admin de A), `where parent = A` | **0**       |
| `user: adminA`, **sans** `where`                | **0**       |
| `user: operateur`, `where parent = A`           | 2           |
| `overrideAccess: true`, `where parent = A`      | 2           |

L'admin de la commune ne voit **aucune** version — pas même celles de sa
propre commune — dès qu'il passe par le contrôle d'accès ; un opérateur ou un
`overrideAccess: true` les voit. Aucune erreur n'est levée : la requête
renvoie silencieusement 0.

## Cause (lue dans le code du plugin, non corrigée)

`@payloadcms/plugin-multi-tenant` enveloppe l'accès de la collection tenants
elle-même (`index.js`, `useTenantsCollectionAccess` par défaut, `fieldName:
'id'`). Pour `readVersions`, `addCollectionAccess` préfixe le champ :
`version.id` (`addCollectionAccess.js` l. 24). La contrainte rendue par
`withTenantAccess` pour un non-opérateur est donc
`{ 'version.id': { in: [communesDeLUtilisateur] } }`. Or sur `_communes_v`,
`version.id` ne désigne pas « la version d'une de mes communes » (ce serait
`parent`), mais l'identifiant de **ligne** de version : la contrainte ne
matche aucune ligne en pratique (0 doc), voire une ligne d'une **autre**
commune si les ids se croisent. L'admin UI « Versions » de la fiche commune
est donc vide pour tout non-opérateur, et l'historique posé en tâche 2 est
inutilisable par les mairies via l'API.

## Options

1. **`useTenantsCollectionAccess: false`** dans `multiTenantPlugin({ … })`
   (`src/payload.config.ts`). L'accès de `Communes` redevient celui défini
   dans la collection (`read: Boolean(req.user)`). Conséquence : tout compte
   authentifié lirait toutes les fiches communes et leurs versions — c'est
   déjà le cas pour `read` (`src/collections/Communes.ts`, commentaire I8 :
   « lecture réservée aux authentifiés »), mais `readVersions` hériterait du
   défaut Payload (`Boolean(user)`) sans filtrage par commune.
2. **`access.readVersions` explicite sur `Communes`** : opérateur, ou admin
   de la commune concernée (`{ parent: { in: ids } }` — le champ des versions
   est bien `parent`). Contourne la contrainte dégénérée du plugin sans
   toucher à sa configuration globale ; même forme que l'accès `update`
   existant (`{ id: { in: ids } }`).
3. **Rapport/remontée amont** au plugin (la contrainte `version.id` pour la
   collection tenants est fausse pour toute collection versions) et correctif
   local en attendant.

## Recommandation

L'option **2** : un `readVersions` explicite sur `Communes` rendu par les ids
des communes où l'utilisateur est admin (`{ parent: { in: ids } }`), opérateur
court-circuité — même grain que l'accès `update` de la collection, aucune
portée globale, et le test B10 reprend sa forme voulue (`totalDocs > 0` pour
SA commune, 0 pour l'autre). Coût si erreur : aucun (état actuel déjà
défaillant) ; l'option 1 élargirait la lecture des fiches à tous les
authentifiés sans garde par commune, ce qui n'est pas le sujet de ce plan.

Le test du point B10, dans `tests/int/communes-apparence.int.spec.ts`,
épingle aujourd'hui le comportement observé (0 pour SA commune) avec renvoi
ici, pour que la suite reste verte et qu'un futur correctif le fasse
basculer.
