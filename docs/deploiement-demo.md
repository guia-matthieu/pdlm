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

- `demo.pdlm.guia.fr` : enregistrement A (et AAAA si IPv6) vers le serveur ;
- `*.demo.pdlm.guia.fr` : CNAME vers `demo.pdlm.guia.fr` — toute commune
  ajoutée à la démo sera servie sans nouvel enregistrement.

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

La pile s'attache au réseau externe `vps-network` (celui du Caddy partagé) :

```bash
docker network ls | grep -q ' vps-network$' || docker network create vps-network
```

## 5. Build et démarrage

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

Les `DEMO_MDP_*` sont passés au conteneur, pas écrits dans la commande :

```bash
set -a; . ./.env; set +a
docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
  run --rm -e DEMO_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR \
  migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts
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
pas se retrouver dans les moteurs de recherche. Recharger ensuite :

```bash
docker exec <CONTENEUR_CADDY> caddy reload --config <CHEMIN_CADDYFILE>
```

(nom du conteneur Caddy et chemin de sa configuration : connus de
l'exploitant).

Agenda vivant — cron hebdomadaire sur le serveur (`crontab -e`) :

```
17 4 * * 1 cd <DOSSIER> && set -a && . ./.env && set +a && docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml run --rm -e DEMO_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts >> cron-seed-demo.log 2>&1
```

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
docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
  up --build -d --force-recreate migrate app
docker compose -p pdlm-demo --env-file .env \
  -f docker-compose.yml -f docker-compose.demo.yml logs migrate | tail
```

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

1. retirer le bloc `demo.pdlm.guia.fr …` du Caddyfile partagé et recharger
   le Caddy (`docker exec <CONTENEUR_CADDY> caddy reload …`) ;
2. retirer les enregistrements DNS (§ 1) ;
3. `rm -rf <DOSSIER>` — le `.env` disparaît avec, donc les mots de passe des
   comptes de démo : la pile est déjà supprimée, rien n'en dépend ;
4. **ne pas** supprimer `vps-network` : les autres sites du serveur l'utilisent ;
5. au besoin, retirer les images construites : `docker rmi pdlm-demo-app
   pdlm-demo-migrate` (ou `docker image prune`).
