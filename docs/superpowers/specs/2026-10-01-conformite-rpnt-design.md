# Conformité au référentiel de l'État (RPNT) : pdlm met la commune en règle et l'y garde (design)

Date : 2026-10-01 · Statut : **brouillon, à relire par l'utilisateur** · Branche `spec-conformite-rpnt`

## Contexte

L'ANCT publie le **Référentiel de la Présence Numérique des Territoires** (RPNT v0.2.2, publié le 31/08/2026, `suiteterritoriale.anct.gouv.fr/conformite/referentiel`). Elle vérifie la conformité de chaque commune tous les jours et publie le résultat en open data (data.gouv.fr, jeu `donnees-de-la-presence-numerique-des-territoires`, fichier `dpnt-quotidien.csv.gz`, une colonne `rpnt` qui liste les critères remplis).

Le référentiel dit ce qu'une commune doit faire. Il ne fournit pas l'outil qui le fait. Et **les mairies ne tiennent pas leurs déclarations à jour** (utilisateur, 01/10). La mesure du 01/10 le confirme (`guia/dns/shared/registry-data/ndd-communes/`) :

- En Corse, 46 communes ont un site qui répond alors que l'ANCT les marque non joignables. Pour **38** d'entre elles, la mairie n'a jamais déclaré le site à l'annuaire.
- En Bretagne à cinq départements, la même situation touche 70 communes, dont 29 sites jamais déclarés.

**Promesse** : une commune qui utilise pdlm est conforme au RPNT pour son site, et le reste sans que la secrétaire de mairie ait à y penser.

## Les critères visés

Les critères ci-dessous sont recopiés du référentiel lu le 01/10.

| Critère | Niveau | Ce que fait pdlm |
|---|---|---|
| 1.1 Site déclaré auprès de Service-Public.gouv.fr | Essentiel | **Prépare** la déclaration, vérifie qu'elle a abouti (section 3) |
| 1.2 Extension de domaine souveraine | Essentiel | **Guide** le choix du nom à la création (section 2) |
| 1.3 Site joignable | Essentiel | Garanti par l'hébergement, **surveillé** (section 4) |
| 1.4 HTTPS | Essentiel | Garanti par construction (Caddy, certificat automatique) |
| 1.5 Certificat valide | Essentiel | Garanti, **surveillé** (expiration) |
| 1.6 Pas de redirection vers un site non officiel | Essentiel | Garanti : pdlm sert lui-même le domaine canonique |
| 1.7 Redirections d'usage (`www` ↔ apex) | Recommandé | Garanti par la config des domaines, **surveillé** |
| 1.8 Adresse déclarée en HTTPS | Recommandé | Couvert par la déclaration préparée (section 3) |
| 2.1 à 2.8 Messagerie | — | **Affichage seul** (hors périmètre, voir plus bas) |

L'extension souveraine (1.2) couvre `.fr` ; les régionales `.alsace`, `.bzh`, `.corsica`, `.paris`, `.eu` ; et les ultramarines `.re`, `.yt`, `.gp`, `.mq`, `.gf`, `.pm`, `.wf`, `.tf`, `.nc`, `.pf`. Les IDN (noms avec accents) ne sont pas conformes, sous leurs deux écritures.

## 1. Code INSEE sur la fiche commune

Un nouveau champ `codeInsee` (5 caractères, `2A`/`2B` admis) sur `Communes`. C'est la clé qui relie la commune à l'annuaire de Service-Public et à la ligne ANCT. Il est obligatoire pour afficher l'état de conformité, mais **pas pour activer la commune** : une commune peut être en ligne avant d'avoir son code.

## 2. Choix du nom de domaine à la création

À l'ajout d'un domaine canonique, pdlm propose les formes recommandées par l'ANCT, dans cet ordre :

1. `nomdelacommune.<ext>`
2. `mairie-nomdelacommune.<ext>`
3. `ville-nomdelacommune.<ext>`
4. en cas d'homonymie : `nomdelacommune<n° de département>.<ext>`

Le nom de la commune est mis en minuscules, sans accent ni caractère spécial, et les espaces et apostrophes sont remplacés par des tirets. L'extension proposée en premier est le `.fr`. Si la commune est dans un territoire qui a un geoTLD (`.bzh` : 22, 29, 35, 56, 44 ; `.corsica` : 2A, 2B ; `.alsace` : 67, 68), cette extension est proposée **à égalité**, sans être imposée. pdlm ne vérifie pas la disponibilité du nom et ne vend pas de noms : il renvoie vers le guide de l'ANCT.

**Un choix non conforme n'est jamais bloqué** (`.com`, IDN, nom hors nomenclature). Il est signalé à l'écran, avec le critère concerné (I35).

## 3. Déclaration à l'annuaire (critères 1.1 et 1.8)

