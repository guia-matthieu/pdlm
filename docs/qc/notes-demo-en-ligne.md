# Notes — Instance de démonstration en ligne

Brief : `~/Projects/guia/tasks/2026-10-25_brief-glm-demo-en-ligne.md`.
Branche : `demo-en-ligne` (créée par le hub depuis `main` `cbac12a`), worktree
`~/Projects/glm.demo`. Ces notes servent de point de reprise : chaque partie y
consigne ce qui est fait, les sorties réelles des commandes et les pièges.

## Journal

| Commit | Partie | Contenu |
| --- | --- | --- |
| `e3d855d` | A | Seed `demo-en-ligne.ts` + garde-fous + tests + script npm |
| `5316cd1` | B | `docker-compose.demo.yml` (caddy désactivé, app sur 3110 boucle locale) |
| `f35b658` | B | Correction hub : app aussi sur le réseau externe `vps-network`, alias `pdlm-demo` |
| `832c005` | C | Essai Docker complet local (`pdlm-demo-essai`), preuves ci-dessous |
| `1127e0f` | D | `docs/deploiement-demo.md` pour le hub |
| `f277aaa` | Retouche A | Alias `pdlm-demo-postgres`/`pdlm-demo-minio`, URIs redirigées, essai avec leurre |
| `e8d2253` | Retouche B | `COMPOSE_PROJECT_NAME`/`COMPOSE_FILE` dans le `.env` serveur + garde avant sauvegarde |
| `2d784c2` | Retouche C | Contrôle `docker-compose.demo.yml` présent avant le `up` |
| `7801656` | Retouche D | Gestes sûrs serveur mutualisé : réseau, port, noms, Caddy, secrets, désinstallation |
| `ef30c74` | Retouche E | DNS : trois enregistrements explicites, plus de générique |
| `58e640c` | Retouche F | Cron de re-seed optionnel, verrou `flock` partagé avec la mise à jour |
| (ce commit) | Retouche G | Garde-fous du seed : DEMO_DOMAIN ≥ 3 étiquettes, = PLATFORM_DOMAIN, base et domaines vérifiés |
| (ce commit) | Retouche H | Réseau dédié `pdlm-demo-edge` : plus de `vps-network`, Caddy connecté hors Compose |
| (ce commit) | Retouche I | `scripts/demo-controles.sh` rejouable, chaîné par la procédure — plus d'`exit` en session |
| (ce commit) | Retouche J | Caddy : édition/copie côté hôte, chaîne `validate && grep -c && reload`, retour arrière écrit |
| (ce commit) | Retouche K | `-T` sur les `run` (seed, cron) ; mise à jour `--no-deps` : la base ne redémarre pas |
| (ce commit) | Retouche L | `estHostnameDemo` supprimé (garde tautologique) ; `POSTGRES_PASSWORD` sans défaut dans la surcouche |
| (ce commit) | Retouche M | § Vérifications : `/admin` 200 ou redirection, `X-Robots-Tag` obligatoire |

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

## Partie B — surcouche Compose de démo

Fichier : `docker-compose.demo.yml`, à utiliser
`docker compose -f docker-compose.yml -f docker-compose.demo.yml …`
(`docker-compose.yml` inchangé).

- `app` reçoit `ports: 127.0.0.1:3110:3000` et `[::1]:3110:3000` — boucle
  locale IPv4 ET IPv6, rien d'autre (le service de base n'a aucun port, la
  fusion n'entre donc pas en conflit avec lui).
- `caddy` reçoit `profiles: [desactive]` : profil jamais activé, Compose
  ignore le service et 80/443 restent au Caddy partagé de l'hôte.

### Preuves (sorties réelles)

    $ PAYLOAD_SECRET=x docker compose -f docker-compose.yml -f docker-compose.demo.yml config --services
    minio
    postgres
    createbuckets
    migrate
    app
    (caddy absent)

    $ docker compose … config --format json | extraction services.app.ports
    [
     {
      "host_ip": "127.0.0.1",
      "target": 3000,
      "published": "3110",
      "protocol": "tcp"
     },
     {
      "host_ip": "::1",
      "target": 3000,
      "published": "3110",
      "protocol": "tcp"
     }
    ]
    caddy: False

(`PAYLOAD_SECRET=x` : valeur jetable, uniquement pour l'interpolation `:?`
de la config en mode dry-run — aucune pile lancée.) La partie C prouve la
surcouche en conditions réelles (build, up, curl).

### Correction du hub (mesurée sur le serveur cible)

