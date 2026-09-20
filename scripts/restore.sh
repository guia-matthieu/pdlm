#!/usr/bin/env bash
# glm — restauration d'une sauvegarde créée par scripts/backup.sh
#
# ATTENTION : écrase la base et le bucket actuels. Procédure avec arrêt
# applicatif (fenêtre de maintenance), migrations non appliquées par ce script
# (la base restaurée contient déjà le schéma de la sauvegarde).
#
# Usage : ./scripts/restore.sh <dossier-de-sauvegarde>

set -euo pipefail
cd "$(dirname "$0")/.."

# Configuration lue dans les conteneurs — voir l'explication dans backup.sh.
valeur_conteneur() { # $1=service $2=variable $3=valeur par défaut
  local lue=''
  lue=$(docker compose exec -T "$1" printenv "$2" 2>/dev/null | tr -d '\r\n') || true
  printf '%s' "${lue:-$3}"
}

DOSSIER=${1:?Usage : ./scripts/restore.sh <dossier-de-sauvegarde>}
[ -f "$DOSSIER/postgres.sql.gz" ] || {
  echo "Introuvable : $DOSSIER/postgres.sql.gz" >&2
  exit 1
}
[ -d "$DOSSIER/s3" ] || {
  echo "Introuvable : $DOSSIER/s3" >&2
  exit 1
}
DOSSIER_ABS=$(cd "$DOSSIER" && pwd)

POSTGRES_USER=${POSTGRES_USER:-$(valeur_conteneur postgres POSTGRES_USER postgres)}
POSTGRES_DB=${POSTGRES_DB:-$(valeur_conteneur postgres POSTGRES_DB glm)}
# Lu AVANT l'arrêt de l'application (plus joignable ensuite).
S3_BUCKET=${S3_BUCKET:-$(valeur_conteneur app S3_BUCKET glm)}

# Une sauvegarde illisible détectée APRÈS avoir supprimé la base, c'est la
# perte des données : on vérifie avant de toucher à quoi que ce soit.
gunzip -t "$DOSSIER_ABS/postgres.sql.gz" 2>/dev/null || {
  echo "ÉCHEC : $DOSSIER/postgres.sql.gz est illisible — restauration annulée." >&2
  exit 1
}

redemarrer_app() {
  echo "Redémarrage de l'application…"
  docker compose start app >/dev/null 2>&1 || true
}
trap redemarrer_app EXIT

echo "1/5 — Arrêt de l'application (fenêtre de maintenance)…"
docker compose stop app >/dev/null

echo "2/5 — Restauration PostgreSQL (la base actuelle est écrasée)…"
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid <> pg_backend_pid();" \
  -c "DROP DATABASE IF EXISTS $POSTGRES_DB;" \
  -c "CREATE DATABASE $POSTGRES_DB;"
gunzip -c "$DOSSIER_ABS/postgres.sql.gz" \
  | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "3/5 — Restauration du bucket S3…"
# `--remove` : sans lui, les fichiers ajoutés après la sauvegarde survivaient
# à la restauration — le bucket n'était pas remis dans l'état sauvegardé.
docker compose run --rm -T \
  -e S3_BUCKET="$S3_BUCKET" \
  -v "$DOSSIER_ABS/s3:/sauvegarde:ro" \
  --entrypoint /bin/sh \
  minio -c '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc mb --ignore-existing "local/$S3_BUCKET"
    mc mirror --overwrite --remove /sauvegarde "local/$S3_BUCKET"
  '

echo "4/5 — Redémarrage de l'application…"
trap - EXIT
redemarrer_app

echo "5/5 — État des services :"
docker compose ps --format 'table {{.Name}}\t{{.Status}}'

echo
echo "Restauration terminée depuis : $DOSSIER"
