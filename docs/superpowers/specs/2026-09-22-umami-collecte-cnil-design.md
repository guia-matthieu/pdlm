# Mesure d'audience — projet A : collecte conforme CNIL (design)

Date : 2026-09-22 · Statut : validée par l'utilisateur le 23/09 ; points de lecture confirmés par exécution le 23/09

## Contexte et décisions

pdlm installe **Umami** (v3.4.0, publié le 16/09/2026) pour mesurer l'audience des sites communaux, **sans bandeau de consentement** : la collecte doit rester dans l'exemption de la CNIL, avec toutes les fonctions que cette exemption permet et aucune autre.

Décisions prises avec l'utilisateur :

- **Qui voit.** L'EPCI voit chaque commune séparément dans l'interface Umami ; chaque maire reçoit un lien de partage (vue d'ensemble seule) ; les chiffres dans l'admin pdlm font l'objet du **projet B**.
- **La commune décide.** Interrupteur sur la fiche commune, coupé par défaut, manœuvré par l'admin de la commune, journalisé.
- **Couper ne détruit rien.** La collecte s'arrête, l'historique reste jusqu'à la purge à 25 mois. Effacer est un acte séparé : un bouton « Supprimer l'historique ».
- **Architecture : option 1.** Même Postgres que pdlm (base `umami`, rôle dédié), collecte sur le domaine de la commune, interface Umami sur `stats.<plateforme>`, pdlm pilote Umami par son API.
- **Le relais de collecte est une route de pdlm, pas un fragment Caddy** (section 1).

Hors périmètre de ce projet : le tableau de bord dans l'admin pdlm (projet B, qui affichera aussi la date de la dernière visite reçue pour qu'une panne ne passe pas inaperçue) ; les événements nommés (téléchargements de documents) ; la mesure de performance (Web Vitals) ; la limitation de débit du relais ; la régénération du lien de partage ; la synchronisation du nom et du domaine de la commune vers Umami ; la création automatique des comptes EPCI.

Invariants numérotés à partir de I18 : I14 à I17 sont pris par la spec multilingue (branche `multilingue-socle`).

## Conformité : conditions de l'exemption et réponse de la conception

Conditions lues le 22/09 dans la fiche CNIL n° 16, la page CNIL « mesure d'audience » et le projet de recommandation du 25/02/2026 sur le rejeu de session. **Ce tableau n'est pas un avis juridique** : le texte d'information (section 4) est une proposition à valider par l'opérateur et le délégué à la protection des données.

| Condition                                                                   | Réponse                                                                                                                                                                                 |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalité limitée à la mesure d'audience du site, pour le seul éditeur       | Un site Umami par commune ; l'empreinte de session d'Umami inclut l'identifiant du site, aucune visite n'est reliée d'une commune à l'autre ; pas de tableau multi-communes (section 2) |
| Données collectées, traitées et stockées indépendamment pour chaque éditeur | Idem ; l'EPCI agit comme sous-traitant de chaque commune                                                                                                                                |
| Adresse IP tronquée                                                         | Dernier octet en IPv4, 80 derniers bits en IPv6 (garde le /48), **avant** tout envoi à Umami (I18)                                                                                      |
| Géolocalisation pas plus fine que la ville                                  | Umami la déduit de l'IP déjà tronquée ; les en-têtes de géolocalisation fournis par le client sont ignorés                                                                              |
| Information des personnes et droit d'opposition                             | Page fixe `/mesure-d-audience` et formulaire d'opposition sans JavaScript (section 4, I20)                                                                                              |
| Traceurs : 13 mois au plus                                                  | Le script Umami ne pose aucun cookie ni stockage local ; seul le cookie d'opposition existe, 13 mois                                                                                    |
| Conservation : 25 mois au plus                                              | Purge quotidienne (section 5, I21)                                                                                                                                                      |
| Pas de rejeu de session, de carte de chaleur, d'identification              | Coupés par le relais, qui ne transmet que la page vue ; `/api/record` jamais joignable (I22)                                                                                            |

## 1. Architecture

**Services ajoutés** (`docker-compose.yml`) :

