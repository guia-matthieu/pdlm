# pdlm — CMS pour petites communes françaises

CMS open source (AGPL-3.0) **multi-tenant** : une seule installation sert
plusieurs sites communaux indépendants (contenus, médias, rôles et domaines
cloisonnés par commune). Destiné aux organisations qui hébergent ces sites
pour le compte de communes — un EPCI, un syndicat mixte (SCEM) ou tout
prestataire mutualisé.

Construit avec [Payload 3](https://payloadcms.com/) sur [Next.js 16](https://nextjs.org/)
(App Router), PostgreSQL et un stockage compatible S3 (MinIO en développement).

## Sommaire

- [Prérequis](#prérequis)
- [Démarrage — développement](#démarrage--développement)
- [Démarrage — production](#démarrage--production)
- [Variables d'environnement](#variables-denvironnement)
- [Rôles et permissions](#rôles-et-permissions)
- [Ajouter une commune](#ajouter-une-commune)
- [Langues régionales](#langues-régionales)
- [Mesure d'audience](#mesure-daudience)
- [Politique de fichiers](#politique-de-fichiers)
- [Accessibilité (RGAA)](#accessibilité-rgaa)
- [Sauvegarde et restauration](#sauvegarde-et-restauration)
- [Tests](#tests)
- [Licence AGPL-3.0 — notice pour les opérateurs](#licence-agpl-30--notice-pour-les-opérateurs)
- [Signalement de sécurité](#signalement-de-sécurité)

## Prérequis

- [Node.js 22](https://nodejs.org/) (version exacte dans `.nvmrc` — `nvm use`)
- [Docker](https://www.docker.com/) et Docker Compose v2 (`docker compose`, pas `docker-compose`)
- `npm` (le dépôt utilise `package-lock.json`, pas `pnpm`/`yarn`)

## Démarrage — développement

En développement, seuls PostgreSQL et MinIO tournent dans Docker ; l'application
Next.js tourne directement sur la machine (rechargement à chaud).

```bash
cp .env.example .env        # compléter les variables — voir ci-dessous
docker compose -f docker-compose.dev.yml up -d
npm install
npm run seed                # comptes et contenus de démonstration
npm run dev                 # http://localhost:3000 (ou :3001 si le port est pris)
```

Comptes créés par le seed (mot de passe `demo1234`) :

| Email                   | Rôle                                          |
| ----------------------- | --------------------------------------------- |
| `operateur@pdlm.dev`    | Opérateur (accès à toutes les communes)       |
| `admin@saint-ex.fr`     | Administrateur de la commune de démonstration |
| `redacteur@saint-ex.fr` | Rédacteur de la commune de démonstration      |

Le site de la commune de démonstration est accessible en local via un
sous-domaine `*.localhost` (résolution loopback, aucune configuration DNS
requise) : `http://saint-ex.localhost:3000`. L'admin reste sur le domaine nu
(`http://localhost:3000/admin`).

Pour activer la mesure d'audience en développement (voir
[Mesure d'audience](#mesure-daudience)) :
`docker compose -f docker-compose.dev.yml --profile mesure up -d`, puis dans
`.env` : `UMAMI_URL=http://127.0.0.1:3002` et `UMAMI_API_KEY`,
`UMAMI_TEAM_ID`, `UMAMI_PUBLIC_URL=http://127.0.0.1:3002` obtenus comme en
production.

## Démarrage — production

```bash
cp .env.example .env         # POSTGRES_PASSWORD, PAYLOAD_SECRET, S3_APP_PASSWORD,
                              # MINIO_ROOT_PASSWORD obligatoires — le démarrage
                              # échoue explicitement si l'un manque
# éditer Caddyfile : remplacer pdlm.example.fr par le domaine de la plateforme,
# ajouter un bloc par commune (voir « Ajouter une commune »)
CADDY_FILE=./Caddyfile docker compose up --build -d
```

La pile de production (`docker-compose.yml`) : PostgreSQL et MinIO ne
publient **aucun** port sur l'hôte (réseau Docker interne uniquement) ; un
service `migrate` applique les migrations Postgres **avant** le démarrage de
l'application (pas de synchronisation automatique de schéma en production) ;
Caddy est l'unique point d'entrée exposé (80/443), avec certificats TLS
automatiques (Let's Encrypt) par domaine.

**Mettre à jour (nouvelle version, nouvelle migration)** : reconstruire les
images et recréer le conteneur `migrate` dans la même commande, puis
vérifier que la migration est bien passée :

```bash
CADDY_FILE=./Caddyfile docker compose up --build -d --force-recreate migrate app
docker compose logs migrate   # doit lister la migration appliquée (« Migrated: … »)
```

Sans `--force-recreate`, un ancien conteneur `migrate` déjà terminé avec
succès peut suffire à démarrer l'application sans que la nouvelle migration
ait tourné (voir la recette des [langues régionales](#langues-régionales)).

Vérification de bon fonctionnement : `GET /api/health` (utilisé par le
healthcheck Docker de l'application).

## Variables d'environnement

Voir `.env.example` pour le gabarit complet. Les valeurs par défaut ci-dessous
ne s'appliquent qu'à la pile de développement.

| Variable                                                      | Rôle                                                                                                                                             | Obligatoire en prod      |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `DATABASE_URI`                                                | Chaîne de connexion PostgreSQL                                                                                                                   | oui (généré par Compose) |
| `PAYLOAD_SECRET`                                              | Secret de signature (sessions, jetons) — aléatoire, jamais réutilisé                                                                             | **oui**                  |
| `ADMIN_URL`                                                   | Origine de l'interface d'administration (CORS/CSRF)                                                                                              | **oui**                  |
| `PLATFORM_DOMAIN`                                             | Domaine racine de la plateforme (résolution des sous-domaines communaux)                                                                         | **oui**                  |
| `DEFAULT_COMMUNE_SLUG`                                        | Commune servie sur un host local nu — **développement uniquement**, ignoré en production                                                         | non                      |
| `S3_ENABLED`                                                  | Active le stockage S3/MinIO (sinon disque local)                                                                                                 | oui (`true`)             |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`                       | Connexion au stockage objet                                                                                                                      | oui                      |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`                    | Identifiants S3 — en Compose, généré depuis `S3_APP_PASSWORD`                                                                                    | oui                      |
| `NEXT_PUBLIC_S3_PUBLIC_URL`                                   | Hostname du stockage, réservé pour qu'aucune commune ne puisse le revendiquer comme domaine                                                      | oui                      |
| `POSTGRES_PASSWORD`, `MINIO_ROOT_PASSWORD`, `S3_APP_PASSWORD` | Secrets d'infrastructure (Compose)                                                                                                               | **oui**                  |
| `CADDY_FILE`                                                  | Fichier Caddy à charger (`Caddyfile.dev` par défaut, démo sans TLS)                                                                              | oui (`./Caddyfile`)      |
| `COMPOSE_PROFILES`                                            | `mesure` pour installer la mesure d'audience (Umami)                                                                                             | non                      |
| `UMAMI_DB_PASSWORD`                                           | mot de passe du rôle Postgres `umami` (`openssl rand -hex 32`)                                                                                   | oui si `mesure`          |
| `UMAMI_APP_SECRET`                                            | secret d'Umami (`openssl rand -hex 32`)                                                                                                          | oui si `mesure`          |
| `UMAMI_URL`                                                   | adresse interne d'Umami (`http://umami:3000`) ; **vide = pas de mesure d'audience**                                                              | oui si `mesure`          |
| `UMAMI_API_KEY`                                               | clé d'API du compte technique `pdlm`                                                                                                             | oui si `mesure`          |
| `UMAMI_TEAM_ID`                                               | identifiant de l'équipe de l'EPCI dans Umami                                                                                                     | oui si `mesure`          |
| `UMAMI_PUBLIC_URL`                                            | `https://stats.<plateforme>` (interface, liens de partage ; réservé, I6)                                                                         | oui si `mesure`          |
| `UMAMI_DESINSTALLE`                                           | `1` seulement après une désinstallation délibérée (base `umami` supprimée) : autorise la suppression d'une commune qui a un historique de mesure | non                      |

`.env` n'est jamais versionné (`.gitignore`, `.dockerignore`). En production,
`PAYLOAD_SECRET`, `POSTGRES_PASSWORD`, `S3_APP_PASSWORD` et
`MINIO_ROOT_PASSWORD` doivent être générés aléatoirement (`openssl rand -hex 32`)
et non les valeurs de démonstration du gabarit.

## Rôles et permissions

Deux dimensions, toujours combinées :

- **Rôle plateforme** : `operateur` — personnel de l'organisation hébergeuse,
  accès à toutes les communes. Seul rôle plateforme en v0.1 (pas d'inscription
  publique ; les comptes sont créés par un opérateur).
- **Rôle par commune** (`tenants[].roles`) : `admin` (gère sa commune :
  contenus, domaines de sa commune, comptes de sa commune) ou `redacteur`
  (rédige des brouillons, ne publie pas). Un compte peut cumuler des rôles
  différents sur plusieurs communes.

Le sélecteur de commune de l'interface d'administration n'est **jamais** une
preuve d'autorisation : chaque contrôle d'accès recalcule les communes où
l'utilisateur détient effectivement le rôle requis.

## Ajouter une commune

1. Admin → _Communes_ → créer la commune (nom ; le slug est généré une fois
   puis figé — c'est aussi le sous-domaine de démonstration
   `<slug>.<PLATFORM_DOMAIN>`).
2. Admin → _Domaines_ → ajouter le nom de domaine réel de la commune
   (ex. `mairie-saintx.fr`), le marquer **canonique**. Une commune ne peut
   être activée sans au moins un domaine canonique.
3. **Vérification DNS** (hors de l'application — aucune automatisation en
   v0.1) : le titulaire du domaine crée un enregistrement pointant vers le
   serveur de la plateforme (`A`/`AAAA` vers l'IP publique, ou `CNAME` selon
   l'hébergeur), pour le domaine nu et son alias `www`. Vérifier la
   propagation avant de poursuivre :
   ```bash
   dig +short mairie-saintx.fr
   dig +short www.mairie-saintx.fr
   ```
4. Ajouter un bloc Caddy pour ce domaine (`Caddyfile`, cf. les blocs commentés
   en exemple) et recharger Caddy (`docker compose exec caddy caddy reload
--config /etc/caddy/Caddyfile`) — le certificat TLS est obtenu
   automatiquement au premier accès.
5. Admin → _Communes_ → activer la commune (`actif`). Une commune inactive
   renvoie 404 sur son site public sans supprimer ses données.
6. Créer les comptes `admin`/`redacteur` de la commune (Admin → _Utilisateurs_).

## Langues régionales

Une commune peut publier son site en langue régionale (le corse en v1), en
plus du français. **Le français est toujours actif et fait foi** : c'est la
langue de référence et la langue de repli ; les actes et l'affichage légal
restent en français. Voir la spec :
[`docs/superpowers/specs/2026-09-22-multilingue-socle-design.md`](docs/superpowers/specs/2026-09-22-multilingue-socle-design.md).

**Activer une langue :** admin de la commune (ou opérateur), fiche commune →
« Langues du site » → cocher la langue. Elle apparaît alors dans le
sélecteur de langue du site, et dans le sélecteur de langue de l'admin pour
cette commune.

**Domaine en langue régionale (facultatif) :** Admin → _Domaines_ → ajouter
le domaine (ex. `pigna.corsica`), choisir sa « Langue servie à la racine »
(la langue doit déjà être activée pour la commune) et le marquer
**canonique**. Un seul domaine canonique par commune **et par langue** ; le
canonique français reste requis. Comme pour tout domaine : DNS, puis bloc
Caddy (voir [Ajouter une commune](#ajouter-une-commune)). Sans domaine
régional, la langue est servie sous un préfixe : `pigna.fr/co/…`. Sur un
domaine régional, le français est servi sous `/fr/…`.

**Traduire :** ouvrir la page (ou l'actualité, l'événement, le document,
l'alerte) dans l'admin, choisir la langue dans le sélecteur de langue de
l'admin, saisir le texte, puis passer « État de la traduction » à
**Validée**. Seule une traduction validée est montrée au public ; « À
relire » reste invisible. Les libellés de menu, les textes alternatifs des
médias, le nom et les horaires de la commune se traduisent de la même
façon, sans état de traduction.

**Ce que voit le visiteur :** une page validée s'affiche entièrement dans la
langue. Une page non validée s'affiche entièrement en français, marquée
`lang="fr"`, précédée d'une mention écrite dans la langue choisie qui
l'annonce : jamais de page à moitié traduite. Dans les listes, un élément
non traduit garde son titre français, marqué `lang="fr"`. Un petit texte non
traduit (libellé de menu, texte alternatif, nom) s'affiche en français. Le
domaine fixe la langue d'arrivée (pas de redirection selon la langue du
navigateur) ; le visiteur choisit ensuite dans le sélecteur de langue de
l'en-tête. `hreflang` et `sitemap.xml` n'annoncent une langue que pour les
pages validées.

**Ajouter une langue au logiciel :** une ligne dans `src/lib/langues.ts`
(code BCP 47, nom, nom natif ; noms de mois et de jours seulement si `Intl`
ne connaît pas la langue), un dictionnaire `src/i18n/<code>.ts` déclaré dans
`src/i18n/index.ts` (le typage refuse un dictionnaire incomplet), et une
migration de base (`npm run payload -- migrate:create <nom>`). **Générer les
migrations avec `S3_ENABLED=true`**, comme la pile de production : sans lui,
la migration perdrait les colonnes du stockage S3 des médias et des
documents (`prefix`, `_objectKey`). Vérifier ensuite que la migration ne perd
rien, avec `scripts/instantane-contenu.ts` avant et après (modèle :
`scripts/verifier-migration-multilingue.sh`). Déployer après une sauvegarde
(`./scripts/backup.sh`), en une seule commande qui reconstruit et recrée le
conteneur de migration, puis vérifier :

```bash
CADDY_FILE=./Caddyfile docker compose up --build -d --force-recreate migrate app
docker compose logs migrate   # doit lister la migration appliquée (« Migrated: … »)
```

**Limites de la v1 :**

- les slugs et les segments d'URL restent en français
  (`pigna.corsica/actualites/marche-de-noel`) ;
- sur les Pages et les Actualités, le statut de publication est commun aux
  langues : publier la traduction publie aussi un brouillon français en
  cours ;
- liens internes des textes riches vers une page : rendus « # » (limite
  préexistante, profondeur 0) ;
- les slugs `fr`, `co` et `racine` sont réservés (refusés à la création). Une
  page qui les porterait déjà deviendrait inaccessible : la renommer avant
  la mise à jour.

**Textes corses provisoires :** les textes d'interface en corse
(`src/i18n/co.ts`, noms de dates dans `src/lib/langues.ts`) sont
provisoires. Ils doivent être relus par un locuteur avant la mise en
production.

**Recette de la migration du 25 septembre 2026** (pile locale de type
production, contenu réel créé à la main les 24 et 25 septembre) :

1. `./scripts/backup.sh backups/recette-multilingue-20260925`.
2. Instantané du contenu avec l'image de `main` :
   `docker compose run --rm --no-deps -T -v "$PWD/scripts:/app/scripts-recette:ro" -v "<dossier>:/out" -e INSTANTANE_FICHIER=/out/avant.json migrate node node_modules/payload/bin.js run scripts-recette/instantane-contenu.ts`.
3. `docker compose build` puis `docker compose up -d` avec la version
   multilingue (en deux temps, voir ci-dessous) : migration
   `20260925_182417_multilingue` appliquée.
4. Instantané après, `diff -u avant.json apres.json` : **vide**.
5. Retour arrière : pile repartie de l'image de `main`, puis
   `./scripts/restore.sh backups/recette-multilingue-20260925` ; instantané,
   `diff` avec `avant.json` : **vide** (migration multilingue absente de la
   base).
6. Nouveau déploiement de la version multilingue, instantané, `diff` avec
   `avant.json` : **vide**.
7. `select slug from pages where slug in ('fr','co','racine')` : aucun
   résultat.

Au premier `up -d`, le conteneur `migrate` s'est arrêté sans erreur, sans
aucun message, et la migration n'était pas appliquée ; un
`docker compose run --rm migrate` l'a appliquée. Au second déploiement, le
service `migrate` l'a appliquée normalement. Cause probable, non prouvée :
le déploiement en deux temps (`build`, puis `up -d`) aurait laissé un
conteneur `migrate` déjà « terminé avec succès » satisfaire la dépendance de
l'application, sans que la nouvelle image tourne. Le second déploiement,
fait sous la même forme, a pourtant fonctionné, d'où la réserve. Pour
écarter ce risque, toujours déployer une migration en une seule commande qui
recrée le conteneur, puis vérifier le journal :

```bash
CADDY_FILE=./Caddyfile docker compose up --build -d --force-recreate migrate app
docker compose logs migrate   # doit lister la migration appliquée (« Migrated: … »)
```

Reste à faire à l'écran : activer le corse sur une commune, lui ajouter un
domaine corse, traduire et valider une page, la voir en corse sur `/co/…` et
sur le domaine corse.

## Mesure d'audience

La mesure d'audience s'appuie sur [Umami](https://umami.is/), sans cookie ni
bandeau de consentement : elle relève de l'exemption de la CNIL pour les
outils de mesure d'audience strictement nécessaires au fonctionnement du
site. La collecte passe par un relais de pdlm posé sur le domaine de chaque
commune, jamais par un appel direct au serveur Umami depuis le navigateur.
Elle est coupée par défaut pour chaque commune, activée au cas par cas depuis
son admin. Voir la spec :
[`docs/superpowers/specs/2026-09-22-umami-collecte-cnil-design.md`](docs/superpowers/specs/2026-09-22-umami-collecte-cnil-design.md).

**Installation, une fois par plateforme :**

1. Dans `.env` : `COMPOSE_PROFILES=mesure`, `UMAMI_DB_PASSWORD`,
   `UMAMI_APP_SECRET`, `UMAMI_URL=http://umami:3000`, `UMAMI_PUBLIC_URL` ; puis
   `docker compose up -d`.
2. Avant d'ouvrir `stats.<plateforme>` au public, se connecter à Umami en
   `admin` / `umami` et **changer ce mot de passe** — par exemple via un
   tunnel SSH vers 127.0.0.1 sur l'hôte (`ssh -L 3002:<ip du conteneur umami>:3000`)
   ou `docker compose exec umami sh`. Seulement ensuite : DNS `stats.<plateforme>`
   vers le serveur, et décommenter le bloc `stats.…` du `Caddyfile`.
3. Dans Umami (`https://stats.<plateforme>`, mot de passe déjà changé) :
   créer l'utilisateur `pdlm` (rôle « utilisateur ») et, connecté en `pdlm`,
   sa clé d'API (_Paramètres → Clés d'API_ ; la clé n'est montrée qu'une
   fois) → `UMAMI_API_KEY` ; en `admin`, créer l'équipe au nom de l'EPCI et y
   ajouter `pdlm` avec le rôle **membre** (le rôle « lecture seule » ne peut
   pas créer de site) → `UMAMI_TEAM_ID` ; ajouter les agents de l'EPCI à
   l'équipe en **lecture seule**.
4. `docker compose up -d app` pour que pdlm lise les variables.

**Règles :**

- ne jamais créer de tableau (« board ») réunissant plusieurs communes
  (finalité propre à chaque éditeur, spec) ;
- **ne jamais changer `UMAMI_TEAM_ID` ni retirer `pdlm` de l'équipe** une fois
  une commune activée : pdlm prouve qu'un site est déjà supprimé par
  « membre de l'équipe et site introuvable » ; un site resté dans une autre
  équipe passerait pour supprimé ;
- **désinstaller** : couper la mesure de toutes les communes, supprimer la
  base `umami`, retirer `COMPOSE_PROFILES=mesure` et `UMAMI_URL`, puis poser
  `UMAMI_DESINSTALLE=1`. Sans cette dernière variable, pdlm refuse de
  supprimer une commune qui a un historique de mesure (une `UMAMI_URL`
  perdue au redéploiement ne doit pas laisser de données orphelines).

**Activer pour une commune :** admin de la commune, fiche commune →
« Mesure d'audience » ; transmettre le « Lien de partage » au maire.

**Couper, effacer :** couper n'efface rien (purge à 25 mois) ;
« Supprimer l'historique » efface tout, définitivement.

**Conservation :** purge quotidienne (service `purge-mesure`) ; tester avec
`./scripts/tester-purge-mesure.sh` (pile de développement, profil `mesure`).
Une sauvegarde de plus de 25 mois contient des données de mesure à
supprimer.

**Recette à faire au premier déploiement :**

1. Une page vue arrive dans Umami avec pays et ville renseignés (IP publique
   réelle).
2. Caddy transmet, jusqu'au relais, une adresse `X-Forwarded-For` cohérente.
3. Les chemins internes d'Umami (`/api/send`, `/api/batch`, `/api/record`,
   `/script.js`, `/recorder.js`, `/p/*`, `/q/*`) répondent 404 sur
   `stats.<plateforme>` ; l'interface (`/login`) reste accessible. Vérifier
   aussi les variantes `/api/send/`, `//api/send` et `/API/SEND` (404
   attendu).
4. La purge quotidienne (`purge-mesure`) tourne sans erreur dans la pile.
5. Sauvegarde puis restauration sur une pile neuve : même nombre de visites
   après restauration, Umami et la purge repartent sains.
6. Effacement de l'historique depuis l'admin, cloisonnement entre communes et
   opposition/CSRF vérifiés par des appels HTTP réels sur le serveur
   construit (pas seulement via les fonctions).

**Recette du 24 septembre 2026 (pile locale de type production) :** les
points ci-dessus ont été joués sur la pile Docker locale (Caddy, Umami
3.4.0), y compris à travers l'interface d'admin avec les trois profils —
l'effacement d'historique (journal et base vidés), le lien de partage du
maire (vue d'ensemble, sans onglets sessions ni temps réel), le
cloisonnement entre communes, l'opposition et le message d'erreur quand
Umami est arrêté. En local, les pages vues arrivent mais pays et ville
restent vides (IP locale écartée) et `X-Forwarded-For` porte l'adresse vue
par Caddy. Deux durcissements en sont sortis : `purge-mesure` attend
Postgres et réessaie après un échec (le `depends_on` de Compose est
ignoré quand Docker relance les conteneurs au redémarrage) ;
`restore.sh` attend que Postgres réponde avant de vérifier le rôle umami.

**Coût mémoire :** conteneur Umami mesuré en développement, au repos :
146,9 Mio.

**Langue** : l'interface d'Umami et les liens de partage s'ouvrent en français. L'image officielle fige l'anglais à la construction ; `scripts/umami-demarrer.sh` remplace la langue par défaut au démarrage du conteneur (chacun peut en changer dans son profil). Après une montée de version d'Umami, si le conteneur refuse de démarrer avec « Langue par défaut d'Umami introuvable », mettre ce script à jour.

## Politique de fichiers

- **Médias** (`media`) : images uniquement — `jpeg`, `png`, `webp`, `avif`
  (**pas de SVG**, risque XSS stocké). **Documents** (`documents`) : PDF
  uniquement. Limite : 20 Mo. Le type accepté est vérifié sur le **contenu
  réel** du fichier, jamais sur le seul type déclaré par le navigateur.
- **Accès** : les fichiers sont servis par la route de l'application
  (`/api/media/file/…`, `/api/documents/file/…`), qui applique le contrôle
  d'accès Payload de la collection — en v0.1, `media` et `documents` sont
  lisibles sans authentification (contenu destiné au site public), mais
  **jamais** lus directement depuis le stockage objet : le bucket de
  production n'accorde aucun accès anonyme (seules les identifiants
  applicatifs `pdlm-app` peuvent lire/écrire). En développement, MinIO
  autorise en complément le téléchargement anonyme direct sur le bucket
  (commodité locale, sans conséquence en production).
- **Limites assumées en v0.1** : l'URL d'un fichier n'est pas signée — la
  confidentialité d'un brouillon non publié dont un média a déjà été
  téléversé repose sur l'obscurité de l'URL, pas sur un contrôle d'accès
  strict. Suppression d'un média = suppression effective dans le stockage
  (fichier original et tailles dérivées). Prévu en v0.2 : URLs signées à
  durée limitée, analyse antivirus des documents déposés.

## Accessibilité (RGAA)

- Navigation clavier complète, lien d'évitement en première cible, focus
  visible sur tous les éléments interactifs, testés jusqu'à un zoom 200 %.
- Chaque commune personnalise ses couleurs (Admin → _Communes_ → _Apparence_ :
  principale, accent, terre). La seule validation est le format `#rrggbb` : une
  couleur peu contrastée est acceptée, puis rendue lisible par dérivation —
  chaque couple texte/fond est ajusté, teinte conservée, jusqu'à son seuil de
  contraste : 4.5:1 pour le texte courant, 3:1 pour les grandes dates et les
  pictogrammes, 7:1 pour le texte blanc sur la teinte profonde. L'onglet
  _Apparence_ recalcule la même dérivation à chaque réglage : sa bande
  « Contrastes dérivés » montre en direct les onze rapports obtenus.
- Les réglages avancés permettent de **forcer** une couleur dérivée : elle est
  alors servie telle quelle, sans ajustement — c'est l'unique échappatoire à la
  garantie ci-dessus. La bande « Contrastes dérivés » de l'onglet _Apparence_
  marque la ligne « forcée, sous votre responsabilité » et passe en alerte si
  le rapport obtenu descend sous le seuil.
- Texte alternatif obligatoire sur chaque média.
- Lighthouse est utilisé comme signal rapide (_smoke test_) pendant le
  développement, jamais comme preuve de conformité RGAA — seule une recette
  manuelle (grille RGAA officielle) fait foi.

## Sauvegarde et restauration

```bash
./scripts/backup.sh [dossier]     # défaut : backups/AAAAMMJJ-HHMMSS
./scripts/restore.sh <dossier>    # ATTENTION : écrase la base et le bucket actuels
```

Les deux scripts arrêtent brièvement l'application (fenêtre de maintenance) :
un `pg_dump` et un miroir S3 réalisés sous écritures concurrentes ne sont pas
garantis cohérents l'un avec l'autre. `restore.sh` refuse de continuer si
l'archive `postgres.sql.gz` est illisible, **avant** de toucher à la base
existante.

Si la mesure d'audience est installée, `umami.sql.gz` est sauvegardé et
restauré avec la base ; une sauvegarde sans ce fichier se restaure toujours.

## Tests

```bash
npm run lint          # ESLint
npm run typecheck     # tsc --noEmit
npm run test:unit     # Vitest — logique pure
npm run test:int      # Vitest — Payload + PostgreSQL réels (pdlm_test)
npm run test:e2e      # Playwright — E2E_PORT=3001 si le port 3000 est occupé
npm run test          # unit + int + e2e
```

La CI (`.github/workflows/ci.yml`) ajoute `npm audit --audit-level=high` et un
scan Trivy des images déployées.

Les tests E2E doivent tourner contre une base dédiée, ex. :
`DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e npm run seed && … npm run test:e2e`.

## Licence AGPL-3.0 — notice pour les opérateurs

Ce logiciel est distribué sous licence
[**GNU Affero General Public License v3.0**](LICENSE). Point souvent
mal compris par rapport à une GPL classique : l'AGPL déclenche l'obligation de
partage du code source **dès qu'un utilisateur interagit avec le logiciel via
un réseau** (un visiteur du site, un élu qui se connecte à l'admin) — même
sans distribution physique du logiciel.

**Conséquence concrète pour toute organisation qui déploie ou modifie pdlm et
le met à disposition d'un tiers (une commune, un agent, un citoyen)** :

- Le code source de la version exploitée — modifications comprises — doit
  être mis à disposition de ces utilisateurs, gratuitement, sous la même
  licence.
- Il est recommandé d'ajouter un lien visible (mentions légales ou pied de
  page) vers le dépôt du code source réellement en production, y compris les
  correctifs et personnalisations propres à l'organisation.
- Utiliser pdlm sans le modifier n'exempte de rien : le code source du projet
  **tel qu'exploité** doit rester accessible aux utilisateurs, à jour.

Ce n'est pas un conseil juridique — en cas de doute sur une situation
spécifique (marque blanche, module propriétaire ajouté, hébergement par un
tiers), consulter un professionnel du droit.

## Signalement de sécurité

Voir [`SECURITY.md`](SECURITY.md).

## Contribuer

Voir [`CONTRIBUTING.md`](CONTRIBUTING.md).