Le Caddy partagé tourne dans un CONTENEUR sur le réseau Docker externe
`vps-network` : `localhost:3110` y désignerait le conteneur Caddy lui-même,
pas l'hôte. La surcouche rattache donc aussi `app` à `vps-network` avec
l'alias `pdlm-demo` (le Caddy partagé proxifie par `reverse_proxy
pdlm-demo:3000`, cf. partie D), tout en le gardant sur le réseau `default`
de la pile — poser `networks` sur un service le retire sinon du réseau de la
pile, et il perdrait postgres et minio. Les publications 127.0.0.1:3110 /
[::1]:3110 restent : elles servent aux contrôles depuis l'hôte.

    $ docker network create vps-network   # absent localement, créé pour l'essai
    6835f903a4fe…682039d99

    $ docker compose … config --format json | extraction
    app.networks = {"default": {}, "vps-network": {"aliases": ["pdlm-demo"]}}
    app.ports   = [{"host_ip": "127.0.0.1", "published": "3110", "target": 3000},
                   {"host_ip": "::1",       "published": "3110", "target": 3000}]
    caddy présent : False
    networks = {"default": "pdlm-prod_default", "vps-network": "vps-network (externe)"}

## Partie C — essai Docker complet local

Projet Compose isolé `-p pdlm-demo-essai` (le `docker-compose.yml` de base
pose `name: pdlm-prod` : sans `-p`, l'essai écraserait la pile de prod locale).
`.env` temporaire **hors dépôt** : `/tmp/pdlm-demo-essai/.env` (umask 077),
secrets générés par `openssl rand -hex 32` en substitution de shell — jamais
affichés, jamais copiés dans ces notes ; `DEMO_DOMAIN=demo.localhost`,
`PLATFORM_DOMAIN=demo.localhost`. Le réseau `vps-network` n'existait pas sur
cette machine : créé pour l'essai (preuve partie B) et supprimé à la fin.

### Montage

    $ docker compose -p pdlm-demo-essai --env-file /tmp/pdlm-demo-essai/.env \
        -f docker-compose.yml -f docker-compose.demo.yml up -d --build
    … (build + démarrage, journal complet dans /tmp/pdlm-demo-essai/up.log)
     Container pdlm-demo-essai-app-1  Started
    EXIT=0

    $ docker compose … ps
    NAME                         IMAGE                       SERVICE   STATUS                   PORTS
    pdlm-demo-essai-app-1        pdlm-demo-essai-app         app       Up 4 minutes (healthy)   127.0.0.1:3110->3000/tcp, [::1]:3110->3000/tcp
    pdlm-demo-essai-minio-1      quay.io/minio/minio@sha256… minio     Up 4 minutes (healthy)   9000/tcp
    pdlm-demo-essai-postgres-1   postgres:17-alpine          postgres  Up 4 minutes (healthy)   5432/tcp
    (createbuckets et migrate : Exited — one-shot)

    $ docker compose … logs migrate | tail -8
    migrate-1  | INFO: Migrated:  20261001_171239_mandats (7ms)
    migrate-1  | INFO: Migrating: 20261004_144904_gabarits_couleurs
    migrate-1  | INFO: Migrated:  20261004_144904_gabarits_couleurs (26ms)
    migrate-1  | INFO: Migrating: 20261012_075826_tailles_heros_panorama
    migrate-1  | INFO: Migrated:  20261012_075826_tailles_heros_panorama (2ms)
    migrate-1  | INFO: Migrating: 20261021_150512_rpnt_lot2_code_insee
    migrate-1  | INFO: Migrated:  20261021_150512_rpnt_lot2_code_insee (1ms)
    migrate-1  | INFO: Done.

### Seed en production (image migrator)

    $ set -a; . /tmp/pdlm-demo-essai/.env; set +a
    $ docker compose -p pdlm-demo-essai --env-file /tmp/pdlm-demo-essai/.env \
        -f docker-compose.yml -f docker-compose.demo.yml run --rm \
        -e DEMO_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR \
        migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts
     Container pdlm-demo-essai-postgres-1  Running
    [20:22:32] WARN: No email adapter provided. Email will be written to console. …
    [20:22:33] INFO: Démo en ligne prête — saint-ex (Village) et port-lavanne (Littoral)
    sur *.demo.localhost, comptes operateur@pdlm.invalid, admin@pdlm.invalid,
    redacteur@pdlm.invalid.

La forme de commande exigée par le brief (`node node_modules/payload/bin.js
run src/seed/demo-en-ligne.ts` dans le conteneur `migrate`) fonctionne en
production, telle quelle.

### Vérifications HTTP (boucle locale 3110)

    — saint-ex —
    HTTP 200
    Saint-Exupéry-les-Bains
    /gabarits/village/theme.css
    — port-lavanne —
    HTTP 200
    Port-Lavanne
    /gabarits/littoral/theme.css
    Bienvenue à Port-Lavanne
    — couleurs littoral dans la page —
       4 #2a7f9e
       4 #d2462f
       4 #f2b134

    — feuilles de gabarit —
    village theme.css : HTTP 200
    littoral theme.css : HTTP 200
    — IPv6 —
    HTTP 200
    — health —
    HTTP 200
    — host inconnu —
    HTTP 404        (inconnu.demo.localhost)
    HTTP 404        (nimporte.quoi.fr)

Le login admin est prouvé sans afficher le moindre secret — le mot de passe
est lu du `.env` temporaire par `sed`, dans une substitution de shell :

    $ CODE=$(curl -sS -o /tmp/pdlm-demo-essai/login.json -w '%{http_code}' \
        -X POST -H 'Content-Type: application/json' -H 'Host: demo.localhost' \
        --data-binary @- http://127.0.0.1:3110/api/users/login <<EOF
      {"email":"admin@pdlm.invalid","password":"$(sed -n 's/^DEMO_MDP_ADMIN=//p' /tmp/pdlm-demo-essai/.env)"}
      EOF
      )
    login admin : HTTP 200
    user : admin@pdlm.invalid — rôles : [['admin']]
    token : présent = True (non affiché)

### Alias réseau `pdlm-demo` (ce que verra le Caddy partagé)

    $ docker network inspect vps-network --format '{{range .Containers}}{{.Name}} {{end}}'
    pdlm-demo-essai-app-1
    $ docker run --rm --network vps-network pdlm-demo-essai-app \
        wget -qO- --header='Host: saint-ex.demo.localhost' http://pdlm-demo:3000/ | grep -o 'Saint-Exupéry-les-Bains'
    Saint-Exupéry-les-Bains

Le conteneur éphémère (image `runner`, sans ENTRYPOINT) rejoint
`vps-network`, résout l'alias `pdlm-demo` et sert saint-ex — exactement le
chemin `reverse_proxy pdlm-demo:3000` du Caddy partagé du serveur.

### Idempotence — seed relancé une 2e fois

    $ … run --rm -e DEMO_* … migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts
    [20:23:17] WARN: No email adapter provided. Email will be written to console. …
    [20:23:17] INFO: Démo en ligne prête — saint-ex (Village) et port-lavanne (Littoral)
    sur *.demo.localhost, comptes operateur@pdlm.invalid, admin@pdlm.invalid,
    redacteur@pdlm.invalid.

    $ docker compose … exec postgres psql -U postgres -d pdlm -t -c …
     communes : 2
     domaines : 2
     users : 3
     pages saint-ex : 5
     pages port-lavanne : 3
     evenements saint-ex : 2
     evenements (toutes communes) : 2

Aucun doublon après deux exécutions. Les événements sont en plus **re-datés**
à chaque exécution (agenda vivant) — dates lues après le 2e passage
(essai le 25/10, J+5 et J+12) :

     1 | Marché de printemps                 | 2026-10-30 20:23
     2 | Conseil municipal (séance publique) | 2026-11-06 20:23

### Démontage

    $ docker compose -p pdlm-demo-essai … down -v
     Volume pdlm-demo-essai_pgdata  Removed
     Volume pdlm-demo-essai_minio_data  Removed
     Network pdlm-demo-essai_default  Removed
    $ docker network rm vps-network      # créé pour l'essai, n'existait pas avant
    vps-network
    $ rm -rf /tmp/pdlm-demo-essai        # .env et login.json (token) détruits
    /tmp/pdlm-demo-essai supprimé
    $ docker ps -a --filter name=pdlm-demo-essai
    CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
    (vide)

Les images construites pour l'essai (`pdlm-demo-essai-app`, 403 Mo ;
`pdlm-demo-essai-migrate`, 1,5 Go) sont retirées (`docker rmi`) : plus
aucune trace `pdlm-demo-essai` sur la machine.

### Pièges rencontrés

- `--env-file` n'interpole que pour Compose : les variables ne passent PAS
  aux conteneurs. Le seed les reçoit par `set -a; . ./.env; set +a` puis
  `run --rm -e DEMO_DOMAIN -e DEMO_MDP_* …` (les `-e` sans valeur reprennent
  l'environnement du shell).
- Le psql du conteneur postgres officiel accepte `psql -U postgres -d pdlm`
  sans mot de passe (socket locale en trust) — pratique pour les comptages,
  inutile d'exposer le port 5432.
- Schéma SQL : colonnes snake_case (`tenant_id`, `date_debut`) et les champs
  localisés vivent dans une table séparée (`evenements_locales`, colonnes
  `_parent_id` et `_locale`) — `titre` n'existe pas dans `evenements`.
- L'image `runner` n'a pas d'ENTRYPOINT (CMD `node server.js` seulement) :
  `docker run … <image> wget …` marche et sert à sonder depuis un conteneur.

## Partie D — procédure de déploiement (`docs/deploiement-demo.md`)

Écrite pour le hub qui déploiera. Structure : aperçu (pile sans Caddy, app
derrière le Caddy partagé par alias `pdlm-demo` sur `vps-network`,
publications 3110 pour contrôle), DNS (A/AAAA + wildcard), copie
`git archive main | ssh … tar -x`, `.env` serveur généré par substitution de
shell (jamais affiché), réseau partagé, build/up (`-p pdlm-demo`
obligatoire), seed, bloc Caddy `reverse_proxy pdlm-demo:3000` avec
`X-Robots-Tag: noindex, nofollow` + cron de rafraîchissement hebdomadaire de
l'agenda, vérifications, mise à jour (`--force-recreate migrate app`, cf.
README), sauvegarde/retour arrière (migrations non réversibles), désinstallation.

Points d'attention reflétés dans la doc :

- `-p pdlm-demo` partout : le compose de base pose `name: pdlm-prod` ;
- placeholders uniquement (`<HOTE>`, `<DOSSIER>`, `<CONTENEUR_CADDY>`,
  `<CHEMIN_CADDYFILE>`, `<chemin-du-dépôt>`) — aucune IP ni chemin inventé ;
- les `DEMO_MDP_*` ne sont lus qu'à la création des comptes : la doc dit
  explicitement qu'un changement dans le `.env` ne change pas un mot de passe
  existant ;
- désinstallation : `down -v`, bloc Caddy retiré + reload, DNS retiré,
  `rm -rf <DOSSIER>`, et **ne pas** supprimer `vps-network` (partagé) ;
- le wildcard DNS `*.demo.pdlm.guia.fr` sert toute future commune de démo
  sans nouvel enregistrement.

## Retouches après relecture (2026-10-25, brief du hub)

Le relecteur a rejeté la branche ; le hub a mesuré le serveur cible (un
conteneur `postgres` — base d'autres sites — et un `umami` existent déjà sur
`vps-network`). Retouches A à G ci-dessous, un commit par lettre.

### Retouche A — noms non ambigus sur les réseaux

**Changé** (`docker-compose.demo.yml` seul, `docker-compose.yml` intact) :
sur le réseau `default` de la pile, `postgres` reçoit l'alias
`pdlm-demo-postgres` et `minio` l'alias `pdlm-demo-minio` ; `DATABASE_URI`
d'`app` **et** de `migrate` vise `pdlm-demo-postgres`, `S3_ENDPOINT` d'`app`
vise `http://pdlm-demo-minio:9000` (mêmes variables que le compose de base,
seul l'hôte change). Le seed tourne par le service `migrate` (image
`migrator`) : il hérite donc de l'URI redirigée.

