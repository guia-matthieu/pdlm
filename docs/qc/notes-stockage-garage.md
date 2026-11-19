# Notes — remplacement de MinIO par Garage (branche `stockage-garage`)

Point de reprise en cas de coupure : lire ce fichier puis `git log --oneline`.
Brief : `docs/qc/brief-2026-11-19_stockage-garage.md`.
Interdits permanents : ni `git push`, ni `git fetch`, ni `ssh`, ni lecture d'un `.env`
(du dépôt), ni `sudo`, ni fusion dans `main`.

## Étape 1 — Lu avant d'écrit

### Doc Garage v2.5.0

Lue dans un clone lecture seule du dépôt source, tag `v2.5.0`, dans `/tmp/garage-doc`
(`git clone --depth 1 --branch v2.5.0 https://git.deuxfleurs.fr/Deuxfleurs/garage`).

**Secrets passés par variables d'environnement — confirmé** (décision du brief
« si Garage v2.5 les lit ainsi ») :

- `doc/book/reference-manual/configuration.md`, § `rpc_secret` :
  « Since Garage `v0.8.2`, the RPC secret can also be stored in a file whose path
  is given in the configuration variable `rpc_secret_file`, or specified as an
  environment variable `GARAGE_RPC_SECRET`. »
  Format exigé : « a 32-byte hex-encoded random string » (`openssl rand -hex 32`
  → 64 hex, conforme au brief).
- même fichier, § `admin_token` : « `admin_token_file` and the `GARAGE_ADMIN_TOKEN`
  environment variable are supported since Garage `v0.8.2`. »
  Valeur : « any random string » ; la doc recommande `openssl rand -base64 32`.
  Depuis v2.0, sans `admin_token` l'API d'administration n'accepte que des jetons
  créés dynamiquement : nous posons donc `GARAGE_ADMIN_TOKEN`.

**Chemin de configuration** : `src/garage/main.rs` — option `-c/--config`,
variable `GARAGE_CONFIG_FILE`, défaut **`/etc/garage.toml`**. C'est le chemin
utilisé par le montage du `garage.toml` versionné.

**Ports** (défauts, `configuration.md`) : 3900 API S3 (`[s3_api] api_bind_addr`),
3901 RPC, 3902 site web (inutilisé chez nous), 3903 API d'administration.
`s3_region` : « Garage will accept S3 API calls that are targeted to the S3 region
defined here. API calls targeted to other regions will fail with a
AuthorizationHeaderMalformed » → le `garage.toml` pose `s3_region = "fr-1"`
(aligné sur le défaut `S3_REGION` de l'app, un seul endroit décide : le toml).

**Image Docker** (`Dockerfile` du dépôt) : `FROM scratch`, `COPY result/bin/garage /`,
`CMD [ "/garage", "server"]` — pas de shell, pas de wget : aucun healthcheck
classique possible. Le binaire offre cependant `garage json-api` (depuis v2.0.0,
`doc/book/reference-manual/admin-api.md`) qui interroge l'instance locale par RPC
sans authentification et sort non nul en cas d'erreur → healthcheck Compose :
`["CMD", "/garage", "json-api", "GetClusterStatus"]` (toujours 200 une fois le
démon lancé, avec ou sans layout — la porte est l'API admin, pas l'état du cluster).

**Format des clés — confirmé dans le source** (`src/model/key_table.rs:149-150`) :

```rust
let key_id = format!("GK{}", hex::encode(&rand::random::<[u8; 12]>()[..]));
let secret_key = hex::encode(&rand::random::<[u8; 32]>()[..]));
```

→ identifiant `GK` + 24 hex ; secret 64 hex. `Key::import`
(`src/model/key_table.rs:158-176`) accepte de son côté tout identifiant ≥ 8
caractères alphanumériques ASCII + `-_.` et tout secret ≥ 16 caractères graphiques :
le format `GK`+24hex / 64 hex passe. Génération du `.env` démo :
`printf 'S3_ACCESS_KEY_ID=GK%s\n' "$(openssl rand -hex 12)"`.

**API d'administration v2** (`doc/api/garage-admin-v2.json`, authentification
`Authorization: Bearer <jeton>`, `doc/book/reference-manual/admin-api.md`) —
endpoints retenus pour l'init :

