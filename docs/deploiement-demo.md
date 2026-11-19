# Déploiement de l'instance de démonstration

Procédure pour l'exploitant du serveur mutualisé. Elle installe pdlm en
démonstration publique : deux communes fictives (saint-ex, gabarit Village ;
port-lavanne, gabarit Littoral), sans son propre Caddy — le serveur a déjà un
Caddy partagé sur 80/443, la pile de démo passe derrière lui.

Spécificités par rapport à une production « normale » (cf. README) :

- la pile ne lance **pas** son Caddy (`docker-compose.demo.yml` le neutralise) ;
- l'app est jointe par le Caddy partagé **par nom de conteneur** : la pile
  crée le réseau `pdlm-demo-edge`, l'app y porte l'alias `pdlm-demo` et le
  conteneur Caddy du serveur y est connecté par la procédure (§ 4) — la pile
  ne rejoint **pas** `vps-network`, le réseau des autres sites du serveur ;
- elle publie aussi `127.0.0.1:3110` et `[::1]:3110` (boucle locale IPv4 et
  IPv6) pour les contrôles depuis l'hôte — rien n'est joignable directement
  depuis l'extérieur ;
- le seed `src/seed/demo-en-ligne.ts` crée les communes et les comptes de démo.

Domaines (aucun autre) : `demo.pdlm.guia.fr` (admin), puis
`saint-ex.demo.pdlm.guia.fr` et `port-lavanne.demo.pdlm.guia.fr`.

Les essais locaux qui ont validé cette procédure (build, up, seed double,
curl, login, 404 sur host inconnu) sont consignés dans
`docs/qc/notes-demo-en-ligne.md`, partie C.

## 1. DNS

Trois enregistrements explicites, aucun générique :

- `demo.pdlm.guia.fr` : enregistrement A (et AAAA si IPv6) vers le serveur ;
- `saint-ex.demo.pdlm.guia.fr` : CNAME vers `demo.pdlm.guia.fr` ;
- `port-lavanne.demo.pdlm.guia.fr` : CNAME vers `demo.pdlm.guia.fr`.

Un `*.demo.pdlm.guia.fr` publierait **n'importe quel** sous-domaine résolu
par la pile ; la démo n'en a que trois. Ajouter une commune à la démo
devient : un enregistrement DNS de plus ici, une ligne de plus au bloc
Caddy du § 6 — et rien d'ouvert par avance.

## 2. Copie du code (sans dépôt distant)

Depuis une machine qui a le dépôt :

```bash
git -C <chemin-du-dépôt> archive main | ssh <HOTE> 'mkdir -p <DOSSIER> && tar -x -C <DOSSIER>'
```