Config fusionnée (`docker compose config`, mot de passe masqué) :

        DATABASE_URI: postgres://postgres:***@pdlm-demo-postgres:5432/pdlm
        S3_ENDPOINT: http://pdlm-demo-minio:9000
          aliases:
        DATABASE_URI: postgres://postgres:***@pdlm-demo-postgres:5432/pdlm
          aliases:
          aliases:

**Essai local rejoué avec un leurre** — `docker network create vps-network`
(absent de la machine, retiré à la fin), puis
`docker run -d --name postgres --network vps-network postgres:17-alpine`
(mot de passe jetable) : la pile doit réussir leurre présent. Réseau résultant :

     vps-network postgres=172.27.0.2/16 pdlm-demo-essai-app-1=172.27.0.3/16
     default pdlm-demo-essai-postgres-1=172.28.0.3/16 pdlm-demo-essai-minio-1=172.28.0.2/16 pdlm-demo-essai-app-1=172.28.0.4/16

Depuis `app`, le nom nu `postgres` désigne l'un ou l'autre conteneur (ici il
a résolu vers 172.28.0.3, celui de la démo — sans aucun contrat : c'est le
lot mesuré par le hub sur le serveur) ; les alias ne dépendent plus de ce
tirage :

     $ docker exec pdlm-demo-essai-app-1 getent hosts pdlm-demo-postgres
     172.28.0.3        pdlm-demo-postgres  pdlm-demo-postgres