| But | Appel | Corps / remarques |
|---|---|---|
| État du cluster | `GET /v2/GetClusterStatus` | réponse : `nodes[].id`, `layoutVersion` |
| Poser le layout | `POST /v2/UpdateClusterLayout` | `{"roles":[{"id":<id nœud>,"zone":"dc1","capacity":<octets>,"tags":[…]}]}` (capacité en octets ; `null` = passerelle) |
| Appliquer | `POST /v2/ApplyClusterLayout` | `{"version": <version courante + 1>}` — vérifié dans `src/api/admin/layout.rs:279` (`apply_staged_changes(self.version)`) et quick-start (`garage layout apply --version 1` depuis version 0) |
| Bucket | `GET /v2/GetBucketInfo?globalAlias=<nom>` puis `POST /v2/CreateBucket` `{"globalAlias":"<nom>"}` | introuvable → **404** ; alias déjà pris → **409** (`src/api/common/common_error.rs:109-112`) |
| Clé | `GET /v2/GetKeyInfo?id=<GK…>` puis `POST /v2/ImportKey` `{"accessKeyId":…,"secretAccessKey":…,"name":…}` | absente → import ; déjà présente → **409** (`KeyAlreadyExists`, `src/api/admin/error.rs:88`) |
| Droits | `POST /v2/AllowBucketKey` `{"bucketId":…,"accessKeyId":…,"permissions":{"read":true,"write":true,"owner":false}}` | idempotent par construction : « Flags in permissions which have the value true will be activated. Other flags will remain unchanged » |
| Quota | `POST /v2/UpdateBucket?id=<uuid>` `{"quotas":{"maxSize":<octets ou null>,"maxObjects":null}}` | « new values of `maxSize` and `maxObjects` must both be specified, or set to `null` to remove the quotas » — les deux champs sont toujours envoyés |

**Quotas** : l'API ne parle qu'en octets (`maxSize`) ; la conversion depuis la
syntaxe `2GiB` de `S3_QUOTA` est faite par l'init (test unitaire si testable).

### Image du conteneur d'init

Le brief prévoit « un conteneur à shell épinglé par digest », `apk add` interdit,
et un `wget` busybox « ne suffit pas » s'il faut autre chose. Il ne suffit pas :
l'init doit **analyser du JSON** (id du nœud, version du layout, uuid du bucket) ;
grep/sed sur du JSON compact serait fragile. Choix (signalé en « Hors brief ») :
`node:22.17.0-alpine` — même base que le `FROM` du `Dockerfile` du dépôt, shell +
`fetch` + JSON natifs, aucun paquet installé à l'exécution.
Digest résolu le 19/11/2026 (`docker buildx imagetools inspect`) :
`node:22.17.0-alpine@sha256:fc3e945f920b7e3000cd1af86c4ae406ec70c72f328b667baf0f3a8910d69eed`.
Image tierce → ajoutée aux cibles Trivy (étape 5).

### Inventaire MinIO / mc (hors `docs/qc/` et `docs/superpowers/`)

`git grep -n -i -E 'minio|\bmc\b'` au départ :

```
.claude/skills/verifier-actualites/SKILL.md:12
.env.example:18,24,25,34,36,37
.github/workflows/ci.yml:190,224,225,228,231,235
.github/workflows/trivy-rescan.yml:81,82,85,88,92
README.md:10,37,72,79,114,118,131,393
SECURITY.md:56,61,75
docker-compose.demo.yml:15,33,34,35,36,39,41,43,44,48,53,54,60,78,88
docker-compose.dev.yml:1,26,27,28,31,32,35,38,46,67,124
docker-compose.yml:3,11,35,38,42,43,45,54,55,57,60,61,74,80,112,121,257
docs/deploiement-demo.md:67,71,72,73,87,88,92,223,434
scripts/backup.sh:2,93,110,112
scripts/restore.sh:158,160
```

Tous traités aux étapes 2 à 5. Fichiers lus intégralement avant écriture : les
trois Compose, `scripts/backup.sh`, `scripts/restore.sh`, `scripts/demo-controles.sh`,
`scripts/demo-refaire-reference.sh`, `scripts/demo-restauration-nuit.sh`,
`.github/workflows/ci.yml`, `.github/workflows/trivy-rescan.yml`,
`docs/deploiement-demo.md`, README, SECURITY.md, `.env.example`,
`src/payload.config.ts`.

`payload.config.ts` : rien à changer — `forcePathStyle: true` déjà là, région
par défaut `fr-1` = `s3_region` du `garage.toml`.