- **`umami`** : image officielle 3.4.0, épinglée par empreinte comme MinIO. Aucun port publié. Variables : `DATABASE_URL` (rôle `umami`), `APP_SECRET`, `DISABLE_TELEMETRY=1`, `DISABLE_UPDATES=1`, `CLIENT_IP_HEADER=x-pdlm-ip`, `SKIP_LOCATION_HEADERS=1`. Vérification de santé sur `/api/heartbeat`.
- **`init-umami`** : service ponctuel, calqué sur `createbuckets`. Il crée le rôle `umami` et la base `umami` s'ils n'existent pas (idempotent). Les scripts d'initialisation de Postgres ne tournent que sur un volume vide : sans ce service, une installation existante n'aurait jamais la base.
- **`purge-mesure`** : section 5.

**Trajet d'une page vue** :

1. pdlm rend la page. Si la mesure de la commune est active et que le visiteur ne s'y est pas opposé, la mise en page ajoute le script (section 3). Tout est sur le domaine de la commune : la CSP ne change pas (`script-src 'self'`, `connect-src 'self'`), et aucune variable `NEXT_PUBLIC_*` n'est lue à la compilation.
2. Le script poste la visite à `/mesure/api/send`, sur le domaine de la commune.
3. Le **relais** (route de pdlm) retrouve la commune par le domaine, filtre, tronque l'IP et transmet à `UMAMI_URL` sur le réseau interne (section 3).
4. L'**interface Umami** est servie sur `stats.<plateforme>` par un bloc Caddy unique pour toute la plateforme. Ce bloc renvoie 404 sur tous les chemins de collecte, sinon on pourrait contourner le relais en postant directement à Umami (I22).
5. pdlm appelle l'**API Umami** avec une clé serveur : créer le site d'une commune, son lien de partage, effacer son historique, supprimer le site.

**Pourquoi un relais dans pdlm plutôt qu'un fragment Caddy par commune** (constats tirés du code source d'Umami, lu mais pas encore exécuté) :

- Umami accepte un champ `ip` dans le corps JSON, **prioritaire sur les en-têtes** (`src/lib/detect.ts` l. 138). Il accepte aussi `id` (identification d'un visiteur), `userAgent`, `timestamp`, `browser`, `os`, `device`, et fait confiance aux en-têtes de géolocalisation `cf-ipcity` et apparentés. Tronquer l'IP dans un en-tête Caddy ne suffit donc pas : seul un relais qui lit le corps peut retirer ces champs.
- Le Caddyfile de production a un bloc par commune, écrit à la main : un fragment oublié, et une commune n'est plus mesurée, sans rien signaler.
- En développement il n'y a pas de Caddy : le relais dans pdlm tourne à l'identique en développement, en test et en production.

**Coût** : chaque page vue fait une petite requête POST au serveur Node de pdlm. La mémoire prise par Umami est à mesurer à l'implémentation.

**Variables lues par pdlm** : `UMAMI_URL` (adresse interne, `http://umami:3000` en production), `UMAMI_API_KEY`, `UMAMI_TEAM_ID`, `UMAMI_PUBLIC_URL` (`https://stats.<plateforme>`). **Sans `UMAMI_URL`, la fonction n'existe pas** : l'interrupteur est grisé avec la mention « Mesure d'audience non installée sur cette plateforme », le script n'est jamais ajouté, le relais répond 404. `.env.example` reçoit ces variables plus `UMAMI_DB_PASSWORD` et `UMAMI_APP_SECRET` (fichier sous règle de refus : lignes fournies à l'utilisateur, qui les colle lui-même).

## 2. Données, création du site de chaque commune, historique

**Installation, une fois par plateforme, par l'opérateur** (4 étapes documentées dans le README) : se connecter à Umami avec le compte administrateur et changer son mot de passe ; créer un compte technique `pdlm` et sa clé d'API ; créer une équipe au nom de l'EPCI, avec `pdlm` pour membre ; ajouter les agents de l'EPCI à l'équipe en **lecture seule**. Règle documentée : ne pas créer de tableau (« board ») réunissant plusieurs communes.

**I6 élargi** : le nom de `UMAMI_PUBLIC_URL` (`stats.<plateforme>`) rejoint `hostnamesReserves()` ; aucune commune ne peut le prendre comme domaine.

**Champs ajoutés à `communes`**, groupe « Mesure d'audience » :

| Champ                | Type                                        | Qui écrit                                                                                                 |
| -------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `mesure.active`      | case à cocher, défaut `false`               | admin de la commune ou opérateur (le rédacteur n'a déjà aucun droit d'écriture sur `communes`)            |
| `mesure.siteUmami`   | texte (UUID), en lecture seule dans l'admin | le hook seulement                                                                                         |
| `mesure.lienPartage` | texte (URL), en lecture seule               | le hook seulement ; description : « À transmettre au maire : vue d'ensemble, sans le détail des visites » |

**Première activation** (hook `beforeChange` de `communes`, passage de `active` à `true` sans `siteUmami`) :

1. Identifiant du site = **UUID v5** calculé à partir de `PLATFORM_DOMAIN` et de l'identifiant de la commune. L'API Umami accepte un identifiant fourni (`POST /api/websites` avec `id`). Si l'enregistrement pdlm échoue après la création dans Umami, un nouvel essai retombe sur le même site au lieu de laisser un orphelin : un conflit à la création est suivi d'un `GET /api/websites/:id` qui confirme l'existence.
2. `POST /api/websites` avec `name` = nom de la commune, `domain` = domaine canonique (informatif seulement), `teamId` = `UMAMI_TEAM_ID`.
3. `POST /api/websites/:id/shares` avec `parameters: { overview: true }` **seul**. Lu dans le code : le détail d'une session s'ouvre dès que `events`, `realtime` ou `revenue` est permis ; ces vues restent fermées.
4. `siteUmami` et `lienPartage` (`UMAMI_PUBLIC_URL/share/<slug>`) sont écrits dans `data`.

Si Umami ne répond pas ou refuse, **l'enregistrement est refusé** avec un message clair (« Le service de mesure d'audience ne répond pas ; la mesure reste coupée. Réessayez plus tard. »).

**Activation à la création d'une commune : refusée** avec un message (« Activez la mesure une fois la commune créée »). La commune n'a pas encore d'identifiant à ce moment-là (même piège que le défaut I6 de la v0.1.0) ; ce chemin est couvert par un test.

**Couper la mesure** : rien ne change dans Umami. Le script n'est plus ajouté et le relais refuse les visites de la commune.

**« Supprimer l'historique »** : bouton sur la fiche commune (champ `ui`, composant client de l'admin), visible quand `siteUmami` existe, réservé à l'admin de la commune et à l'opérateur, avec une confirmation qui dit ce qui sera effacé. Il appelle un point d'accès Payload `POST /api/communes/:id/mesure/effacer`, qui vérifie les droits puis appelle `POST /api/websites/:id/reset` d'Umami. D'après le code, cette remise à zéro efface `website_event`, `event_data`, `session`, `session_data`, `session_link`, `revenue`, `session_replay*` et `heatmap_event`, et garde le site et son lien de partage. L'entrée de journal est écrite après la confirmation d'Umami.