pdlm **n'écrit jamais dans un système de l'État** (I32). Il prépare la déclaration, et un humain l'envoie :

- Quand le domaine canonique d'une commune active diffère du site lu dans l'annuaire, ou si l'annuaire n'en déclare aucun, l'admin affiche une carte **« Déclarer votre site »**.
- La carte donne le lien direct vers la fiche de la mairie (`service_public_url` de la ligne ANCT), le chemin à suivre (« Mettre cette page à jour » → section « Contacts web »), et l'adresse à coller, au format `https://<domaine canonique>`.
- Une case « C'est envoyé » enregistre la date d'envoi.
- pdlm relit l'annuaire, puis la ligne ANCT, jusqu'à constater la mise à jour. L'annuaire annonce un délai d'examen de 48 heures. Si rien n'a changé après 7 jours, la carte revient avec la mention « Pas encore pris en compte ».

## 4. Surveillance

Une tâche quotidienne vérifie, pour chaque domaine canonique de commune active :

- que le domaine est joignable **depuis l'extérieur de la plateforme**, ce qui exclut un test en boucle locale ;
- que le certificat expire dans plus de 14 jours ;
- que la redirection `www` ↔ apex fonctionne.

En parallèle, pdlm télécharge le fichier ANCT du jour et en extrait la ligne de chaque commune à partir de son code INSEE.

## 5. Tableau de conformité dans l'admin

Pour chaque critère 1.x, l'admin affiche un état vert, rouge ou inconnu. **Chaque état porte sa source et sa date** (I33) : « notre mesure, ce matin » ou « mesure de l'État, fichier du 01/10 ». Quand les deux divergent, les deux sont affichés, et pdlm ne tranche pas. Les critères 2.x sont affichés à titre d'information, sans action proposée.

## 6. Alertes

Quand un critère passe au rouge, une notification part vers l'admin de la commune et vers l'opérateur (l'EPCI). Un récapitulatif mensuel liste les critères rouges de toutes les communes de la plateforme.

## Invariants

- **I32** pdlm n'écrit jamais dans un système de l'État (annuaire, ANCT). Il prépare, un humain envoie.
- **I33** Un état de conformité affiché porte toujours sa source (pdlm ou État) et sa date.
- **I34** Aucune donnée personnelle ne sort de pdlm pour ces vérifications : pdlm ne lit l'extérieur qu'avec des données publiques (domaine, code INSEE).
- **I35** Un choix de domaine non conforme n'est jamais bloqué, toujours signalé.

⚠️ La numérotation reprend après I31, le plus haut numéro trouvé dans les specs des branches `umami-collecte`, `gabarits-couleurs` et `multilingue-socle` le 01/10. Elle est à confirmer si une autre spec en cours en a pris.

## Hors périmètre

- **Messagerie (critères 2.1 à 2.8)** : pdlm ne gère pas les boîtes mail des communes. Le tableau les affiche à partir de la ligne ANCT, sans plus.
- **Achat et renouvellement du nom** : c'est un bureau d'enregistrement qui s'en charge, pas pdlm.
- **Remontée d'informations à l'ANCT** : écartée (utilisateur, 01/10).

## Questions ouvertes (à trancher par l'utilisateur)

1. **Écriture à l'annuaire** : existe-t-il une voie pour les opérateurs (EPCI, OPSN) autre que le formulaire de la mairie ? Je n'ai rien vérifié et je ne suppose rien. La spec part du formulaire.
2. **Destinataires des alertes** : la secrétaire, le maire, l'EPCI ? Proposition : l'admin de la commune et l'opérateur, jamais le maire par défaut.
3. **Dépendance au fichier ANCT** : son format n'est pas versionné (une colonne `rpnt` en texte libre). Si le fichier change ou disparaît, pdlm continue avec sa seule mesure et l'indique (« mesure de l'État indisponible »). Ça convient ?
4. **Messagerie** : doit-elle rester hors périmètre, ou pdlm propose-t-il au moins le bon enregistrement DMARC (critères 2.6 et 2.7) quand il gère la zone DNS ?

## Tests

- **Générateur de nomenclature** : accents, apostrophes (« L'Île-Rousse »), communes en `Saint-`, homonymes, codes `2A`/`2B`, rejet du nom IDN comme proposition.
- **Rapprochement INSEE ↔ ligne ANCT** : sur le fichier réel du 01/10, aucune commune n'est perdue à cause du format du code (zéros initiaux, `2A`).
- **Surveillance** : certificat à J-13 → alerte ; redirection `www` cassée → critère 1.7 au rouge ; domaine injoignable de l'extérieur mais joignable en local → rouge.
- **Carte de déclaration** : elle apparaît, se masque après « C'est envoyé », et revient après 7 jours sans changement.