## Étape 2 — Compose prod/dev/démo + init

### Décisions complémentaires, prises en écrivant

- **Le secret RPC est décodé en hexadécimal strict** : `src/garage/main.rs:321-326`
  fait `hex::decode(rpc_secret)` (« Invalid RPC secret key (bad hex) ») puis
  `NetworkKey::from_slice` (« wrong length ») → exactement 32 octets, donc
  64 hex, OBLIGATOIRE même en dev. Le défaut de développement
  (docker-compose.dev.yml) est de l'hexadécimal valide : `deadbeef`×8. Le
  jeton admin reste une chaîne libre.
- **Les crédentiels de dev changent** : l'app en dev s'authentifiait avec
  l'utilisateur racine (`minioadmin`/`minioadmin`, valeurs de .env.example)
  car le `createbuckets` de dev ne créait pas l'utilisateur pdlm-app.
  Désormais l'init de dev importe `pdlm-app`/`motdepasse-a-changer` : le
  `.env` de dev devra poser `S3_ACCESS_KEY_ID=pdlm-app`,
  `S3_SECRET_ACCESS_KEY=motdepasse-a-changer` et
  `S3_ENDPOINT=http://localhost:3900` (gabarit .env.example retouché à
  l'étape 5 ; le .env du dépôt n'est pas lu — interdit).
- **Ports publiés en dev : 3900 seul** (API S3, pour `npm run dev` sur
  l'hôte). L'ancienne console web 9001 n'a pas d'équivalent (Garage n'en a
  pas) ; RPC 3901 et admin 3903 restent internes — exploration par
  `docker compose exec garage /garage …` si besoin.
- **Image épinglée tag + digest** : `dxflrs/garage:v2.5.0@sha256:677e5b…` —
  digest re-vérifié le 19/11 (`docker buildx imagetools inspect
  dxflrs/garage:v2.5.0`, manifeste identique à la décision du brief).
- `NEXT_PUBLIC_S3_PUBLIC_URL` (défaut prod 9000 → 3900) : réservation d'hôte
  uniquement (`src/collections/Communes.ts:93`), ne commande aucun
  téléchargement — les médias passent par l'API Payload.
- Accès anonyme supprimé en dev aussi : aucun test ne dépend d'une lecture
  S3 directe (grep : rien dans src/ ni tests/ ne construit d'URL d'objet ;
  le seul test touchant à la variable pose la sienne). Suite complète
  rejouée en fin de brief.

### Fichiers écrits

- `garage.toml` — versionné, sans secret, monté ro dans /etc/garage.toml.
- `scripts/garage-quota.mjs` — conversion `2GiB` → octets.
- `scripts/garage-init.mjs` — init idempotent par l'API admin v2 (layout,
  bucket, import de clé, droits lecture+écriture sans owner, quota). Aucun
  secret en sortie : ni jeton admin ni secret de clé ; l'identifiant de clé
  reste public (statut de l'identifiant racine MinIO avant lui).
- `docker-compose.yml` — `garage` (healthcheck `/garage json-api
  GetClusterStatus`, zéro port publié, secrets `:?`) et `init-s3` (node
  alpine épinglé) ; app sur `http://garage:3900` ; volumes `garage_meta` +
  `garage_data`.
- `docker-compose.dev.yml` — mêmes services avec les défauts de dev
  (secrets dev ICI seulement), 3900 publié, volumes `garage_meta_dev` +
  `garage_data_dev`.
- `docker-compose.demo.yml` — `garage` (`DEMO_S3_MEM_LIMIT`/`_CPUS`/
  `_PIDS_LIMIT`, valeurs inchangées 768m/1/128 ; alias `pdlm-demo-garage`),
  `init-s3` (`GARAGE_ADMIN_TOKEN`, `S3_ACCESS_KEY_ID`, `S3_APP_PASSWORD`
  en `:?` ; `S3_QUOTA=${DEMO_S3_QUOTA:-2GiB}`), app sur
  `http://pdlm-demo-garage:3900`.
- `tests/unit/garage-quota.spec.ts` — 14 cas (conversions et refus).

### Preuves (sorties brutes, sans secret)

Test unitaire du nouveau fichier :

```
 RUN  v4.1.11 /Users/matthieucredou/Projects/glm.garage

 Test Files  1 passed (1)
      Tests  14 passed (14)
```

`docker compose config -q` — env factice généré par mktemp (umask 077,
supprimé après ; jamais le .env du dépôt) :

```
--- prod ---
OK
--- dev ---
OK
--- demo (base + surcouche) ---
OK
```

Fusion démo, champs non secrets extraits du rendu `config` :

```
  app:
      S3_ENDPOINT: http://pdlm-demo-garage:3900
    ports:
        published: "3110"   (×2 : 127.0.0.1 et [::1])
  garage:
    image: dxflrs/garage:v2.5.0@sha256:677e5b75…
        aliases:
          - pdlm-demo-garage
  init-s3:
      S3_QUOTA: 2GiB
    image: node:22.17.0-alpine@sha256:fc3e945f…
```

Aucun port publié pour `garage` en prod ni en démo ; en dev, 3900 seul.
Les mots « minio » et « createbuckets » ont disparu des trois Compose
(mentions historiques reformulées sans le nom — le grep final de l'étape 5
exige zéro résultat hors docs/qc et docs/superpowers).

## Étape 3 — Dev sur Garage

### Incident et correctif : `rpc_bind_addr` obligatoire

Premier `docker compose -f docker-compose.dev.yml up -d` : le conteneur
`garage` sortait en erreur avant tout listen — `docker compose logs garage` :

```
Error: TOML decode error: missing field `rpc_bind_addr`
```

`rpc_bind_addr` n'a **pas de valeur par défaut** (doc configuration.md, § du
même nom — contrairement aux adresses S3/admin). Même un nœud unique s'écoute :
c'est par ce port que le CLI local `garage …` (et le healthcheck `json-api`)
dialogue avec le démon. Correctif : `rpc_bind_addr = "[::]:3901"` posé dans
`garage.toml` (avec commentaire) — commit de ce fichier avec l'étape 3.

