# Déploiement de l'instance de démonstration

Procédure pour l'exploitant du serveur mutualisé. Elle installe pdlm en
démonstration publique : deux communes fictives (saint-ex, gabarit Village ;
port-lavanne, gabarit Littoral), sans son propre Caddy — le serveur a déjà un
Caddy partagé sur 80/443, la pile de démo passe derrière lui.

Spécificités par rapport à une production « normale » (cf. README) :

- la pile ne lance **pas** son Caddy (`docker-compose.demo.yml` le neutralise) ;
- l'app est jointe par le Caddy partagé **par nom de conteneur** : elle est
  rattachée au réseau Docker externe `vps-network` sous l'alias `pdlm-demo` ;
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
Caddy du § 7 — et rien d'ouvert par avance.

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
umask 077                       # .env lisible par son seul propriétaire
: > .env
printf 'DEMO_DOMAIN=%s\n'        demo.pdlm.guia.fr        >> .env
printf 'PLATFORM_DOMAIN=%s\n'    demo.pdlm.guia.fr        >> .env
printf 'ADMIN_URL=%s\n'          https://demo.pdlm.guia.fr >> .env
printf 'NEXT_PUBLIC_APP_URL=%s\n' https://demo.pdlm.guia.fr >> .env
for v in POSTGRES_PASSWORD PAYLOAD_SECRET MINIO_ROOT_PASSWORD S3_APP_PASSWORD \
         DEMO_MDP_OPERATEUR DEMO_MDP_ADMIN DEMO_MDP_REDACTEUR; do
  printf '%s=%s\n' "$v" "$(openssl rand -hex 32)" >> .env
done
printf 'COMPOSE_PROJECT_NAME=%s\n'  pdlm-demo                                  >> .env
printf 'COMPOSE_FILE=%s\n'          'docker-compose.yml:docker-compose.demo.yml' >> .env
```

Les deux dernières lignes figent le projet Compose pour tout `docker compose`
lancé **depuis ce dossier sans `-p` ni `-f`** : `scripts/backup.sh` et
`scripts/restore.sh` (cf. § 10) sont dans ce cas — ils visent ainsi la démo et
rien d'autre. Ne pas lancer de commande Compose d'une autre pile depuis ce
dossier.

- Les 64 caractères hexadécimaux satisfont le garde-fou du seed
  (mots de passe ≥ 16 caractères).
- Rien d'autre à écrire : `DATABASE_URI` et `S3_ENDPOINT` sont générés par
  Compose (réseau interne), `S3_BUCKET`, `S3_REGION`… ont des défauts corrects.
- `NEXT_PUBLIC_S3_PUBLIC_URL` reste par défaut : MinIO n'est pas publié, les
  médias passent par Payload.
- **Conserver ce `.env`** : le cron de rafraîchissement (§ 7) relit les
  `DEMO_MDP_*`. Ils ne sont lus qu'à la **création** des comptes — changer
  `DEMO_MDP_ADMIN` dans le `.env` après coup ne change pas le mot de passe du
  compte existant (à faire depuis l'admin).

## 4. Réseau Docker partagé

La pile s'attache au réseau externe `vps-network` (celui du Caddy partagé).
Sur le serveur mutualisé il **existe déjà** — les autres sites l'utilisent.
S'il manque, quelque chose ne va pas : **arrêt, jamais de création à la
place** (la création n'a servi qu'à l'essai local, cf. notes) :

```bash
docker network ls --format '{{.Name}}' | grep -qx vps-network \
  || { echo 'vps-network absent du serveur — à éclaircir avec l’exploitant, ne pas le créer' >&2; exit 1; }
```

## 5. Build et démarrage

La référence déployée est `main`, fusionné avant déploiement : l'archive doit
contenir la surcouche de démo. Contrôle avant tout `up` :

```bash
test -f docker-compose.demo.yml \
  || { echo 'docker-compose.demo.yml absent — l’archive déployée ne contient pas la démo ; STOP' >&2; exit 1; }
# port de contrôle libre
ss -ltn | grep -q ':3110 ' \
  && { echo 'port 3110 déjà écouté — STOP' >&2; exit 1; } || true
