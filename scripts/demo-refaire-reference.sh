#!/usr/bin/env bash
# pdlm démo — refaire la sauvegarde de référence après une mise à jour
#
# Retouche V — UNE seule commande, pas quatre pas qu'un humain enchaîne à la
# main : restauration de la référence actuelle → mise à jour (build,
# migrations) → seed → sauvegarde vers backups/reference. La référence
# capturée repart donc toujours de l'état figé précédent : ce que les
# visiteurs ont écrit dans la journée n'y entre jamais.
#
# Le verrou est le MÊME que celui de la restauration nocturne
# (demo-restauration-nuit.sh) et des mises à jour manuelles (§ 8 de
# docs/deploiement-demo.md). Bloquant : refaire la référence après la nuit
# vaut mieux que repartir sans en faire.
#
# Usage : ./scripts/demo-refaire-reference.sh <CONTENEUR_CADDY>

set -euo pipefail
cd "$(dirname "$0")/.."

CONTENEUR_CADDY=${1:?Usage : ./scripts/demo-refaire-reference.sh <CONTENEUR_CADDY>}

[ -f backups/reference/postgres.sql.gz ] || {
  echo "Introuvable : backups/reference/postgres.sql.gz — la PREMIÈRE référence se fait juste après le seed (§ 5 de docs/deploiement-demo.md), pas par ce script." >&2
  exit 1
}

exec 9>./.verrou
flock 9

echo "=== $(date '+%Y-%m-%d %H:%M:%S') refonte de la référence — contrôles"
./scripts/demo-controles.sh "$CONTENEUR_CADDY"
docker compose ps --all --format '{{.Name}}' | grep -q '^pdlm-demo-'

echo "=== $(date '+%Y-%m-%d %H:%M:%S') restauration de la référence actuelle"
./scripts/restore.sh backups/reference

echo "=== $(date '+%Y-%m-%d %H:%M:%S') mise à jour (build, migrations)"
docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
  up -d --build --no-deps --force-recreate migrate app

echo "=== $(date '+%Y-%m-%d %H:%M:%S') seed"
# Même sous-shell que § 5 : les DEMO_MDP_* passent au conteneur sans rester
# exportés dans la session.
( set -a; . ./.env; set +a
  docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
    run --rm -T -e DEMO_DOMAIN -e PLATFORM_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR -e DEMO_MDP_RELAIS \
    migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts )

echo "=== $(date '+%Y-%m-%d %H:%M:%S') sauvegarde vers backups/reference"
./scripts/backup.sh backups/reference

echo "Référence refaite — la nuit prochaine restaurera l'état du jour."
