#!/usr/bin/env bash
# pdlm démo — restauration nocturne (appelé par cron)
#
# Retouche W — la nuit est un script : la crontab se réduit à l'appeler.
# Chaque étape écrit une ligne « <date> <étape> rc=<n> » dans
# restauration.log ; la première qui échoue s'arrête là — ligne
# « <date> ÉCHEC <étape> rc=<n> », sortie non nulle. Plus de « || echo »
# qui rendait 0 : un échec se voit le matin (queue du journal, § 6).
# Le journal ne reçoit jamais une valeur du `.env`.
#
# Verrou : le même que la mise à jour (§ 8) et la refonte de référence
# (demo-refaire-reference.sh). Déjà tenu → « nuit sautée, verrou pris »,
# sortie 75 (EX_TEMPFAIL : rien à faire, ce n'est pas une panne).
#
# Usage : ./scripts/demo-restauration-nuit.sh <CONTENEUR_CADDY>

set -euo pipefail
umask 077 # le journal ne regarde personne
cd "$(dirname "$0")/.."

CONTENEUR_CADDY=${1:?Usage : ./scripts/demo-restauration-nuit.sh <CONTENEUR_CADDY>}
JOURNAL=restauration.log

# Journal créé en 600 s'il n'existe pas (l'umask ci-dessus s'en charge).
[ -f "$JOURNAL" ] || : >"$JOURNAL"

exec 9>./.verrou
if ! flock -n 9; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') nuit sautée, verrou pris" >>"$JOURNAL"
  exit 75
fi

# etape <nom> <commande…> : la sortie de la commande va au journal, puis une
# ligne « <date> <nom> rc=<n> » ; au premier échec, « <date> ÉCHEC <nom>
# rc=<n> » et on S'ARRÊTE (sortie 1). NB : l'appelant teste le code de la
# commande, set -e ne s'y applique donc pas — les fonctions à plusieurs
# ordres (seed_demo) enchaînent tout par &&.
etape() { # $1=nom de l'étape, le reste : la commande
  local nom=$1 rc=0
  shift
  "$@" >>"$JOURNAL" 2>&1 || rc=$?
  echo "$(date '+%Y-%m-%d %H:%M:%S') $nom rc=$rc" >>"$JOURNAL"
  if [ "$rc" -ne 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ÉCHEC $nom rc=$rc" >>"$JOURNAL"
    exit 1
  fi
}

pile_presente() { # grep seul juge : « docker compose ps » rend 0 même sans
  # aucun conteneur — une pile absente (.env cassé, reboot) ne doit pas passer.
  docker compose ps --all --format '{{.Name}}' | grep -q '^pdlm-demo-'
}

seed_demo() { # && partout : etape() teste le code, set -e ne s'applique pas.
  set -a && . ./.env && set +a \
    && docker compose -p pdlm-demo --env-file .env -f docker-compose.yml -f docker-compose.demo.yml \
       run --rm -T -e DEMO_DOMAIN -e PLATFORM_DOMAIN -e DEMO_MDP_OPERATEUR -e DEMO_MDP_ADMIN -e DEMO_MDP_REDACTEUR -e DEMO_MDP_RELAIS \
       migrate node node_modules/payload/bin.js run src/seed/demo-en-ligne.ts
}

etape contrôles ./scripts/demo-controles.sh "$CONTENEUR_CADDY"
etape pile pile_presente
etape restauration ./scripts/restore.sh backups/reference
etape seed seed_demo

echo "$(date '+%Y-%m-%d %H:%M:%S') nuit terminée rc=0" >>"$JOURNAL"
