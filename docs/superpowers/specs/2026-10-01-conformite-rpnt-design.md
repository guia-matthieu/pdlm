# Conformité au référentiel de l'État (RPNT) : pdlm met la commune en règle et l'y garde (design)

Date : 2026-10-01 · Statut : **brouillon v3, à relire** (réponses de l'utilisateur du 01/10 intégrées, modèle opérateur / mandataire / commune tranché) · Branche `spec-conformite-rpnt`

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
| 2.1 à 2.8 Messagerie | — | **Informe et renvoie** vers les bonnes pratiques, sans agir (section 7) |

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

pdlm **n'écrit jamais dans un système de l'État** (I32). Il prépare la déclaration, et un humain l'envoie.

**Le formulaire, lu le 01/10 sur la fiche de Quimper** : `<service_public_url>/demande-de-mise-a-jour`. Il est « réservé aux services publics », ne demande **ni compte ni ProConnect**, seulement une adresse électronique, et comprend une section « Contacts web » avec 5 sites possibles. L'URL de la fiche (`service_public_url`) figure dans la ligne ANCT de la commune. Le lien vers le formulaire se construit donc sans recherche.

- Quand le domaine canonique d'une commune active diffère du site lu dans l'annuaire, ou si l'annuaire n'en déclare aucun, l'admin affiche une carte **« Déclarer votre site »**.
- La carte donne le **lien direct vers le formulaire** et l'adresse à coller, au format `https://<domaine canonique>`, dans « Site web n°1 ».
- La carte est visible par l'admin de la commune, **par ses mandataires** et par l'opérateur (section 8). Un EPCI ou une ville mandataire est un service public : il peut envoyer la demande pour la commune. ⚠️ On ne sait pas encore si la DILA accepte une demande venue de l'EPCI pour la fiche d'une commune. À tester sur un cas réel avant de l'écrire dans l'aide.
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

## 7. Vérification de la messagerie (information, sans action)

pdlm ne gère pas les boîtes mail, mais la conformité de la commune en dépend : sa messagerie utilise le même nom de domaine que son site. Un module **« Votre messagerie »** affiche, pour le domaine canonique :

| Critère | Mesure | Source |
|---|---|---|
| 2.4 MX configuré | Requête DNS publique | pdlm |
| 2.5 SPF configuré | Requête DNS publique (TXT `v=spf1`) | pdlm |
| 2.6 DMARC configuré | Requête DNS publique (`_dmarc.<domaine>`) | pdlm |
| 2.7 DMARC en quarantaine | Politique `p=quarantine` ou `p=reject` | pdlm |
| 2.1, 2.2, 2.3, 2.8 | Adresse déclarée, nom de domaine générique, correspondance avec le site, serveur dans l'UE | Ligne ANCT seule |

Pour chaque critère au rouge, le module donne **une phrase d'explication et un lien**, jamais une manipulation à faire dans pdlm :

- vers le critère du référentiel (ancre par critère, par exemple `suiteterritoriale.anct.gouv.fr/conformite/referentiel#2.6`), qui contient la rubrique « Comment s'y conformer » ;
- vers le guide de l'ANSSI que le référentiel cite (rubrique 5.4.1). L'adresse donnée par le référentiel redirige depuis le 01/10 vers `messervices.cyber.gouv.fr/guides/recommandations-relatives-linterconnexion-dun-si-internet` : relire le lien au moment de l'implémentation.

Le module s'adresse à la mairie et à son prestataire de messagerie. L'opérateur voit le même état pour toutes ses communes.

## Connexion par ProConnect (piste, hors de cette spec)

ProConnect est l'identifiant de l'État pour les agents publics. Il rattache chaque utilisateur au **SIRET de son organisation** (`partenaires.proconnect.gouv.fr`, lu le 01/10). Le référentiel le relie au nom de domaine : « il conditionne vos adresses de messagerie professionnelles et votre authentification sur ProConnect » (FAQ Domaines).

**Il n'ouvre pas l'annuaire** : le formulaire de mise à jour ne le demande pas (section 3). Son intérêt pour pdlm est ailleurs : servir de **connexion à l'admin**. La secrétaire se connecterait avec son compte d'agent, et le SIRET de la mairie suffirait à la rattacher à la bonne commune. C'est un projet à part : il touche les rôles et le multi-tenant, et demande une inscription comme fournisseur de service ProConnect. Il mérite sa propre spec.

## Invariants

- **I32** pdlm n'écrit jamais dans un système de l'État (annuaire, ANCT). Il prépare, un humain envoie.
- **I33** Un état de conformité affiché porte toujours sa source (pdlm ou État) et sa date.
- **I34** Aucune donnée personnelle ne sort de pdlm pour ces vérifications : pdlm ne lit l'extérieur qu'avec des données publiques (domaine, code INSEE).
- **I35** Un choix de domaine non conforme n'est jamais bloqué, toujours signalé.
- **I36** Un mandataire agit, la commune décide. Aucune action réservée à l'admin de la commune (utilisateurs, domaine canonique, activation, interrupteurs) n'est ouverte au mandataire. Tout mandat accordé ou retiré est journalisé.

⚠️ La numérotation reprend après I31, le plus haut numéro trouvé dans les specs des branches `umami-collecte`, `gabarits-couleurs` et `multilingue-socle` le 01/10. Elle est à confirmer si une autre spec en cours en a pris.

## Hors périmètre

- **Messagerie (critères 2.1 à 2.8)** : pdlm ne gère pas les boîtes mail. Il **informe** et **renvoie** vers les bonnes pratiques (section 7), sans jamais modifier la zone DNS ni la messagerie.
- **Connexion ProConnect** : spec à part.
- **Achat et renouvellement du nom** : c'est un bureau d'enregistrement qui s'en charge, pas pdlm.
- **Remontée d'informations à l'ANCT** : écartée (utilisateur, 01/10).

## Décisions et questions

**Tranché par l'utilisateur le 01/10** :
- Si le fichier ANCT change ou disparaît, pdlm continue avec sa seule mesure et l'indique (« mesure de l'État indisponible »).
- Messagerie : un module d'information avec un lien vers les bonnes pratiques (section 7).
- ProConnect : sorti de cette spec, devient une piste à spécifier à part.