### Preuves (sorties brutes, sans secret)

Pile dev redémarrée (`docker ps --format …`) :

```
pdlm-garage-1     garage    Up (healthy)
pdlm-init-s3-1    init-s3   Exited (0)
pdlm-postgres-1   postgres  Up (healthy)
```

Premier passage d'`init-s3` (`docker compose logs init-s3`) :

```
layout : nœud 650f195c posé (version 1)
bucket pdlm : créé
clé pdlm-app : importée
droits : pdlm-app lit et écrit dans pdlm (sans owner)
quota : aucun
initialisation Garage : terminée
```

Rejeu (`docker compose -f docker-compose.dev.yml run --rm init-s3`) —
idempotence :

```
layout : déjà posé (version 1)
bucket pdlm : déjà présent
clé pdlm-app : déjà importée
droits : pdlm-app lit et écrit dans pdlm (sans owner)
quota : aucun
initialisation Garage : terminée
```

Inspection par le CLI local (`docker compose exec garage /garage …`) :

```
==== CURRENT CLUSTER LAYOUT ====
ID                Tags    Zone  Capacity  Usable capacity
650f195cd87db191  [pdlm]  dc1   10.0 GiB  10.0 GiB (100.0%)
Current cluster layout version: 1

==== BUCKET INFORMATION ====
Bucket:          b2d5190c2fd2770adc1207c96d01643b28238b86f6b67ce3851a33c9e7751d3e
Size:            0 B (0 B) — Objects: 0
Global alias:    pdlm
==== KEYS FOR THIS BUCKET ====
Permissions  Access key            Local aliases
RW           pdlm-app    pdlm-app

==== ACCESS KEY INFORMATION ====
Key ID:              pdlm-app
Secret key:          (redacted)
Validity:            valid
Can create buckets:  false
==== BUCKETS FOR THIS KEY ====
Permissions  ID                Global aliases
RW           b2d5190c2fd2770a  pdlm
```

La clé de l'app ne peut **pas** créer de buckets (l'ancien utilisateur racine
le pouvait) — réduction de privilège effective.

Le téléversement d'un média par `npm run dev` est prouvé à l'essai de
l'étape 6, comme le prévoit le brief. La pile dev reste lancée pour la suite.

## Étape 4 — backup.sh / restore.sh sur rclone

### Décisions complémentaires, prises en écrivant