**Suppression d'une commune** : son site Umami est supprimé (`DELETE /api/websites/:id`) dans `afterDelete`, donc dans la transaction de suppression : si Umami ne répond pas, la suppression de la commune est refusée. Si Umami a supprimé le site mais que la transaction échoue ensuite, la prochaine activation recrée le même identifiant.

**I12 élargi, journal** : trois messages explicites, « Mesure d'audience activée — <commune> », « Mesure d'audience désactivée — <commune> », « Historique de mesure effacé — <commune> ». Aujourd'hui le journal n'écrit que « Modification — <commune> ».

## 3. Le relais et le script

**Routes** (groupe `(frontend)`, comme `robots.txt`) :

- `GET /mesure/script.js` : récupère `UMAMI_URL/script.js`, le garde en mémoire une heure, le sert avec `Cache-Control: public, max-age=3600`. Le script reste ainsi à la version d'Umami installée, sans copie dans le dépôt.
- `POST /mesure/api/send` : le relais.
- `POST /mesure/opposition` : section 4.

Ces chemins ne commencent pas par `/api` : le proxy (I7) les traite comme le front public et pose `x-commune-host`. Sur le domaine de la plateforme, aucune commune n'est résolue et ils répondent 404. `mesure` et `mesure-d-audience` rejoignent `SLUGS_RESERVES`.