# aucun nom ou alias réservé déjà pris sur le réseau partagé
pris=$( { docker network inspect vps-network --format '{{range .Containers}}{{.Name}} {{end}}'
  for c in $(docker network inspect vps-network --format '{{range .Containers}}{{.Name}} {{end}}'); do
    docker inspect "$c" --format '{{range $net, $cfg := .NetworkSettings.Networks}}{{if eq $net "vps-network"}}{{range $cfg.Aliases}}{{.}} {{end}}{{end}}{{end}}'
  done
} | tr ' ' '\n' | sort -u | grep -xE 'app|pdlm-demo|pdlm-demo-postgres|pdlm-demo-minio' || true)
[ -z "$pris" ] || { echo "nom ou alias déjà pris sur vps-network : $(echo $pris)" >&2; exit 1; }
```

Les noms `app` (nom de service Compose, alias réseau automatique),
`pdlm-demo`, `pdlm-demo-postgres` et `pdlm-demo-minio` sont réservés à la
démo sur `vps-network` : la pile ne démarre pas sur un serveur où un autre
conteneur les porte déjà.

```bash
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml up -d --build
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml logs migrate
# doit se terminer par « Done. »
```

`-p pdlm-demo` est obligatoire : le `docker-compose.yml` de base pose
`name: pdlm-prod`, sans `-p` la démo écraserait toute pile de production du
même serveur.

## 6. Seed de la démo

Les `DEMO_MDP_*` sont passés au conteneur, pas écrits dans la commande. Le
chargement du `.env` vit dans un **sous-shell** : aucun secret n'est exporté
dans la session après la commande :

```bash
( set -a; . ./.env; set +a
  docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
    run --rm -e DEMO_DOMAIN -e PLATFORM_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR \
    migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts )
```

Succès attendu : « Démo en ligne prête — saint-ex (Village) et port-lavanne
(Littoral) sur *.demo.pdlm.guia.fr, comptes operateur@pdlm.invalid,
admin@pdlm.invalid, redacteur@pdlm.invalid. »

Idempotent : le relancer ne crée aucun doublon ; il **re-date** l'agenda de
saint-ex (marché à J+5, conseil municipal à J+12) pour que la démo vive.

Comptes créés (courriels `.invalid`, RFC 2606) :

| Courriel                | Rôle                                     | Mot de passe       |
| ----------------------- | ---------------------------------------- | ------------------ |
| `operateur@pdlm.invalid` | opérateur (toutes communes)              | `DEMO_MDP_OPERATEUR` |
| `admin@pdlm.invalid`    | admin de saint-ex                        | `DEMO_MDP_ADMIN`   |
| `redacteur@pdlm.invalid` | rédacteur de saint-ex                    | `DEMO_MDP_REDACTEUR` |

## 7. Caddy partagé et rafraîchissement périodique

Ajouter au Caddyfile du **Caddy partagé** (conteneur déjà sur
`vps-network`, il résout l'alias) :

```
demo.pdlm.guia.fr, saint-ex.demo.pdlm.guia.fr, port-lavanne.demo.pdlm.guia.fr {
	header X-Robots-Tag "noindex, nofollow"
	reverse_proxy pdlm-demo:3000
}
```

`X-Robots-Tag` interdit l'indexation : une démo avec données fictives ne doit
pas se retrouver dans les moteurs de recherche.

Ce Caddyfile sert **d'autres sites** : copie horodatée avant édition (retour
arrière), validation avant rechargement, et **jamais `caddy restart`** — un
`reload` remplace la configuration à chaud, un `restart` couperait tous les
autres sites le temps du redémarrage :

```bash
SAUVE=<CHEMIN_CADDYFILE>.$(date +%Y%m%d-%H%M%S)
docker exec <CONTENEUR_CADDY> cp <CHEMIN_CADDYFILE> "$SAUVE"    # copie horodatée
# … éditer <CHEMIN_CADDYFILE> pour ajouter le bloc ci-dessus …
docker exec <CONTENEUR_CADDY> caddy validate --config <CHEMIN_CADDYFILE> \
  && docker exec <CONTENEUR_CADDY> caddy reload --config <CHEMIN_CADDYFILE>
```

Retour arrière écrit (si l'édition ou le `reload` pose problème) :

```bash
docker exec <CONTENEUR_CADDY> caddy validate --config "$SAUVE" \
  && docker exec <CONTENEUR_CADDY> caddy reload --config "$SAUVE"
