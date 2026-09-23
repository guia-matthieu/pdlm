#!/usr/bin/env bash
# pdlm — restauration d'une sauvegarde créée par scripts/backup.sh
#
# ATTENTION : écrase la base et le bucket actuels. Procédure avec arrêt
# applicatif (fenêtre de maintenance), migrations non appliquées par ce script
# (la base restaurée contient déjà le schéma de la sauvegarde) — et, si la
# sauvegarde contient umami.sql.gz, la base de mesure d'audience, purgée à
# 25 mois avant remise en service.
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
POSTGRES_DB=${POSTGRES_DB:-$(valeur_conteneur postgres POSTGRES_DB pdlm)}
# Lu AVANT l'arrêt de l'application (plus joignable ensuite).
S3_BUCKET=${S3_BUCKET:-$(valeur_conteneur app S3_BUCKET pdlm)}

# Une sauvegarde illisible détectée APRÈS avoir supprimé la base, c'est la
# perte des données : on vérifie avant de toucher à quoi que ce soit.
gunzip -t "$DOSSIER_ABS/postgres.sql.gz" 2>/dev/null || {
  echo "ÉCHEC : $DOSSIER/postgres.sql.gz est illisible — restauration annulée." >&2
  exit 1
}

# Mesure d'audience : prérequis vérifiés avant la moindre écriture.
if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  gunzip -t "$DOSSIER_ABS/umami.sql.gz" 2>/dev/null || {
    echo "ÉCHEC : $DOSSIER/umami.sql.gz est illisible — restauration annulée." >&2
    exit 1
  }
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='umami'" | grep -q 1 || {
    echo "ÉCHEC : rôle umami absent — restauration annulée. Lancer d'abord : docker compose --profile mesure up init-umami" >&2
    exit 1
  }
  # Services de mesure qui tournent maintenant : ceux-là, et eux seuls, seront relancés.
  MESURE_ACTIFS=$(docker compose --profile mesure ps --status running --services | grep -E '^(umami|purge-mesure)$' || true)
fi

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

if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  echo "2/5 — Restauration de la mesure d'audience (base umami)…"
  # Umami et la purge tiennent des connexions : arrêtés le temps de la restauration.
  if [ -n "$MESURE_ACTIFS" ]; then docker compose --profile mesure stop $MESURE_ACTIFS >/dev/null; fi
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='umami' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS umami;" \
    -c "CREATE DATABASE umami OWNER umami;"
  gunzip -c "$DOSSIER_ABS/umami.sql.gz" \
    | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami
  # I21 : une sauvegarde ancienne contient des visites devenues trop vieilles.
  # Purge immédiate, avant toute remise en service ; un échec arrête le script.
  echo "     purge des données de plus de 25 mois…"
  docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami -f - \
    <scripts/purge-mesure.sql >/dev/null
  # --wait : attend la santé (Umami) ou le démarrage (purge) ; échoue sinon.
  if [ -n "$MESURE_ACTIFS" ]; then docker compose --profile mesure up -d --wait $MESURE_ACTIFS; fi
fi

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