**Balise ajoutée par la mise en page** (commune active, pas d'opposition, `UMAMI_URL` défini) :

```html
<script
  defer
  src="/mesure/script.js"
  data-website-id="<siteUmami>"
  data-host-url="/mesure"
  data-exclude-search="true"
  data-exclude-hash="true"
  data-do-not-track="true"
  data-fetch-credentials="same-origin"
></script>
```

`data-host-url="/mesure"` fait poster le script à `/mesure/api/send` (lu dans `src/tracker/index.ts`). `data-fetch-credentials="same-origin"` fait suivre le cookie d'opposition jusqu'au relais. Le script respecte aussi l'en-tête « Do Not Track » du navigateur.

**Ce que fait le relais, dans l'ordre** :

1. Corps de plus de 4 Ko : 413.
2. Commune introuvable pour ce domaine, mesure coupée, `siteUmami` vide, ou cookie d'opposition présent : **204, rien n'est transmis**.
3. `type` autre que `event`, ou événement nommé (`name` présent) : 204, rien n'est transmis. Seules les pages vues passent.
4. Reconstruction du corps sur **liste blanche** :

   | Champ                                                                                                                                   | Traitement                                                                                  |
   | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
   | `website`                                                                                                                               | **remplacé** par `siteUmami` de la commune du domaine, jamais la valeur du client           |
   | `hostname`                                                                                                                              | remplacé par le domaine demandé                                                             |
   | `url`                                                                                                                                   | chemin seul (requête et fragment retirés), doit commencer par `/`                           |
   | `referrer`                                                                                                                              | chemin seul si interne ; origine + chemin si externe ; requête et fragment toujours retirés |
   | `title`                                                                                                                                 | tronqué à 500 caractères                                                                    |
   | `screen`                                                                                                                                | gardé s'il est de la forme `1280x720`                                                       |
   | `language`                                                                                                                              | gardé si c'est une étiquette de langue de 35 caractères au plus                             |
   | tout le reste (`ip`, `id`, `userAgent`, `timestamp`, `data`, `tag`, `browser`, `os`, `device`, `link`, `pixel`, mesures de performance) | **retiré**                                                                                  |

5. **IP du visiteur** : en production, la valeur **la plus à droite** de `X-Forwarded-For`, celle qu'ajoute Caddy, qui est le seul mandataire. Umami, lui, lit la plus à gauche, que le client peut forger. En développement, sans Caddy, pas d'IP : l'en-tête est omis et Umami ne localise pas.
6. **Troncature** : IPv4 → `a.b.c.0` ; IPv6 → 48 premiers bits gardés, le reste à zéro ; IPv4 encapsulée dans de l'IPv6 → règle IPv4 ; valeur illisible → omise.
7. **En-têtes transmis, et eux seuls** : `content-type`, `user-agent` de la requête, `x-pdlm-ip` (IP tronquée) et `x-umami-cache` s'il est présent (jeton signé par Umami, gardé en mémoire par le script). `SKIP_LOCATION_HEADERS=1` fait de toute façon ignorer à Umami les en-têtes de géolocalisation.
8. Envoi à `UMAMI_URL/api/send`, délai de 3 s. La réponse d'Umami (statut et JSON) est renvoyée au script. Si Umami ne répond pas : 204 au visiteur, une ligne d'avertissement dans les journaux du serveur (au plus une par minute).

**I18** — Aucune adresse IP complète ni aucun champ hors liste blanche ne sort de pdlm vers Umami.
**I19** — Umami ne reçoit une visite que d'une commune dont la mesure est active, et toujours sous l'identifiant de site de la commune du domaine demandé.

## 4. Information et opposition

**Page fixe `/mesure-d-audience`**, rendue par pdlm à partir de la fiche commune, et non page éditable : l'agent n'a rien à rédiger, et rien ne peut la casser. Elle dit :

- qui mesure (la commune, responsable du traitement ; l'EPCI ou l'opérateur, sous-traitant) et pourquoi (connaître la fréquentation des pages pour améliorer le site) ;
- ce qui est collecté : page vue, page d'origine, navigateur, système, type d'appareil, taille d'écran, langue, pays, région et ville approximatifs déduits d'une adresse IP tronquée ;
- ce qui ne l'est pas : adresse IP complète, cookie de mesure, identifiant durable, suivi d'un site à l'autre, enregistrement des gestes ;
- la durée de conservation : 25 mois ;
- l'état pour ce visiteur (« Vos visites sont comptées de façon anonyme » ou « Vous vous êtes opposé à la mesure ») et le bouton correspondant.

Si la mesure de la commune est coupée, la page le dit (« Ce site ne mesure pas son audience »).

**Opposition sans JavaScript** : un formulaire `POST /mesure/opposition` (`choix=refus` ou `choix=accepte`). Le refus pose le cookie `pdlm_mesure=refus` (`HttpOnly`, `SameSite=Lax`, `Secure` en production, `Path=/`, 13 mois) ; l'acceptation l'efface. Réponse 303 vers `/mesure-d-audience`. Un cookie qui ne sert qu'à respecter l'opposition est lui-même exempté.

**Liens** : « Mesure d'audience » dans le pied de page, à côté des liens légaux, quand la mesure est active. Le texte de la page `confidentialite` du seed renvoie à `/mesure-d-audience`.

**I20** — Un visiteur qui s'est opposé n'est plus mesuré : le script n'est pas ajouté et le relais refuse ses visites.

## 5. Purge à 25 mois et sauvegardes

**Service `purge-mesure`** : image `postgres:17-alpine` (celle de la base), boucle qui exécute `scripts/purge-mesure.sql` au démarrage puis toutes les 24 h, avec le rôle `umami` et `ON_ERROR_STOP`. Pas de tâche dans l'application : pdlm n'a pas et ne doit pas avoir les identifiants de la base `umami`.

Le script SQL, dans une transaction, supprime ce qui a plus de 25 mois (`created_at < now() - interval '25 months'`) dans `event_data`, `session_data`, `revenue`, `heatmap_event`, `session_replay`, `session_replay_saved`, `website_event` et `session_link`, puis les lignes de `session` de plus de 25 mois qui n'ont plus aucun événement. Il affiche le nombre de lignes supprimées par table. Noms de tables et de colonnes relevés dans `prisma/schema.prisma` d'Umami 3.4.0 ; le SQL définitif est écrit et testé contre une vraie base Umami (section 6).

**I21** — Aucune donnée de mesure de plus de 25 mois dans la base `umami`.

**Sauvegardes** : `backup.sh` ajoute `umami.sql.gz` (`pg_dump` de la base `umami`, mêmes contrôles d'intégrité que la base pdlm). Umami n'a pas besoin d'être arrêté : un `pg_dump` est cohérent pour une base à lui seul. `restore.sh` restaure `umami.sql.gz` s'il est présent ; une sauvegarde plus ancienne, sans ce fichier, se restaure toujours. Le README rappelle qu'une sauvegarde de plus de 25 mois contient des données de mesure à supprimer.

## 6. Caddy, développement, tests

**Caddyfile d'exemple** : un bloc `stats.<plateforme>` qui renvoie 404 sur `/api/send`, `/api/batch`, `/api/record`, `/script.js`, `/recorder.js`, `/p/*` et `/q/*` (chemins de collecte, de rejeu, de pixels et de liens relevés dans le code), et `reverse_proxy umami:3000` pour le reste. `Caddyfile.dev` reçoit un bloc `stats.localhost` identique.

**I22** — La collecte n'est joignable que par le relais : le conteneur `umami` n'a aucun port publié et les chemins de collecte répondent 404 sur `stats.<plateforme>`.

**Développement** : `docker-compose.dev.yml` reçoit `umami` (publié sur `127.0.0.1:3002`) et `init-umami` ; `UMAMI_URL=http://127.0.0.1:3002`.

**Tests unitaires** : troncature (IPv4, IPv6, IPv4 encapsulée, valeur illisible) ; choix de la valeur de droite de `X-Forwarded-For` ; filtrage du corps (chaque champ interdit retiré, `website` et `hostname` remplacés, requête et fragment retirés de `url` et `referrer`) ; UUID v5 stable pour une même commune ; lecture du cookie d'opposition.

**Tests d'intégration** (Postgres réel, **faux serveur Umami** qui enregistre ce qu'il reçoit) :

- le relais : ce que reçoit le faux Umami pour une requête qui contient `ip`, `id`, `userAgent`, des en-têtes `cf-*` et un `X-Forwarded-For` forgé à gauche (I18) ; refus quand la mesure est coupée, quand le cookie d'opposition est présent, quand le domaine est celui d'une autre commune ou de la plateforme (I19, I20) ;
- droits : l'admin de la commune active la mesure, l'admin d'une autre commune et le rédacteur ne le peuvent pas ;
- activation : appels au faux Umami (identifiant déterministe, partage `overview` seul) ; refus quand le faux Umami est arrêté ; refus d'une activation à la création ;
- effacement de l'historique : droits, appel de remise à zéro, entrée de journal ;
- suppression d'une commune : appel `DELETE`, refus quand Umami est arrêté ;
- journal : les trois messages.

La CI n'a pas besoin d'un conteneur Umami. L'image `umami` rejoint le job Trivy non bloquant des images tierces.

**Tests de bout en bout** : une commune active porte la balise ; après un refus par le formulaire, la balise disparaît, et elle revient après acceptation ; `/mesure-d-audience` est accessible au clavier et atteinte depuis le pied de page.

**Recette sur une pile de type production** (manuelle, notée dans le README), avec Umami réel :

- une page vue arrive dans `website_event`, avec pays et ville renseignés ;
- ce que reçoit pdlm dans `X-Forwarded-For` quand le client en envoie un faux (comportement de Caddy vérifié, pas supposé) ;
- `curl` sur les chemins bloqués de `stats.<plateforme>` : 404 ;
- purge : des lignes vieillies à la main disparaissent, les récentes restent ;
- aller-retour `backup.sh` puis `restore.sh` qui inclut la base `umami` ;
- mémoire consommée par le conteneur `umami`.

## Points vérifiés par exécution (23/09/2026)

Umami 3.4.0 lancé sur une base jetable, API appelée avec une clé d'API réelle. Les sept points « lus, non exécutés » sont confirmés, avec des précisions qui changent l'implémentation :

| Point | Résultat |
| --- | --- |
| Identifiant de site fourni | Accepté par `POST /api/websites`. Un doublon répond **500 sans corps** (pas une erreur exploitable) ; `GET /api/websites/:id` d'un site absent répond **401**, pas 404. C'est donc la lecture qui tranche après un échec de création. |
| Rôle du compte `pdlm` dans l'équipe | `team-member` suffit pour créer, partager, remettre à zéro et supprimer ; `team-view-only` reçoit 401. Clés d'API actives hors `CLOUD_MODE`, en `Authorization: Bearer umami_…` ; `/api/me` les accepte, ce qui distingue une clé refusée d'un site absent. |
| Vues d'un lien de partage `overview` seul | Avec l'en-tête `x-umami-share-context: 1` (celui de l'interface de partage) : statistiques, courbe des pages vues et métriques (pages, villes) lisibles ; sessions, détail d'une session, événements, données d'événements, temps réel, rapports et tout autre site refusés (401). |
| Remise à zéro | Visites et sessions effacées ; site et lien de partage conservés. `DELETE /api/websites/:id` est **définitif** (partage compris) et recréer le même identifiant fonctionne ; un second `DELETE` répond 401. |
| Base de géolocalisation | `/app/geo/GeoLite2-City.mmdb` (66 Mo) présente ; une IP tronquée transmise en `x-pdlm-ip` donne pays et ville. |
| Tables et colonnes de la purge | Les huit tables existent, toutes avec `created_at` ; `relationMode = "prisma"` : aucune clé étrangère en base. |
| Image | `ghcr.io/umami-software/umami:3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367` (index amd64 + arm64). |

Constat supplémentaire : un champ `ip` dans le corps l'emporte bien sur l'en-tête d'IP (`8.8.8.8` a localisé la visite aux États-Unis malgré un en-tête tronqué français). Le filtrage du corps par le relais est donc indispensable, pas une précaution.

**Amendements à la conception, tirés de ces vérifications :**

- **Services Umami dans un profil Compose `mesure`** : `${X:?}` dans `docker-compose.yml` fait refuser toute la pile, même profil inactif (vérifié). La mesure reste optionnelle ; les variables manquantes sont refusées par les conteneurs eux-mêmes.
- **`/api/batch` rejoint les chemins bloqués** sur `stats.<plateforme>` : c'est une seconde porte de collecte (I22).
- **Le relais répond 204** (et non 404) sur le domaine de la plateforme : c'est le cas « commune introuvable » de l'étape 2. Le script et le formulaire d'opposition, eux, répondent 404.
- Next n'ajoute `X-Forwarded-For` que s'il est absent (`??=`, `base-server.js`) : la valeur de droite est celle de Caddy en production, l'adresse locale en développement (écartée par le relais).

Plan d'implémentation : `docs/superpowers/plans/2026-09-23-umami-collecte-cnil.md`.

## Risques connus et acceptés

- **Visites fictives** : le relais n'a pas de limite de débit ; quelqu'un peut gonfler les chiffres d'une commune. Pas de fuite de données ; à traiter si cela arrive.
- **Tableau multi-communes** : le compte administrateur d'Umami peut en créer un ; seule la règle documentée l'en empêche.
- **Panne silencieuse** : si Umami tombe, les sites fonctionnent mais ne sont plus mesurés. Le projet B affichera la date de la dernière visite reçue.