```

(nom du conteneur Caddy et chemin de sa configuration : connus de
l'exploitant).

Agenda vivant — **optionnel** : relancer le seed chaque semaine (`crontab -e`)
remet la démo dans son état de référence — l'agenda est re-daté, un contenu
supprimé par un visiteur est recréé ; les modifications faites dans l'admin
survivent (upserts, cf. § 6). C'est voulu pour une démo :

```
17 4 * * 1 flock -n <DOSSIER>/.verrou sh -c 'cd <DOSSIER> && set -a && . ./.env && set +a && docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml run --rm -e DEMO_DOMAIN -e PLATFORM_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts >> cron-seed-demo.log 2>&1'
```

Le verrou `<DOSSIER>/.verrou` est **le même que celui de la mise à jour**
(§ 9) : le cron s'écarte (`flock -n`) si une mise à jour est en cours, une
mise à jour attend son tour si le cron tourne. `flock` ne connaît pas les
secrets — le `.env` reste lisible par son seul propriétaire (§ 3).

Retrait du cron à la désinstallation : § 11, point 2.

## 8. Vérifications

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
curl -sSI https://demo.pdlm.guia.fr/admin | head -1                          # 200
curl -sSI https://saint-ex.demo.pdlm.guia.fr/ | grep -i x-robots-tag         # noindex, nofollow
```

Connexion admin : `https://demo.pdlm.guia.fr/admin`, `admin@pdlm.invalid` et
le `DEMO_MDP_ADMIN` du `.env`.

## 9. Mettre à jour

```bash
git -C <chemin-du-dépôt> archive main | ssh <HOTE> 'tar -x -C <DOSSIER>'   # ou un SHA précis
ssh <HOTE>
cd <DOSSIER>
flock <DOSSIER>/.verrou docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml \
  up --build -d --force-recreate migrate app
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml logs migrate | tail
```

Le `flock` porte le même verrou que le cron optionnel du § 7 : la mise à
jour attend que le cron en cours finisse, le cron s'écarte tant qu'une
mise à jour tient le verrou.

`--force-recreate migrate` est indispensable (cf. README) : sans lui, un
ancien conteneur `migrate` déjà terminé avec succès peut démarrer l'app sans
jouer la nouvelle migration. Le seed (§ 6) n'est à relancer que si la mise à
jour ajoute des communes ou du contenu de démo.

## 10. Sauvegarde et retour arrière

Avant chaque mise à jour, une sauvegarde (cf. README, « Sauvegarde et
restauration »). Les scripts n'ont ni `-p` ni `-f` : le `.env` du § 3 les
porte (`COMPOSE_PROJECT_NAME`, `COMPOSE_FILE`). **Avant toute sauvegarde ou
restauration**, vérifier que le Compose nu depuis ce dossier ne liste bien
que la démo :

```bash
conteneurs=$(docker compose ps --all --format '{{.Name}}')
printf '%s\n' "$conteneurs"
printf '%s\n' "$conteneurs" | grep -q '^pdlm-demo-' \
  || { echo 'STOP — aucun conteneur pdlm-demo-* : le .env ne vise pas la démo' >&2; exit 1; }
if hors_demo=$(printf '%s\n' "$conteneurs" | grep -v '^pdlm-demo-'); then
  echo "STOP — des conteneurs hors démo seraient visés : $hors_demo" >&2; exit 1
fi
./scripts/backup.sh    # base + bucket cohérents, dans backups/AAAAMMJJ-HHMMSS
```

Même contrôle avant `./scripts/restore.sh <dossier>`.

Les migrations ne sont pas réversibles :

- **retour code seul** (pas de nouvelle migration passée) : re-déployer
  l'ancien SHA (`git archive <SHA> | ssh … tar -x`) puis la commande `up` du § 9 ;
- **migration passée** : restaurer la sauvegarde puis re-déployer l'ancien
  SHA — `./scripts/restore.sh <dossier>` (écrase la base et le bucket).

## 11. Désinstallation

```bash
docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml down -v
```

Puis, dans l'ordre :

1. retirer le bloc `demo.pdlm.guia.fr …` du Caddyfile partagé (copie
   horodatée, `caddy validate` puis `reload`, comme au § 7) ;
2. si le cron optionnel du § 7 a été posé : le retirer (`crontab -e`) ;
3. retirer les trois enregistrements DNS (§ 1) ;
4. contrôle anti-mauvais-dossier, puis suppression — le `.env` disparaît
   avec, donc les mots de passe des comptes de démo : la pile est déjà
   supprimée, rien n'en dépend :

   ```bash
   test -f <DOSSIER>/docker-compose.demo.yml \
     || { echo '<DOSSIER> ne contient pas la démo — STOP avant rm -rf' >&2; exit 1; }
   rm -rf <DOSSIER>
   ```

5. **ne pas** supprimer `vps-network` : les autres sites du serveur l'utilisent ;
6. au besoin, retirer les images construites de la démo :
   `docker rmi pdlm-demo-app pdlm-demo-migrate` — et rien d'autre : jamais
   `docker image prune` sur un serveur mutualisé, il emporterait les images
   des autres sites.