`git archive` n'exporte que les fichiers versionnés : aucun `.env` ne part
avec (il n'est jamais versionné).

## 3. Fichier `.env` sur le serveur

Les valeurs secrètes sont générées **sur le serveur**, par substitution de
shell : jamais affichées, jamais dans un journal.

```bash
ssh <HOTE>
cd <DOSSIER>
( umask 077                     # .env lisible par son seul propriétaire —
  # sous-shell : ni le umask ni les variables ne fuient dans la session,
  # et rien ci-dessous n'a besoin d'un `exit`.
  : > .env
  printf 'DEMO_DOMAIN=%s\n'        demo.pdlm.guia.fr        >> .env
  printf 'PLATFORM_DOMAIN=%s\n'    demo.pdlm.guia.fr        >> .env
  printf 'ADMIN_URL=%s\n'          https://demo.pdlm.guia.fr >> .env
  printf 'NEXT_PUBLIC_APP_URL=%s\n' https://demo.pdlm.guia.fr >> .env
  for v in POSTGRES_PASSWORD PAYLOAD_SECRET MINIO_ROOT_PASSWORD S3_APP_PASSWORD \
           DEMO_MDP_OPERATEUR DEMO_MDP_ADMIN DEMO_MDP_REDACTEUR DEMO_MDP_RELAIS; do
    printf '%s=%s\n' "$v" "$(openssl rand -hex 32)" >> .env
  done
  printf 'COMPOSE_PROJECT_NAME=%s\n'  pdlm-demo                                  >> .env
  printf 'COMPOSE_FILE=%s\n'          'docker-compose.yml:docker-compose.demo.yml' >> .env
)
```

Les deux dernières lignes figent le projet Compose pour tout `docker compose`
lancé **depuis ce dossier sans `-p` ni `-f`** : `scripts/backup.sh` et
`scripts/restore.sh` (cf. § 9) sont dans ce cas — ils visent ainsi la démo et
rien d'autre. Ne pas lancer de commande Compose d'une autre pile depuis ce
dossier.

- Les 64 caractères hexadécimaux satisfont le garde-fou du seed
  (mots de passe ≥ 16 caractères).
- Rien d'autre à écrire : `DATABASE_URI` et `S3_ENDPOINT` sont générés par
  Compose (réseau interne), `S3_BUCKET`, `S3_REGION`… ont des défauts corrects.
- `NEXT_PUBLIC_S3_PUBLIC_URL` reste par défaut : MinIO n'est pas publié, les
  médias passent par Payload.
- **Conserver ce `.env`** : le cron de rafraîchissement (§ 6) relit les
  `DEMO_MDP_*`. Ils ne sont lus qu'à la **création** des comptes — changer
  `DEMO_MDP_ADMIN` dans le `.env` après coup ne change pas le mot de passe du
  compte existant (à faire depuis l'admin).

## 4. Build et démarrage

La référence déployée est `main`, fusionné avant déploiement : l'archive doit
contenir la surcouche de démo. Les contrôles préalables (surcouche présente,
conteneur Caddy existant — le seul contrôle réseau préalable, cf. la
connexion du Caddy partagé ci-dessous —, port 3110 libre ou tenu par la démo
elle-même, Compose du dossier ne visant que la démo) vivent dans
`scripts/demo-controles.sh` : rejouables, sans état, ils ne quittent pas la
session — la commande suivante n'est exécutée que s'ils passent :

```bash
./scripts/demo-controles.sh <CONTENEUR_CADDY> \
  && docker compose -p pdlm-demo --env-file .env \
     -f docker-compose.yml -f docker-compose.demo.yml up -d --build
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml logs migrate
# doit se terminer par « Done. »
```

`-p pdlm-demo` est obligatoire : le `docker-compose.yml` de base pose
`name: pdlm-prod`, sans `-p` la démo écraserait toute pile de production du
même serveur.

Si le `up` échoue sur la publication `[::1]:3110` (hôte sans IPv6), retirer
la ligne `- '[::1]:3110:3000'` de l'app dans `docker-compose.demo.yml` et
rejouer le `up` — les contrôles depuis l'hôte restent possibles par
`127.0.0.1:3110`.

### Connexion du Caddy partagé au réseau `pdlm-demo-edge` (après le `up`)

La pile crée son propre réseau `pdlm-demo-edge` (nom fixe, posé par la
surcouche) : l'app y porte l'alias `pdlm-demo`, et c'est le seul chemin par
lequel le Caddy partagé la joint (`reverse_proxy pdlm-demo:3000`). La pile ne
rejoint **pas** `vps-network`, le réseau des autres sites du serveur : aucun
conteneur de la démo n'y figure, aucun conteneur de la démo ne peut voir le
`postgres` ou le site d'un autre hébergé.

Connecter **le seul conteneur Caddy** du serveur à ce réseau — commande
idempotente, à rejouer telle quelle :

```bash
docker network inspect pdlm-demo-edge --format '{{range .Containers}}{{.Name}} {{end}}' \
  | grep -qw <CONTENEUR_CADDY> \
  || docker network connect pdlm-demo-edge <CONTENEUR_CADDY>
```

`docker network connect` n'arrête ni ne recharge Caddy. Deux mises en garde :

- cette connexion **disparaît si le conteneur Caddy est recréé** (elle
  survit à un simple `docker restart`). Symptôme : des **502 sur la seule
  démo**, les autres sites du serveur répondant normalement — remède :
  rejouer la commande ci-dessus ;
- **jamais** ajouter `pdlm-demo-edge` au fichier Compose du Caddy partagé :
  un réseau déclaré mais absent à son démarrage l'empêcherait de démarrer —
  tous les sites du serveur tomberaient. La connexion vit hors Compose,
  c'est voulu.

## 5. Seed de la démo

Les `DEMO_MDP_*` sont passés au conteneur, pas écrits dans la commande. Le
chargement du `.env` vit dans un **sous-shell** : aucun secret n'est exporté
dans la session après la commande :

```bash
( set -a; . ./.env; set +a
  docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
    run --rm -T -e DEMO_DOMAIN -e PLATFORM_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR -e DEMO_MDP_RELAIS \
    migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts )
```

`-T` : pas de pseudo-terminal alloué — la commande est scriptable (cron du
§ 6) et son journal reste lisible, sans séquences de contrôle.

Succès attendu : « Démo en ligne prête — saint-ex (Village) et port-lavanne
(Littoral) sur *.demo.pdlm.guia.fr, comptes operateur@pdlm.invalid,
admin@pdlm.invalid, redacteur@pdlm.invalid, relais@pdlm.invalid. »

Idempotent : le relancer ne crée aucun doublon ; il **re-date** l'agenda de
saint-ex (marché à J+5, conseil municipal à J+12) pour que la démo vive.

Comptes créés (courriels `.invalid`, RFC 2606) :

| Courriel                | Rôle                                     | Mot de passe       |
| ----------------------- | ---------------------------------------- | ------------------ |
| `operateur@pdlm.invalid` | opérateur (toutes communes)              | `DEMO_MDP_OPERATEUR` |
| `admin@pdlm.invalid`    | admin de saint-ex                        | `DEMO_MDP_ADMIN`   |
| `redacteur@pdlm.invalid` | rédacteur de saint-ex                    | `DEMO_MDP_REDACTEUR` |
| `relais@pdlm.invalid`   | admin de saint-ex (compte partenaire externe, aucun rôle global) | `DEMO_MDP_RELAIS` |

### Sauvegarde de référence (juste après le seed)

La restauration nocturne (§ 6) remet chaque nuit la démo dans un état figé :
la sauvegarde de référence, prise maintenant — base et bucket cohérents.
Même chaîne de contrôles qu'au § 9 avant d'appeler le script :

```bash
./scripts/demo-controles.sh <CONTENEUR_CADDY> \
  && docker compose ps --all --format '{{.Name}}' | grep -q '^pdlm-demo-' \
  && ./scripts/backup.sh backups/reference
```

À refaire après toute mise à jour qui change le contenu de démo — la nuit
suivante restaurerait sinon un état périmé. Cette **première** référence se
prend ci-dessus ; la **refonte** après mise à jour est une seule commande
(§ 8), qui restaure d'abord la référence actuelle : elle ne capture jamais
ce que les visiteurs ont écrit dans la journée.

`backup.sh` porte `umask 077` : `backups/` et tout ce qu'il contient
naissent inaccessibles aux autres. Pour un `backups/` créé avant cette
garantie :

```bash
chmod 700 backups
```

## 6. Caddy partagé et rafraîchissement périodique

Ce bloc publie une démo **publique** : ouverte en écriture à quiconque se
connecte au compte relais partagé (mot de passe public), où **tout ce qui y
est publié est visible de tous** jusqu'à la restauration de la nuit — et
**plafonnée** pour ne pas pouvoir nuire au reste du serveur (retouche Y) :
21 MiB par requête (`max_size` ci-dessous), 20 Mo par fichier (limite de
l'app), 2 Gio de quota sur le bucket, et pour la pile 768 Mo / 1,5 CPU /
128 processus pour l'app, 512 Mo / 1 CPU / 128 pour PostgreSQL, 768 Mo /
1 CPU / 128 pour MinIO — surchargeables par `.env` (variables
`DEMO_*_MEM_LIMIT`, `DEMO_*_CPUS`, `DEMO_*_PIDS_LIMIT`, `DEMO_S3_QUOTA`).

Le Caddyfile est **monté** dans le conteneur Caddy : édition et copie se
font côté **hôte**, sur le fichier monté. `<CADDYFILE_HOTE>` désigne son
chemin côté hôte, `<CHEMIN_CADDYFILE>` le même fichier vu depuis le
conteneur (conteneur connecté à `pdlm-demo-edge`, § 4, il résout l'alias).
Ajouter le bloc :

```
demo.pdlm.guia.fr, saint-ex.demo.pdlm.guia.fr, port-lavanne.demo.pdlm.guia.fr {
	header X-Robots-Tag "noindex, nofollow"
	request_body {
		max_size 21MiB
	}
	reverse_proxy pdlm-demo:3000
}
```

`max_size 21MiB` (retouche Y) : juste au-dessus de la limite de l'app —
`limiterTaille(20)` sur Media et Documents, soit 20 Mo par fichier, lus dans
la config — plus le cadrage multipart. Au-delà, Caddy refuse (413) AVANT que
la requête n'atteigne l'app ; entre 20 et 21 MiB, c'est l'app qui refuse avec
son message. Le tampon du proxy Next est aligné dessus
(`proxyClientMaxBodySize: '21mb'` dans `next.config.ts`) : monter la limite
applicative veut dire ajuster les DEUX et ce max_size.

`X-Robots-Tag` interdit l'indexation : une démo avec données fictives ne doit
pas se retrouver dans les moteurs de recherche.

Ce Caddyfile sert **d'autres sites** : copie horodatée côté hôte avant
édition, validation avant rechargement, et **jamais `caddy restart`** — un
`reload` remplace la configuration à chaud, un `restart` couperait tous les
autres sites le temps du redémarrage. Chaque étape enchaînée par `&&` :

```bash
SAUVE=<CADDYFILE_HOTE>.$(date +%Y%m%d-%H%M%S)
cp <CADDYFILE_HOTE> "$SAUVE"    # copie horodatée, côté hôte
# … éditer <CADDYFILE_HOTE> côté hôte pour ajouter le bloc ci-dessus …
docker exec <CONTENEUR_CADDY> caddy validate --config <CHEMIN_CADDYFILE> --adapter caddyfile \
  && docker exec <CONTENEUR_CADDY> grep -c pdlm-demo <CHEMIN_CADDYFILE> \
  && docker exec <CONTENEUR_CADDY> caddy reload --config <CHEMIN_CADDYFILE> --adapter caddyfile
```

Le `grep -c pdlm-demo` (≥ 1) prouve que le **conteneur voit le nouveau
bloc** : s'il rend 0, le montage pointe encore sur l'ancien inode — le
fichier a été remplacé par-dessus (éditeur qui réécrit, `mv`, `cp` d'une
source vers le fichier monté) au lieu d'être écrit. Reprendre l'édition en
écrivant **dans** le fichier (`cat <source> > <CADDYFILE_HOTE>`), puis
rejouer la chaîne ci-dessus.

Retour arrière écrit (si l'édition ou le `reload` pose problème) : la copie
horodatée sert de source, réécrite dans le fichier monté — l'inode du
montage est conservé — puis validée avant rechargement :

```bash
cat "$SAUVE" > <CADDYFILE_HOTE>
docker exec <CONTENEUR_CADDY> caddy validate --config <CHEMIN_CADDYFILE> --adapter caddyfile \
  && docker exec <CONTENEUR_CADDY> caddy reload --config <CHEMIN_CADDYFILE> --adapter caddyfile
```

(nom du conteneur Caddy et chemins de sa configuration : connus de
l'exploitant).

### Restauration nocturne (`crontab -e`)

Chaque nuit à 3 h 17, la démo revient à sa sauvegarde de référence (§ 5),
les migrations sont rejouées (retouche AA), puis le seed re-date l'agenda.
À énoncer clairement aux visiteurs de la démo :

- l'app est **coupée** pendant la restauration — quelques dizaines de
  secondes vers 3 h 17, un visiteur de cette fenêtre voit une erreur
  passagère ;
- **tout ce qui a été écrit dans la journée disparaît** : pages modifiées,
  actualités créées, médias déposés, essais faits dans l'admin — la base et
  le bucket reviennent à l'état de référence ;
- l'agenda seul reste vivant : le seed le re-date (marché à J+5, conseil
  municipal à J+12).

La crontab appelle un script — `scripts/demo-restauration-nuit.sh` — qui
prend lui-même le verrou, enchaîne les étapes (contrôles, pile présente,
restauration de la référence, migrations, seed) et journalise chacune :

```
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * <DOSSIER>/scripts/demo-restauration-nuit.sh <CONTENEUR_CADDY>
```

La ligne `PATH=` est explicite : cron démarre avec un PATH minimal. Sur une
Debian/Ubuntu standard, tout ce que le script demande y est couvert —
`docker` (`docker-ce-cli`, `/usr/bin/docker`), le plugin compose, `flock`
(`util-linux`, `/usr/bin/flock`).

Détails qui comptent :

- le journal va dans `<DOSSIER>/restauration.log` (créé en 600) : une ligne
  `<date> <étape> rc=<n>` par étape, `ÉCHEC <étape> rc=<n>` sur la première
  qui échoue — le script s'arrête là, sortie non nulle ; jamais une valeur
  du `.env` n'y figure, seuls des noms de variables sortent ;
- `scripts/restore.sh` ne demande **aucune confirmation** (aucune invite,
  tout y est `-T`) : le cron l'appelle directement — jamais `yes | …` ;
- l'étape finale (seed) re-date l'agenda et recrée au besoin les comptes et
  communes manquants : la base restaurée reste celle de référence, seul
  l'agenda vit ;
- l'étape `migration` (retouche AA) rejoue `payload migrate` avec le code
  déployé : la référence a été prise à un moment donné, une mise à jour
  (§ 8) peut avoir passé une migration depuis. D'ordinaire la refonte du
  § 8 a déjà mis la référence au niveau du code et l'étape ne fait rien
  (`rc=0`) — c'est un filet pour la mise à jour dont la refonte de
  référence aurait été oubliée.

Le verrou `<DOSSIER>/.verrou` est **le même que celui de la mise à jour**
(§ 8) : le cron s'écarte (`flock -n`) si une mise à jour est en cours, une
mise à jour attend son tour si le cron tourne. Une nuit écartée signe
« nuit sautée, verrou pris » au journal et sort 75 (EX_TEMPFAIL : rien à
faire, ce n'est pas une panne). `flock` ne connaît pas les secrets — le
`.env` reste lisible par son seul propriétaire (§ 3).

### Le matin : vérifier la nuit

```bash
tail -n 15 <DOSSIER>/restauration.log
```

Une nuit réussie finit par « nuit terminée rc=0 ». Sur une ligne
`ÉCHEC <étape> rc=<n>` :

- `ÉCHEC contrôles` ou `ÉCHEC pile` : **rien n'a été touché** — lire les
  lignes au-dessus (conteneur Caddy renommé ? pile jamais redémarrée après
  un reboot du serveur ? relancer le § 4), puis rejouer la nuit à la main :
  `<DOSSIER>/scripts/demo-restauration-nuit.sh <CONTENEUR_CADDY>` ;
- `ÉCHEC restauration` : la sortie de `restore.sh` est dans le journal,
  juste au-dessus. Deux cas (retouche U) —
  - échec **avant** la bascule (« la base en service … n'ont pas été
    touchés ») : l'app n'a jamais été arrêtée, le site est debout sur
    l'état de la veille ; corriger la cause, rejouer la nuit ;
  - échec **après** la bascule (« l'application reste arrêtée ») : **le
    site est coupé** — agir d'abord. La base d'origine
    (`<db>_precedente`) existe encore ; le journal porte les commandes du
    retour arrière (deux `ALTER DATABASE … RENAME`, puis
    `docker compose start app`) ;
- `ÉCHEC migration` (retouche AA) : la base est restaurée et l'app tourne,
  sur un schéma plus ancien que le code — signe d'une mise à jour avec
  migration dont la référence n'a pas été refaite. Faire
  `./scripts/demo-refaire-reference.sh <CONTENEUR_CADDY>` (§ 8) : elle
  remet la référence, base et bucket, au niveau du code courant ;
- `ÉCHEC seed` : la base est restaurée et l'app tourne — l'agenda n'est pas
  re-daté, c'est tout. Le seed est idempotent : rejouer la nuit, ou la
  commande du § 5.

Retrait du cron à la désinstallation : § 10, point 4.

## 7. Vérifications

Depuis le serveur (contrôle direct, hors Caddy) :

```bash
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: saint-ex.demo.pdlm.guia.fr' http://127.0.0.1:3110/
# 200 — et pareil avec Host: port-lavanne.demo.pdlm.guia.fr
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3110/api/health    # 200
curl -sS -o /dev/null -w '%{http_code}\n' -H 'Host: inconnu.demo.pdlm.guia.fr' http://127.0.0.1:3110/
# 404
```

Depuis l'extérieur, après le bloc Caddy :

```bash
curl -sSI https://demo.pdlm.guia.fr/admin | head -1
# 200 — ou une redirection vers /admin/login : les deux prouvent que l'admin
# est servie par le bloc Caddy (mesuré à l'essai local, cf.
# docs/qc/notes-demo-en-ligne.md « Essai local des retouches H-M »).
curl -sSI https://demo.pdlm.guia.fr/ | grep -i x-robots-tag
curl -sSI https://saint-ex.demo.pdlm.guia.fr/ | grep -i x-robots-tag
curl -sSI https://port-lavanne.demo.pdlm.guia.fr/ | grep -i x-robots-tag
# « X-Robots-Tag: noindex, nofollow » attendu sur les TROIS — vérification
# OBLIGATOIRE : un grep qui ne rend rien (exit ≠ 0) = un hôte indexable,
# corriger le bloc Caddy (§ 6) avant de considérer la démo déployée.
```

Connexion admin : `https://demo.pdlm.guia.fr/admin`, `admin@pdlm.invalid` et
le `DEMO_MDP_ADMIN` du `.env`.

## 8. Mettre à jour

```bash
git -C <chemin-du-dépôt> archive main | ssh <HOTE> 'tar -x -C <DOSSIER>'   # ou un SHA précis
ssh <HOTE>
cd <DOSSIER>
flock <DOSSIER>/.verrou docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml \
  up -d --build --no-deps --force-recreate migrate app
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml logs migrate | tail
```

Le `flock` porte le même verrou que le cron de restauration nocturne du
§ 6 : la mise à
jour attend que le cron en cours finisse, le cron s'écarte tant qu'une
mise à jour tient le verrou.

`--no-deps` : la mise à jour ne recrée **ni** `postgres`, **ni** `minio`,
**ni** `createbuckets` — la base ne redémarre pas. L'ordre migration → app
ne change pas : `app` dépend de `migrate` (`service_completed_successfully`,
`docker-compose.yml`) et les deux services sont dans la liste, `--no-deps`
n'exclut que les dépendances **absentes** de la liste — Compose attend donc
la fin de `migrate` avant de démarrer `app` (mesuré à l'essai : `migrate`
fini avant le démarrage de `app`, cf. notes).

`--force-recreate migrate` est indispensable (cf. README) : sans lui, un
ancien conteneur `migrate` déjà terminé avec succès peut démarrer l'app sans
jouer la nouvelle migration.

Quel cas ? Trancher par une commande, pas au jugé — la réponse dépend des
migrations, invisibles depuis le contenu :

```bash
git -C <chemin-du-dépôt> diff --name-only <ANCIEN> <NOUVEAU> -- src/migrations
# aucune sortie : pas de migration ; un fichier ou plus : migration passée
```

- **ni migration, ni contenu de démo changé** (correctif seul) : le `up`
  ci-dessus suffit ;
- **migration passée OU contenu de démo changé** (communes, seed) :
  `demo-refaire-reference.sh` est **obligatoire** — **une seule commande**
  fait les quatre pas, ne lance pas le `up` à part :

```bash
./scripts/demo-refaire-reference.sh <CONTENEUR_CADDY>
```

Pourquoi la migration impose la refonte (retouche AA) : la nuit (§ 6)
restaure `backups/reference`, prise AVANT la migration — sans refonte, le
code neuf repartirait chaque nuit sur le schéma ancien. La nuit rejoue
désormais `migrate` après la restauration (filet, § 6), mais le filet ne
remplace pas la règle : seule la refonte met la référence — base et
bucket — au niveau du nouveau code.

Le script porte lui-même le verrou (le même que la nuit du § 6 et que le
`up` du haut, `flock` bloquant : il attend son tour) et enchaîne dans
l'ordre : restauration de la référence actuelle → mise à jour (le `up`
ci-dessus) → seed (§ 5) → sauvegarde vers `backups/reference`. Sans la
refonte, la nuit rendrait un contenu périmé ; en repartant de la référence,
la nouvelle référence ne capture jamais la journée des visiteurs.

## 9. Sauvegarde et retour arrière

Avant chaque mise à jour, une sauvegarde (cf. README, « Sauvegarde et
restauration »). Les scripts n'ont ni `-p` ni `-f` : le `.env` du § 3 les
porte (`COMPOSE_PROJECT_NAME`, `COMPOSE_FILE`). **Avant toute sauvegarde ou
restauration**, les contrôles de `scripts/demo-controles.sh` (dont « le
Compose de ce dossier ne vise que la démo ») puis la présence effective des
conteneurs — une liste vide (`.env` cassé, pile jamais démarrée) ne doit pas
arriver jusqu'à `backup.sh` :

```bash
./scripts/demo-controles.sh <CONTENEUR_CADDY> \
  && docker compose ps --all --format '{{.Name}}' | grep -q '^pdlm-demo-' \
  && ./scripts/backup.sh    # base + bucket cohérents, dans backups/AAAAMMJJ-HHMMSS
```

Même chaîne avant `./scripts/restore.sh <dossier>`.

Les migrations ne sont pas réversibles :

- **retour code seul** (pas de nouvelle migration passée) : re-déployer
  l'ancien SHA (`git archive <SHA> | ssh … tar -x`) puis la commande `up` du § 8 ;
- **migration passée** : restaurer la sauvegarde puis re-déployer l'ancien
  SHA — `./scripts/restore.sh <dossier>` (écrase la base et le bucket).

## 10. Désinstallation

Dans l'ordre (les gestes Caddy sont détaillés au § 6) :

1. retirer le bloc `demo.pdlm.guia.fr …` du Caddyfile partagé (copie
   horodatée, `caddy validate` puis `reload`, comme au § 6) ;
2. déconnecter le Caddy partagé du réseau de la pile — **avant** le `down`
   qui suit, sinon le réseau ne peut pas être supprimé (un point d'accès
   hors pile l'y retient) :

   ```bash
   docker network disconnect pdlm-demo-edge <CONTENEUR_CADDY>
   ```

3. démonter la pile (volumes compris) :

   ```bash
   docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml down -v
   ```

4. retirer le cron de restauration nocturne (§ 6) s'il a été posé
   (`crontab -e`) ;
5. retirer les trois enregistrements DNS (§ 1) ;
6. contrôle anti-mauvais-dossier, puis suppression — le `.env` disparaît
   avec, donc les mots de passe des comptes de démo : la pile est déjà
   supprimée, rien n'en dépend :

   ```bash
   if [ -f <DOSSIER>/docker-compose.demo.yml ]; then
     rm -rf <DOSSIER>
   else
     echo '<DOSSIER> ne contient pas la démo — rm -rf non exécuté' >&2
   fi
   ```

7. au besoin, retirer les images construites de la démo :
   `docker rmi pdlm-demo-app pdlm-demo-migrate` — et rien d'autre : jamais
   `docker image prune` sur un serveur mutualisé, il emporterait les images
   des autres sites.