Migrations (`docker logs …migrate`, fin) : `Done.` — seed passé **deux fois**
(idempotence : 2 communes, 2 domaines, 3 comptes, 8 pages après le 2e passage).
HTTP sur 127.0.0.1:3110 : `saint-ex` 200, `port-lavanne` 200 (palette littoral
rendue : `--picto-1:#2a7f9e;--picto-2:#d2462f;…#f2b134` dans le `<body>`),
`/api/health` 200, hôte inconnu 404, `[::1]:3110` 200.

Le leurre n'a servi à rien, preuve qu'il n'a pas été joint :

     == le leurre contient-il pdlm ? ==
     0
     == communes de la base démo ==
     saint-ex|t
     port-lavanne|t

Démontage complet (`down -v` volumes et réseau de pile compris, leurre `rm`-é,
`vps-network` retiré — il n'existait pas avant l'essai, images
`pdlm-demo-essai-*` supprimées) ; `docker ps -a` final : plus aucun
`pdlm-demo-essai-*` ni `postgres`, ne restent que les piles dev/prod
préexistantes.

### Retouche B — projet Compose figé dans le `.env` du serveur

**Changé** (`docs/deploiement-demo.md` § 3 et § 10, scripts intacts) : le
`.env` gagne `COMPOSE_PROJECT_NAME=pdlm-demo` et
`COMPOSE_FILE=docker-compose.yml:docker-compose.demo.yml` ; avant toute
sauvegarde/restauration, un contrôle `docker compose ps --all` doit ne lister
que des `pdlm-demo-*` (sinon STOP), car `scripts/backup.sh` et
`scripts/restore.sh` lancent un Compose nu.

