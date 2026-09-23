#!/usr/bin/env bash
# pdlm — sauvegarde cohérente PostgreSQL + S3 (MinIO)
#
# Cohérence (plan J7) : l'application est ARRÊTÉE pendant la sauvegarde
# (fenêtre de maintenance) — un pg_dump + mc mirror sous écritures
# concurrentes ne garantit pas la cohérence entre base et fichiers.
#
# Usage : ./scripts/backup.sh [dossier-destination]
# Le dossier reçoit : postgres.sql.gz + s3/ (contenu du bucket) + umami.sql.gz
# si la mesure d'audience est installée

set -euo pipefail
cd "$(dirname "$0")/.."

# La configuration est lue dans les CONTENEURS, pas en sourçant `.env`.
# Deux raisons : `.env` suit la syntaxe Docker Compose, pas celle du shell
# (une seule ligne un peu libre et `. ./.env` tue le script) ; et le sourcer
# exporterait tous les secrets du projet à chaque processus fils.
# Une variable déjà présente dans l'environnement reste prioritaire.
valeur_conteneur() { # $1=service $2=variable $3=valeur par défaut
  local lue=''
  lue=$(docker compose exec -T "$1" printenv "$2" 2>/dev/null | tr -d '\r\n') || true
  printf '%s' "${lue:-$3}"
}

# Un dump tronqué est pire qu'une absence de dump : on vérifie qu'il se
# décompresse entièrement et qu'il contient bien du SQL.
verifier_dump() { # $1=fichier $2=libellé
  if ! gunzip -t "$1" 2>/dev/null; then
    echo "ÉCHEC : le dump $2 est illisible." >&2
    exit 1
  fi
  if ! gunzip -c "$1" | grep -q 'PostgreSQL database dump complete'; then
    echo "ÉCHEC : le dump $2 est incomplet (marqueur de fin absent)." >&2
    exit 1
  fi
}

DOSSIER=${1:-backups/$(date +%Y%m%d-%H%M%S)}
POSTGRES_USER=${POSTGRES_USER:-$(valeur_conteneur postgres POSTGRES_USER postgres)}
POSTGRES_DB=${POSTGRES_DB:-$(valeur_conteneur postgres POSTGRES_DB pdlm)}
# Lu AVANT l'arrêt de l'application (plus joignable ensuite).
S3_BUCKET=${S3_BUCKET:-$(valeur_conteneur app S3_BUCKET pdlm)}

mkdir -p "$DOSSIER/s3"
DOSSIER_ABS=$(cd "$DOSSIER" && pwd)

# L'application redémarre quoi qu'il arrive — y compris si le dump échoue.
# Sans ce piège, une erreur en cours de route laissait le site hors ligne.
redemarrer_app() {
  echo "Redémarrage de l'application…"
  docker compose start app >/dev/null 2>&1 || true
}
trap redemarrer_app EXIT

echo "1/4 — Arrêt de l'application (fenêtre de maintenance)…"
docker compose stop app >/dev/null

echo "2/4 — Dump PostgreSQL → $DOSSIER/postgres.sql.gz"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip >"$DOSSIER_ABS/postgres.sql.gz"
verifier_dump "$DOSSIER_ABS/postgres.sql.gz" PostgreSQL

# Mesure d'audience : base `umami`, si elle existe. Umami n'a pas besoin
# d'être arrêté : un pg_dump est cohérent pour une base à lui seul.
if docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='umami'" | grep -q 1; then
  echo "2b/4 — Dump de la mesure d'audience → $DOSSIER/umami.sql.gz"
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" umami \
    | gzip >"$DOSSIER_ABS/umami.sql.gz"
  verifier_dump "$DOSSIER_ABS/umami.sql.gz" "de la mesure d'audience"
fi

echo "3/4 — Copie du bucket S3 → $DOSSIER/s3"
# Le serveur MinIO tourne dans le service `minio` : c'est lui qu'il faut
# joindre par son nom de service. Viser `localhost` depuis ce conteneur
# jetable revenait à interroger un hôte où rien n'écoute.
# Le script interne est en quotes SIMPLES : les identifiants viennent de
# l'environnement du service, jamais d'une interpolation par l'hôte.
docker compose run --rm -T \
  -e S3_BUCKET="$S3_BUCKET" \
  -v "$DOSSIER_ABS/s3:/sauvegarde" \
  --entrypoint /bin/sh \
  minio -c '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc mirror --overwrite --remove "local/$S3_BUCKET" /sauvegarde
  '

echo "4/4 — Redémarrage de l'application…"
trap - EXIT
redemarrer_app

TAILLE=$(du -sh "$DOSSIER_ABS" | cut -f1)
echo
echo "Sauvegarde terminée : $DOSSIER ($TAILLE)"
echo "  base    : $(gunzip -c "$DOSSIER_ABS/postgres.sql.gz" | wc -l | tr -d ' ') lignes de SQL"
[ -f "$DOSSIER_ABS/umami.sql.gz" ] && echo "  mesure  : $(gunzip -c "$DOSSIER_ABS/umami.sql.gz" | wc -l | tr -d ' ') lignes de SQL"
echo "  fichiers: $(find "$DOSSIER_ABS/s3" -type f | wc -l | tr -d ' ')"
echo "Vérifier la restauration avec : ./scripts/restore.sh $DOSSIER"
