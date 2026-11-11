#!/usr/bin/env bash
# pdlm — restauration d'une sauvegarde créée par scripts/backup.sh
#
# Retouche U — restaurer à côté, puis basculer : le dump est chargé dans une
# base neuve <POSTGRES_DB>_restauration PENDANT que l'application continue de
# servir ; seules deux instructions RENAME la mettent en place, une fois le
# chargement réussi. Un échec AVANT la bascule ne touche donc rien (l'app
# n'a jamais été arrêtée) ; un échec APRÈS (umami, bucket) laisse l'app
# arrêtée et la base d'avant-restauration (<POSTGRES_DB>_precedente)
# disponible pour un retour arrière — le message d'alors porte les commandes.
# La base précédente n'est supprimée qu'après que le bucket est restauré.
#
# Ce script sert aussi la procédure de production (§ Sauvegarde de
# docs/deploiement-demo.md) et, chaque nuit, la démo en ligne
# (scripts/demo-restauration-nuit.sh) : base umami comprise, purgée à 25 mois
# avant remise en service. Migrations non appliquées ici : la base restaurée
# contient déjà le schéma de la sauvegarde.
#
# Usage : ./scripts/restore.sh <dossier-de-sauvegarde>

set -euo pipefail
cd "$(dirname "$0")/.."
. "$(dirname "$0")/verifier-dump.sh"

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

# Une sauvegarde tronquée est détectée ICI, pas à mi-chargement (retouche U) :
# marqueur de fin exigé, pas seulement un gzip sain.
verifier_dump "$DOSSIER_ABS/postgres.sql.gz" "$DOSSIER/postgres.sql.gz"

# Pile qui vient de démarrer : sans cette attente, « Postgres pas encore prêt »
# serait lu comme « rôle umami absent » par le contrôle ci-dessous.
for _ in $(seq 30); do
  docker compose exec -T postgres pg_isready -q 2>/dev/null && break
  sleep 2
done
docker compose exec -T postgres pg_isready -q 2>/dev/null || {
  echo "ÉCHEC : PostgreSQL ne répond pas — restauration annulée." >&2
  exit 1
}

# Mesure d'audience : prérequis vérifiés avant la moindre écriture.
if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  verifier_dump "$DOSSIER_ABS/umami.sql.gz" "$DOSSIER/umami.sql.gz"
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='umami'" | grep -q 1 || {
    echo "ÉCHEC : rôle umami absent — restauration annulée. Lancer d'abord : docker compose --profile mesure up init-umami" >&2
    exit 1
  }
  # Services de mesure qui tournent maintenant : ceux-là, et eux seuls, seront relancés.
  MESURE_ACTIFS=$(docker compose --profile mesure ps --status running --services | grep -E '^(umami|purge-mesure)$' || true)
fi

# Échec APRÈS la bascule (umami, bucket) : l'application reste arrêtée et la
# base d'avant-restauration existe encore — deux RENAME la remettent en place.
echec_apres_bascule() { # $1=étape en échec
  echo "ÉCHEC ($1) : l'application reste arrêtée." >&2
  echo "La base d'avant-restauration ${POSTGRES_DB}_precedente existe encore — retour arrière :" >&2
  echo "  docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U '$POSTGRES_USER' -d postgres \\" >&2
  echo "    -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid <> pg_backend_pid();\" \\" >&2
  echo "    -c \"ALTER DATABASE $POSTGRES_DB RENAME TO ${POSTGRES_DB}_apres_echec;\" \\" >&2
  echo "    -c \"ALTER DATABASE ${POSTGRES_DB}_precedente RENAME TO $POSTGRES_DB;\"" >&2
  echo "  puis : docker compose start app" >&2
  echo "  (${POSTGRES_DB}_apres_echec, la restauration inachevée, à supprimer après regard : DROP DATABASE ${POSTGRES_DB}_apres_echec;)" >&2
  exit 1
}

