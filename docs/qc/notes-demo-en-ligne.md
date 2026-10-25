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
| (ce commit) | C | Essai Docker complet local (`pdlm-demo-essai`), preuves ci-dessous |

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