- **rclone 1.75.2 ne connaît pas le provider « Garage »** : `RCLONE_CONFIG_*
  _PROVIDER=Garage` produit un avis « s3 provider "Garage" not known » à
  chaque appel (vérifié sur l'image épinglée : la liste des providers de
  `help backend s3 provider` ne le contient pas). Le réglage retenu est
  `Other` (S3 compatible quelconque) : AWS v4, style chemin — éprouvé
  ci-dessous contre le Garage de dev.
- **Service Compose `copie-s3`** (profil `outils`, jamais lancé par `up`)
  plutôt qu'un `docker run` nu : les identifiants S3 restent dans
  l'environnement du service, interpolés par Compose depuis le `.env`
  (source unique `S3_APP_PASSWORD`, comme l'app et init-s3) — jamais posés
  par l'hôte, qui aurait exposé le secret dans sa ligne de commandes.
  `docker compose run` active le profil du service visé (preuve : dry-run
  ci-dessous — et au passage, le dry-run SIMULE aussi les conteneurs de
  dépendance : rien n'est réellement créé, `docker ps -a` le confirme).
- **Comptage (retouche V)** : `rclone lsf -R` liste aussi les « dossiers »
  du bucket → `--files-only`, sans quoi le compte ne matcherait jamais
  `find -type f` côté hôte (constaté sur l'essai : `dossier/` apparaissait).
- **`umask 077` dans le conteneur** : les fichiers écrits par rclone dans
  la sauvegarde sont à 600 comme les dumps écrits par l'hôte (l'en-tête du
  script le promet — « la sauvegarde contient tout le site »).
- **Le bucket n'est pas recréé par restore.sh** : la clé de l'app ne peut
  pas créer ni supprimer de bucket (droits sans owner — refus 403
  « Operation is not allowed for this key » constaté à l'essai sur une
  tentative `purge` du bucket entier). C'est init-s3 qui pose le bucket ;
  s'il manquait, `rclone sync` échoue et `echec_apres_bascule` garde le
  retour arrière ouvert. L'ancien `mc mb --ignore-existing` disparaît.
- Surcouche démo : `copie-s3` reçoit les mêmes bornes que le serveur S3
  (`DEMO_S3_MEM_LIMIT`/`_CPUS`/`_PIDS_LIMIT`) — la copie héritait des
  bornes du service S3 avant elle (conteneur jetable mais serveur mutualisé).

### Preuves (sorties brutes, sans secret)

Essai rclone ↔ Garage dev sur un bucket jetable `pdlm-essai-rclone`
(créé et supprimé par le CLI admin ; creds dev, par défaut du dépôt) —
config par `RCLONE_CONFIG_ESSAI_*`, `PROVIDER=Other`,
endpoint `http://host.docker.internal:3900` :

```
$ rclone version            → rclone v1.75.2 (alpine 3.24.2)
$ rclone sync /src essai:pdlm-essai-rclone      → rc=0
$ rclone lsf -R --files-only essai:pdlm-essai-rclone
a.txt
b/c.txt
$ rclone cat …/b/c.txt       → ccc
$ copyto parasite.txt ; rclone sync /src … (rejeu)
$ rclone lsf -R --files-only essai:pdlm-essai-rclone
a.txt
b/c.txt                       ← parasite.txt supprimé par sync (effet --remove)
$ rclone purge essai:pdlm-essai-rclone
ERROR … DeleteBucket … 403 AccessDenied: Operation is not allowed for this key
                              ← la clé n'est pas owner (voulu) ; bucket vidé,
                                supprimé ensuite par /garage bucket delete --yes
```

Seul avis résiduel de rclone : « Config file not found - using defaults » —
attendu, la configuration vit dans l'environnement, pas dans rclone.conf.

`bash -n` sur les deux scripts : OK. `docker compose config -q` (env factice
mktemp, umask 077, supprimé) : prod OK, dev OK, démo OK. Dry-run
`docker compose run copie-s3` : le conteneur `…-copie-s3-run-…` est bien
résolu et planifié sans COMPOSE_PROFILES (le profil s'active par `run`) ;
`docker ps -a` après : vide, rien de créé. La preuve fonctionnelle complète
(backup.sh → suppression média → restore.sh) est celle de l'étape 6.

## Hors brief

- Conteneur d'init : `node:22.17.0-alpine` épinglé par digest plutôt qu'une image
  « curl » : wget busybox ne sait pas analyser le JSON des réponses de l'API
  admin (autorisé par le brief : « choisir une image avec curl, épinglée, et le
  noter » — on note : node, même base que l'app).
