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
2. DNS `stats.<plateforme>` vers le serveur, et décommenter le bloc `stats.…`
   du `Caddyfile`.
3. Dans Umami (`https://stats.<plateforme>`) : se connecter en `admin` /
   `umami` et **changer ce mot de passe** ; créer l'utilisateur `pdlm` (rôle
   « utilisateur ») et, connecté en `pdlm`, sa clé d'API (_Paramètres → Clés
   d'API_ ; la clé n'est montrée qu'une fois) → `UMAMI_API_KEY` ; en `admin`,
   créer l'équipe au nom de l'EPCI et y ajouter `pdlm` avec le rôle **membre**
   (le rôle « lecture seule » ne peut pas créer de site) → `UMAMI_TEAM_ID` ;
   ajouter les agents de l'EPCI à l'équipe en **lecture seule**.
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
   `stats.<plateforme>` ; l'interface (`/login`) reste accessible.
4. La purge quotidienne (`purge-mesure`) tourne sans erreur dans la pile.
5. Sauvegarde puis restauration sur une pile neuve : même nombre de visites
   après restauration, Umami et la purge repartent sains.
6. Effacement de l'historique depuis l'admin, cloisonnement entre communes et
   opposition/CSRF vérifiés par des appels HTTP réels sur le serveur
   construit (pas seulement via les fonctions).

**Coût mémoire :** conteneur Umami mesuré en développement, au repos :
146,9 Mio.

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
- Chaque commune personnalise une couleur principale et une couleur d'accent
  (Admin → _Communes_ → _Apparence_). **Avant publication**, vérifier le
  contraste obtenu avec le texte blanc du site (utilisé sur les boutons et
  l'en-tête) — cible AA : ratio ≥ 4.5:1 pour le texte courant, ≥ 3:1 pour le
  texte large et les composants d'interface. Outil recommandé :
  [webaim.org/resources/contrastchecker](https://webaim.org/resources/contrastchecker/).
  Une couleur trop claire (ex. jaune pâle) ne passe pas ce seuil sur fond
  blanc/texte blanc — vérifier avant d'activer la commune.
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