## 8. Qui agit pour la commune : opérateur, mandataire, commune

*Tranché le 01/10. Constat de l'utilisateur : la plateforme peut être opérée par un prestataire (exemple : SITEC en Corse), par une mairie via ses services, ou par un EPCI via ses services pour le compte de ses communes membres. Et celui qui **héberge** n'est pas toujours celui qui **agit** pour une commune donnée.*

Le modèle sépare deux questions que le code confondait jusqu'ici dans le seul rôle `operateur` : **qui héberge la plateforme**, et **qui agit pour quelle commune**.

| Niveau | Qui | Portée | Existe ? |
|---|---|---|---|
| **Opérateur** | L'organisation qui **héberge** la plateforme, quelle que soit sa nature (prestataire, EPCI, ville, OPSN) | Toutes les communes de la plateforme | Oui (`operateur`) |
| **Mandataire** | Une organisation qui **agit pour le compte** d'une ou de plusieurs communes : services d'un EPCI, services d'une ville pour ses voisines, prestataire | Les seules communes qui l'ont mandatée | **Nouveau** |
| **Commune** | Les agents de la mairie | Leur commune | Oui (`admin`, `redacteur`) |

**Le mandat est un objet, pas un rôle collé à un utilisateur.** Il comprend :
- une organisation mandataire (nom, nature, SIRET),
- une commune,
- une date de début et une date de fin éventuelle,
- la personne qui l'a accordé.

Les utilisateurs d'une organisation mandataire héritent du rôle `mandataire` sur chacune des communes qui l'ont mandatée. Il n'y a donc pas de rôle `intercommunalité` : un EPCI, une ville et un prestataire relèvent du même mécanisme, et le SIRET préparera le rattachement par ProConnect.

**Règle de partage : le mandataire agit, la commune décide.**
- **Le mandataire peut** : voir la conformité, recevoir les alertes, préparer et envoyer la déclaration à l'annuaire (section 3), rédiger et publier les contenus. C'est le travail que « les mairies ne font pas ».
- **Il ne peut pas** : gérer les utilisateurs de la commune, changer le domaine canonique, activer ou désactiver la commune, ni manœuvrer les interrupteurs que la spec Umami réserve à l'admin de la commune (« la commune décide »).
- **Accorder et retirer un mandat** relève de l'admin de la commune ou de l'opérateur. Chaque mandat accordé ou retiré est journalisé (collection `Journal`).

**Cas couverts** :
- un EPCI héberge et agit pour ses communes : il est opérateur, et le mandat n'est pas nécessaire ;
- la SITEC héberge et un EPCI agit : la SITEC est opératrice, l'EPCI est mandataire de ses communes membres ;
- une ville héberge le site de ses voisines : elle est opératrice ou mandataire, selon qui fait tourner la plateforme ;
- une commune agit seule : ni mandat ni intermédiaire.

**Destinataires des alertes** : l'admin de la commune, les mandataires actifs de la commune et l'opérateur. Jamais le maire par défaut.

⚠️ **Ce que cette décision coûte** : une collection `Mandats`, un rôle `mandataire` dans `ROLES_COMMUNE`, et une relecture de toutes les fonctions d'accès (`src/access/index.ts`) pour y placer le mandataire, entre le rédacteur et l'admin. Le multi-tenant est touché : à planifier **avant** les sections 3 à 6, qui en dépendent pour les alertes et la carte de déclaration. Invariant ajouté : **I36**.

## Tests

- **Générateur de nomenclature** : accents, apostrophes (« L'Île-Rousse »), communes en `Saint-`, homonymes, codes `2A`/`2B`, rejet du nom IDN comme proposition.
- **Rapprochement INSEE ↔ ligne ANCT** : sur le fichier réel du 01/10, aucune commune n'est perdue à cause du format du code (zéros initiaux, `2A`).
- **Surveillance** : certificat à J-13 → alerte ; redirection `www` cassée → critère 1.7 au rouge ; domaine injoignable de l'extérieur mais joignable en local → rouge.
- **Module messagerie** : domaine sans MX → 2.4 au rouge ; DMARC `p=none` → 2.6 vert, 2.7 rouge ; chaque critère rouge affiche un lien qui répond 200.
- **Mandat** : un mandataire voit et agit sur ses seules communes ; il ne peut ni changer le domaine canonique, ni gérer les utilisateurs, ni toucher aux interrupteurs de la commune ; un mandat retiré coupe l'accès immédiatement et laisse une trace dans le Journal.
- **Carte de déclaration** : elle apparaît, se masque après « C'est envoyé », et revient après 7 jours sans changement.