Preuve (essai local, projet nommé `pdlm-demo-essai` avec ces deux lignes dans
son `.env` — le `docker compose` nu lancé depuis le dossier de l'essai) :

     $ conteneurs=$(docker compose ps --all --format '{{.Name}}')
     $ printf '%s\n' "$conteneurs"
     pdlm-demo-essai-app-1
     pdlm-demo-essai-createbuckets-1
     pdlm-demo-essai-migrate-1
     pdlm-demo-essai-minio-1
     pdlm-demo-essai-postgres-1
     GARDE B : OK — seuls des conteneurs pdlm-demo-essai-* listés

La pile dev `pdlm-*` pourtant active sur la machine n'apparaît pas : le
projet est bien figé par le `.env`.

### Retouche C — contrôle de la référence déployée

**Changé** (`docs/deploiement-demo.md` § 5) : `git archive main` conservé ;
avant tout `up`, `test -f docker-compose.demo.yml` arrête si la surcouche
absente (une archive d'un `main` sans la démo ne doit pas démarrer une pile
à moitié configurée).

Preuve :

     archive complète (dossier du dépôt) : docker-compose.demo.yml présent → passe
     archive incomplète (dossier simulé vide) : docker-compose.demo.yml absent → STOP

### Retouche D — gestes sûrs pour un serveur mutualisé

**Changé** (`docs/deploiement-demo.md` § 4, 5, 6, 7, 11) :

1. § 4 : `vps-network` doit **exister déjà** sur le serveur — s'il manque,
   arrêt net ; jamais de création à la place (elle n'a servi qu'à l'essai
   local, cf. partie C).
2. § 5 : avant tout `up`, le port 3110 doit être libre (`ss -ltn`).
3. § 5 : avant tout `up`, aucun conteneur de `vps-network` ne doit porter le
   nom **ou l'alias** `app`, `pdlm-demo`, `pdlm-demo-postgres`,
   `pdlm-demo-minio` — ces quatre noms sont réservés à la démo (`app` est le
   nom de service Compose, alias réseau automatique).
4. § 6 : le chargement du `.env` vit dans un sous-shell — aucun secret
   exporté dans la session après la commande.
5. § 7 : Caddyfile partagé — copie horodatée avant édition, `caddy validate`
   avant `caddy reload`, retour arrière écrit, **jamais `caddy restart`**
   (couperait les autres sites).
6. § 11 : désinstallation — retrait du cron optionnel, contrôle
   `test -f <DOSSIER>/docker-compose.demo.yml` avant le `rm -rf`,
   `vps-network` jamais supprimé, `docker rmi` limité aux deux images de la
   démo, **aucun `docker image prune`**.

Preuves (essai local ; `ss` et `flock` n'existent pas sur macOS — le doc
garde `ss` pour le serveur Linux, l'équivalent local est `lsof`) :

     garde réseau, présent :  docker network ls --format '{{.Name}}' | grep -qx vps-network → passe
     garde réseau, absent simulé (réseau retiré) : STOP — « vps-network absent du serveur »

     garde port, pile démarrée (équivalent lsof de ss -ltn | grep ':3110 ') :
     TCP 127.0.0.1:3110 (LISTEN)
     TCP [::1]:3110 (LISTEN)

     garde noms/alias (commande du § 5, telle quelle), pile de démo démarrée :
     STOP — nom ou alias déjà pris sur vps-network : app pdlm-demo
     (le nom de service Compose « app » est lui-même un alias réseau — la garde
     le voit, un second déploiement s'arrêterait avant d'approcher la pile)

     garde noms/alias, leurre isolé portant l'alias pdlm-demo (vps-network
     recréé pour l'occasion, conteneur jeté ensuite) :
     STOP — nom ou alias déjà pris sur vps-network : pdlm-demo
     sans le leurre : rien de pris — la pile peut démarrer

     sous-shell du § 6 : après la commande, DEMO_MDP_ADMIN absent de la session
     (echo ${DEMO_MDP_ADMIN:+PRESENT} → ligne vide)

     caddy validate, copie locale du Caddyfile de démo :
     bloc d'origine   → exit=0, « Valid configuration »
     syntaxe cassée   → exit=1, « Error: adapting config using caddyfile: … syntax error »

### Retouche E — DNS sans enregistrement générique

**Changé** (`docs/deploiement-demo.md` § 1) : le CNAME `*.demo.pdlm.guia.fr`
disparaît ; trois enregistrements explicites le remplacent — `demo` en A
(AAAA si IPv6), `saint-ex.demo` et `port-lavanne.demo` en CNAME vers
`demo.pdlm.guia.fr`. Le § 1 dit aussi pourquoi, et ce que devient l'ajout
d'une commune (un DNS de plus, une ligne Caddy de plus, rien d'ouvert par
avance).

Aucune sortie de commande : rien de jouable localement, la zone DNS vit
chez l'exploitant. Le reste du document était déjà aligné — le bloc Caddy
du § 7 énumère les trois hôtes, le § 11 parle des « trois enregistrements
DNS (§ 1) » ; la seule occurrence restante d'un `*.` est la citation
littérale du journal de succès du seed (§ 6), qui reste exacte.

### Retouche F — cron de re-seed optionnel et verrouillé

**Changé** (`docs/deploiement-demo.md` § 7 et § 9) : le cron de re-seed
reste, présenté **optionnel**, et gagne un verrou `flock` sur
`<DOSSIER>/.verrou` — le même fichier que le `up` de la mise à jour (§ 9),
lancé sous `flock` : le cron s'écarte (`flock -n`) pendant une mise à jour,
la mise à jour attend un cron en cours. Sa ligne cite le comportement réel
et voulu : la démo revient à son état de référence chaque semaine (agenda
re-daté, contenu supprimé recréé), les modifications admin survivent
(upserts, cf. § 6) ; `-e PLATFORM_DOMAIN` complète la liste des `-e`,
alignée sur le § 6. Le retrait du cron à la désinstallation était déjà au
§ 11 point 2 (retouche D).

Preuves :

     sh -n -c '<corps du cron>…' → « sh -n : syntaxe OK (corps du cron, hors flock) »

`flock` n'existe pas sur macOS : le verrou lui-même n'est pas rejouable
localement, il le sera sur le serveur Linux (util-linux). Le corps du cron
hors `flock` est la commande du § 6, elle, éprouvée deux fois dans l'essai
de la partie C et à nouveau lors de la retouche A (idempotence : 2 communes,
2 domaines, 3 comptes, 8 pages après double passage).

### Retouche G — garde-fous du seed renforcés

**Changé** (`src/seed/garde-fous-demo.ts`, `src/seed/demo-en-ligne.ts`,
`tests/unit/garde-fous-demo.spec.ts`) :

- `DEMO_DOMAIN` doit avoir **au moins trois étiquettes** (`guia.fr`,
  `com.fr`, `demo.localhost` refusés ; `demo.pdlm.localhost` passe — trois
  étiquettes est le plancher d'un sous-domaine de démo, pas un domaine
  réel possible) ;
- si `PLATFORM_DOMAIN` est définie, elle doit **égaler** `DEMO_DOMAIN`
  (sinon refus, les deux noms cités, aucune valeur) ;
- le seed refuse toute base contenant une commune hors
  `saint-ex`/`port-lavanne`, **avant toute écriture** ;
- le seed refuse un hostname `<slug>.<DEMO_DOMAIN>` déjà rattaché à une
  autre commune (changer `DEMO_DOMAIN`, ou retirer le domaine).

Preuves.

Unitaires (`npx vitest run tests/unit/garde-fous-demo.spec.ts`) :

     Test Files  1 passed (1)
           Tests  10 passed (10)

À l'exécution, dans l'essai Docker de la retouche A (base de démo montée) :

     commune étrangère créée par REST (valvert), puis seed :
     EXIT=1 — « la base contient 1 commune(s) hors démo (valvert) — le seed
     de démo refuse toute base qui n'est pas la sienne. »
     après suppression de valvert : EXIT=0 (seed passe)

     DEMO_DOMAIN=demo.localhost (deux étiquettes) :
     EXIT=1 — « DEMO_DOMAIN : domaine nu attendu (sans schéma, port ni
     slash), avec au moins trois étiquettes — ex. demo.pdlm.guia.fr, pas
     guia.fr »

     PLATFORM_DOMAIN=autre.chose.example ≠ DEMO_DOMAIN :
     EXIT=1 — « DEMO_DOMAIN et PLATFORM_DOMAIN divergent — le seed exige
     qu'ils soient égaux. » (0 occurrence des deux valeurs dans le journal)

Les messages ne citent jamais les valeurs testées (test dédié : aucune
erreur ne contient la valeur du domaine ni du mot de passe).

## Retouches après la seconde relecture (2026-10-25, brief du hub)

Seconde relecture : REJECTED — six lettres (H à M). Un commit par lettre,
jamais d'`--amend`. Les preuves Docker de ces lettres (isolation réseau,
contrôles du script, ordre de la mise à jour, mesures de fin de procédure)
viennent d'un essai local rejoué sur l'état final : section « Essai local des
retouches H-M » ci-dessous.