echo "1/6 — Chargement du dump dans ${POSTGRES_DB}_restauration (la base en service n'est pas touchée)…"
# NB : dans un bloc « if ! ( … ) », set -e est IGNORÉ dans le sous-shell
# (bash n'y applique errexit que au dernier ordre) — chaque commande est
# donc enchaînée par && pour que la moindre défaillance sorte du bloc.
if ! (
  # Une base _restauration laissée par un essai précédent est jetée d'abord.
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}_restauration' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}_restauration;" \
    -c "CREATE DATABASE ${POSTGRES_DB}_restauration;" >/dev/null \
    && gunzip -c "$DOSSIER_ABS/postgres.sql.gz" \
      | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "${POSTGRES_DB}_restauration"
); then
  # Seule écriture de ce chemin d'échec : la base neuve, jetée aussitôt.
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}_restauration;" >/dev/null 2>&1 || true
  echo "ÉCHEC (chargement) : le dump ne se charge pas en entier dans ${POSTGRES_DB}_restauration — la base en service et le bucket n'ont pas été touchés." >&2
  exit 1
fi

echo "2/6 — Bascule : arrêt de l'application, ${POSTGRES_DB} devient ${POSTGRES_DB}_precedente…"
if ! (
  docker compose stop app >/dev/null \
    && docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$POSTGRES_DB' AND pid <> pg_backend_pid();" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${POSTGRES_DB}_precedente' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}_precedente;" \
    -c "ALTER DATABASE $POSTGRES_DB RENAME TO ${POSTGRES_DB}_precedente;" \
    -c "ALTER DATABASE ${POSTGRES_DB}_restauration RENAME TO $POSTGRES_DB;"
); then
  echo "ÉCHEC (bascule) : état des bases à vérifier avant toute autre chose —" >&2
  echo "  docker compose exec -T postgres psql -U '$POSTGRES_USER' -d postgres -c '\l'" >&2
  exit 1
fi

if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  echo "3/6 — Restauration de la mesure d'audience (base umami)…"
  # Umami et la purge tiennent des connexions : arrêtés le temps de la
  # restauration. Même motif que 1/6 : && partout, set -e ne s'applique pas
  # dans le if. La purge (I21) des données de plus de 25 mois suit le
  # chargement — une sauvegarde ancienne contient des visites trop vieilles.
  if ! (
    { [ -z "${MESURE_ACTIFS:-}" ] || docker compose --profile mesure stop $MESURE_ACTIFS >/dev/null; } \
      && docker compose exec -T postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres \
      -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='umami' AND pid <> pg_backend_pid();" \
      -c "DROP DATABASE IF EXISTS umami;" \
      -c "CREATE DATABASE umami OWNER umami;" \
      && gunzip -c "$DOSSIER_ABS/umami.sql.gz" \
      | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami \
      && docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami -f - \
      <scripts/purge-mesure.sql >/dev/null \
      && { [ -z "${MESURE_ACTIFS:-}" ] || docker compose --profile mesure up -d --wait $MESURE_ACTIFS; }
  ); then
    echec_apres_bascule "umami"
  fi
else
  echo "3/6 — Pas de sauvegarde umami dans $DOSSIER, étape sautée."
fi

echo "4/6 — Restauration du bucket S3…"
# `--remove` : sans lui, les fichiers ajoutés après la sauvegarde survivaient
# à la restauration — le bucket n'était pas remis dans l'état sauvegardé.
if ! docker compose run --rm -T \
  -e S3_BUCKET="$S3_BUCKET" \
  -v "$DOSSIER_ABS/s3:/sauvegarde:ro" \
  --entrypoint /bin/sh \
  minio -c '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc mb --ignore-existing "local/$S3_BUCKET"
    mc mirror --overwrite --remove /sauvegarde "local/$S3_BUCKET"
  '; then
  echec_apres_bascule "bucket"
fi

# La base d'avant-restauration ne disparaît qu'une fois le bucket restauré :
# jusque-là, le retour arrière reste possible (echec_apres_bascule).
echo "5/6 — Suppression de ${POSTGRES_DB}_precedente (base et bucket sont restaurés)…"
if ! docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
  -c "DROP DATABASE IF EXISTS ${POSTGRES_DB}_precedente;"; then
  echo "ATTENTION : ${POSTGRES_DB}_precedente n'a pas été supprimée — la restauration est complète, la supprimer à la main." >&2
fi

echo "6/6 — Redémarrage de l'application…"
docker compose start app >/dev/null

echo "État des services :"
docker compose ps --format 'table {{.Name}}\t{{.Status}}'

echo
echo "Restauration terminée depuis : $DOSSIER"
