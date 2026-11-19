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

## Hors brief

- Conteneur d'init : `node:22.17.0-alpine` épinglé par digest plutôt qu'une image
  « curl » : wget busybox ne sait pas analyser le JSON des réponses de l'API
  admin (autorisé par le brief : « choisir une image avec curl, épinglée, et le
  noter » — on note : node, même base que l'app).