### Retouche H — isolation réseau : l'app ne rejoint plus `vps-network`

**Changé** (`docker-compose.demo.yml`, `docs/deploiement-demo.md`) :

- la surcouche déclare le réseau **`pdlm-demo-edge`** (nom fixe :
  `name: pdlm-demo-edge`), créé et possédé par la pile ; plus **aucune**
  référence à `vps-network` ;
- `app` est sur `default` **et** `pdlm-demo-edge`, avec l'alias `pdlm-demo`
  **sur `pdlm-demo-edge` seul** — c'est le seul chemin par lequel le Caddy
  partagé joint l'app (`reverse_proxy pdlm-demo:3000` inchangé) ;
- alias `pdlm-demo-postgres`/`pdlm-demo-minio` et URIs qui les visent :
  conservés (défense en profondeur à coût nul) ;
- procédure (§ 4) : après le `up`, connexion **idempotente** du seul
  conteneur Caddy — `docker network inspect pdlm-demo-edge … | grep -qw
  <CONTENEUR_CADDY> || docker network connect pdlm-demo-edge
  <CONTENEUR_CADDY>` — sans arrêt ni rechargement de Caddy ; la procédure
  documente que cette connexion **disparaît si le conteneur Caddy est
  recréé** (elle survit à un `restart`), symptôme = 502 sur la seule démo,
  remède = rejouer la commande ; et pourquoi ce réseau n'ira **jamais** dans
  le Compose du Caddy partagé (absent à son démarrage, il l'empêcherait de
  démarrer — tous les sites tomberaient) ;
- désinstallation (§ 11) : `docker network disconnect pdlm-demo-edge
  <CONTENEUR_CADDY>` **avant** `down -v` (un point d'accès hors pile
  empêcherait la suppression du réseau), après retrait du bloc Caddy et
  rechargement ;
- contrôles d'alias sur `vps-network` retirés du § 5 : sans objet, la pile
  n'y est plus. Seul contrôle réseau préalable restant : le conteneur Caddy
  existe.

Preuve statique (`docker compose -f docker-compose.yml -f
docker-compose.demo.yml config`, valeurs jetables) — `app` porte
`pdlm-demo` sur `pdlm-demo-edge` seul, `vps-network` absent du rendu :

     networks:
       default: {}
       pdlm-demo-edge:
         aliases:
           - pdlm-demo
     …
     networks:
       pdlm-demo-edge:
         name: pdlm-demo-edge

Les preuves d'exécution (leurre `postgres` invisible depuis l'app, Caddy
simulé joint à `pdlm-demo:3000`, idempotence de la connexion, démontage) :
section « Essai local des retouches H-M ».

### Retouche I — contrôles préalables dans un script rejouable, sans `exit` dans la session

**Changé** (`scripts/demo-controles.sh` créé, `docs/deploiement-demo.md`) :

- `scripts/demo-controles.sh` (`set -euo pipefail`, non interactif, ne
  modifie rien) sort non nul avec un message clair si :
  `docker-compose.demo.yml` absent ; conteneur Caddy (nom en argument)
  introuvable ; port 3110 tenu **par autre chose que la démo elle-même**
  (Docker d'abord — docker-proxy écoute le port quand la pile tourne — puis
  ss/lsof sur l'hôte) ; `docker compose ps` (piloté par le `.env` du dossier)
  liste un conteneur hors `pdlm-demo-*` — une liste vide passe, c'est le
  premier démarrage ;
- la procédure l'appelle en chaîne : `./scripts/demo-controles.sh
  <CONTENEUR_CADDY> && …` au § 5 (avant le `up`) et au § 10 (avant
  `backup.sh`/`restore.sh`, avec en plus le `grep -q '^pdlm-demo-'` qui
  couvre la liste vide) ;
- plus aucun `exit` dans les blocs de la procédure : le `umask 077` du § 3
  passe dans un sous-shell (rien ne fuit dans la session), le garde-fou
  `rm -rf` du § 11 devient un `if … then rm … else message`.

Preuves.

`bash -n scripts/demo-controles.sh` : rien (syntaxe OK). `shellcheck` :
non installé sur la machine d'essai (dit ici faute de pouvoir l'exécuter).

Cas d'échec sans état Docker (sortie non nulle, message, rien d'exécuté
après dans la chaîne) :

     $ ./scripts/demo-controles.sh
     contrôles démo : usage : ./scripts/demo-controles.sh <CONTENEUR_CADDY>  (rc=1)
     $ …/scripts/demo-controles.sh caddy-quelconque   # dossier sans surcouche
     contrôles démo : docker-compose.demo.yml absent — l'archive déployée ne contient pas la démo ; STOP  (rc=1)
     $ ./scripts/demo-controles.sh ce-conteneur-nexiste-pas
     contrôles démo : conteneur Caddy « ce-conteneur-nexiste-pas » introuvable (docker inspect) — STOP  (rc=1)

Cas avec état Docker (port pris par un tiers, Compose visant une autre
pile, cas passant complet) : section « Essai local des retouches H-M ».

### Retouche J — Caddy : édition et retour arrière côté hôte, qui marche

**Changé** (`docs/deploiement-demo.md` § 7) :

- l'édition et la copie horodatée se font **côté hôte**, sur le fichier
  monté : `<CADDYFILE_HOTE>` (hôte) remplace l'ancienne copie `docker exec
  cp` faîte **dans** le conteneur — elle n'était pas récupérable côté hôte,
  et éditer dans le conteneur ne touchait pas forcément le fichier monté ;
  `<CHEMIN_CADDYFILE>` reste le même fichier vu du conteneur ;
- chaîne unique `validate → grep -c → reload`, chaque étape liée par `&&` :
  `caddy validate --config <CHEMIN_CADDYFILE> --adapter caddyfile` avant le
  rechargement, `grep -c pdlm-demo <CHEMIN_CADDYFILE>` ≥ 1 prouve que le
  conteneur **voit** le nouveau bloc — sinon le montage pointe encore sur
  l'ancien inode (fichier remplacé par-dessus au lieu d'écrit) et la
  procédure le dit, avec le geste qui rend l'inode (`cat <source> >
  <CADDYFILE_HOTE>`) ;
- retour arrière : `cat "$SAUVE" > <CADDYFILE_HOTE>` (écrit dans le fichier,
  inode du montage conservé) puis la même chaîne `validate && reload` —
  l'ancienne version validait la copie **depuis le conteneur**, chemin qui
  n'y existe pas quand le montage est un fichier unique ;
- `caddy reload` partout, `restart` nommé pour être banni.

Preuve d'exécution (chaîne complète rejouée sur un `caddy-essai` local,
copie horodatée côté hôte comprise, `grep -c` rendant 1, retour arrière
remettant le Caddyfile d'origine) : section « Essai local des retouches
H-M ».

### Retouche K — commandes non interactives, mise à jour sans redémarrer la base

**Changé** (`docs/deploiement-demo.md` § 6, § 7, § 9) :

- `-T` sur **tous** les `docker compose run` de la procédure : le seed du
  § 6 et le cron du § 7 — aucun pseudo-terminal alloué, commandes
  scriptables, journaux sans séquences de contrôle ;
- mise à jour (§ 9) : `up -d --build --no-deps --force-recreate migrate
  app` — `postgres`, `minio` et `createbuckets` ne sont **pas** recréés, la
  base ne redémarre pas (l'ancienne commande `up --build -d
  --force-recreate migrate app` sans `--no-deps` recréait toute la pile).

`--no-deps` change-t-il l'ordre migration → app ? **Non.** `app` dépend de
`migrate` avec `condition: service_completed_successfully`
(`docker-compose.yml`), et les deux services figurent dans la liste :
`--no-deps` n'exclut que les dépendances **absentes** de la liste (postgres,
minio, createbuckets), Compose attend toujours la fin de `migrate` avant de
démarrer `app`. La procédure le garantit ainsi : ne jamais retirer `migrate`
de cette commande ni de celle du premier `up` (§ 5). Mesure à l'essai :
section « Essai local des retouches H-M ».

### Retouche L — garde-fous du seed, mot de passe sans défaut

**Changé** (`src/seed/garde-fous-demo.ts`, `src/seed/demo-en-ligne.ts`,
`tests/unit/garde-fous-demo.spec.ts`, `docker-compose.demo.yml`) :

- `estHostnameDemo` (partie A) supprimé avec son test : le hostname qu'il
  vérifiait est construit par le code lui-même (`${commune.slug}.${domaine}`)
  à partir du seul `domaine` déjà validé par `erreursEnvironnementDemo`
  (retouche G) — le garde ne pouvait jamais échouer. Les garde-fous réels
  restent ceux de G : base sans commune étrangère, domaines mal rattachés ;
- dans la surcouche, `POSTGRES_PASSWORD` passe en `${POSTGRES_PASSWORD:?…}`
  aux deux endroits où il est repris (`DATABASE_URI` de `migrate` et d'`app`) :
  un mot de passe par défaut n'a rien à faire sur un serveur mutualisé. Le
  `.env` du § 3 de la procédure le génère déjà (openssl) — rien à changer
  côté procédure.

Preuves.

Unitaires (`npx vitest run tests/unit/garde-fous-demo.spec.ts` — le test
« un hostname de démo vit sous DEMO_DOMAIN » disparaît avec sa raison d'être,
les 9 autres passent) :

     Test Files  1 passed (1)
           Tests  9 passed (9)

Lint, typecheck, unitaires complets : 0 erreur, 36 fichiers / 341 tests
passés. Interpolation stricte — `docker compose config` sans
`POSTGRES_PASSWORD` (valeur jetable pour le seul `:?` de PAYLOAD_SECRET,
aucune pile lancée) :

     $ PAYLOAD_SECRET=x docker compose -f docker-compose.yml -f docker-compose.demo.yml config -q
     error while interpolating services.migrate.environment.DATABASE_URI:
     required variable POSTGRES_PASSWORD is missing a value: POSTGRES_PASSWORD requis dans .env
     rc=1

### Retouche M — vérifications de fin de procédure

**Changé** (`docs/deploiement-demo.md` § 8, part « depuis l'extérieur ») :

- `curl -I /admin` : 200 **ou** une redirection vers `/admin/login` — les
  deux prouvent que l'admin est servie par le bloc Caddy ; la valeur mesurée
  à l'essai est consignée dans la section « Essai local des retouches H-M » ;
- `X-Robots-Tag` vérifié sur les **trois** hôtes (`demo`, `saint-ex.demo`,
  `port-lavanne.demo`), via le grep des en-têtes servis — OBLIGATOIRE : un
  grep vide (exit ≠ 0) est un hôte indexable, la procédure dit de corriger
  le bloc Caddy (§ 7) avant de considérer la démo déployée. L'en-tête vient
  du bloc Caddy lui-même (`header X-Robots-Tag "noindex, nofollow"`, § 7) ;
  l'essai le prouve servi par le Caddy d'essai.
