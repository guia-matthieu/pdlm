#!/usr/bin/env bash
# pdlm — sauvegarde cohérente PostgreSQL + S3 (MinIO)
#
# Cohérence (plan J7) : l'application est ARRÊTÉE pendant la sauvegarde
# (fenêtre de maintenance) — un pg_dump + mc mirror sous écritures
# concurrentes ne garantit pas la cohérence entre base et fichiers.
#
# Retouche V — jamais d'écrasement en place : une destination qui existe déjà
# (la référence de la démo, backups/reference) n'est pas écrite dedans. La
# nouvelle sauvegarde va dans <dest>.nouvelle, n'est basculée (l'ancienne
# devient <dest>.precedente) qu'après contrôle complet — dumps complets ET
# autant de fichiers copiés que dans le bucket. Un échec à n'importe quelle
# étape laisse <dest> intacte, supprime <dest>.nouvelle, et sort non nul.
#
# Usage : ./scripts/backup.sh [dossier-destination]
# Le dossier reçoit : postgres.sql.gz + s3/ (contenu du bucket) + umami.sql.gz
# si la mesure d'audience est installée

set -euo pipefail
umask 077 # la sauvegarde contient tout le site : 600 pour les fichiers, 700 pour les dossiers
cd "$(dirname "$0")/.."
. "$(dirname "$0")/verifier-dump.sh"

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

DOSSIER=${1:-backups/$(date +%Y%m%d-%H%M%S)}
POSTGRES_USER=${POSTGRES_USER:-$(valeur_conteneur postgres POSTGRES_USER postgres)}
POSTGRES_DB=${POSTGRES_DB:-$(valeur_conteneur postgres POSTGRES_DB pdlm)}
# Lu AVANT l'arrêt de l'application (plus joignable ensuite).
S3_BUCKET=${S3_BUCKET:-$(valeur_conteneur app S3_BUCKET pdlm)}

# Retouche V : destination existante → écrire À CÔTÉ, basculer après contrôle.
if [ -e "$DOSSIER" ]; then
  DEST="$DOSSIER.nouvelle"
  rm -rf "$DEST"
  echo "La destination $DOSSIER existe déjà — la sauvegarde s'écrit dans $DEST (bascule après contrôle complet)."
else
  DEST="$DOSSIER"
fi

mkdir -p "$DEST/s3" # umask 077 → 700
DEST_ABS=$(cd "$DEST" && pwd)

# L'application redémarre quoi qu'il arrive — y compris si le dump échoue.
# Retouche V : un échec supprime aussi l'éventuelle <dest>.nouvelle — la
# destination existante, elle, n'a jamais été touchée.
redemarrer_app() {
  echo "Redémarrage de l'application…"
  docker compose start app >/dev/null 2>&1 || true
}
sortie() {
  rc=$?
  if [ "$rc" -ne 0 ]; then
    redemarrer_app
    if [ "$DEST" != "$DOSSIER" ] && [ -e "$DEST_ABS" ]; then
      rm -rf "$DEST_ABS"
      echo "Supprimé : $DEST — la sauvegarde a échoué, $DOSSIER est intacte." >&2
    fi
  fi
}
trap sortie EXIT

echo "1/4 — Arrêt de l'application (fenêtre de maintenance)…"
docker compose stop app >/dev/null

echo "2/4 — Dump PostgreSQL → $DEST/postgres.sql.gz"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" \
  | gzip >"$DEST_ABS/postgres.sql.gz"
verifier_dump "$DEST_ABS/postgres.sql.gz" "$DEST/postgres.sql.gz"

# Mesure d'audience : base `umami`, si elle existe. Umami n'a pas besoin
# d'être arrêté : un pg_dump est cohérent pour une base à lui seul.
if docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='umami'" | grep -q 1; then
  echo "2b/4 — Dump de la mesure d'audience → $DEST/umami.sql.gz"
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" umami \
    | gzip >"$DEST_ABS/umami.sql.gz"
  verifier_dump "$DEST_ABS/umami.sql.gz" "$DEST/umami.sql.gz"
fi

# Le serveur MinIO tourne dans le service `minio` : c'est lui qu'il faut
# joindre par son nom de service. Viser `localhost` depuis ce conteneur
# jetable revenait à interroger un hôte où rien n'écoute.
# Le script interne est en quotes SIMPLES : les identifiants viennent de
# l'environnement du service, jamais d'une interpolation par l'hôte.
# mc mirror est muselé (>/dev/null) : la sortie capturée est le seul compte
# d'objets du bucket, compté côté hôte (retouche V — le compte de fichiers
# copiés doit égaler celui du bucket, un mirror interrompu en silence
# laisserait une référence incomplète).
echo "3/4 — Copie du bucket S3 → $DEST/s3"
# Le rc du docker run est testé EXPLICITEMENT : un « | grep -c . » en fin de
# chaîne masquerait un échec du mirror pour un bucket vide (0 = 0 passerait).
liste_objets=''
if ! liste_objets=$(docker compose run --rm -T \
  -e S3_BUCKET="$S3_BUCKET" \
  -v "$DEST_ABS/s3:/sauvegarde" \
  --entrypoint /bin/sh \
  minio -c '
    set -e
    mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" >/dev/null
    mc mirror --overwrite --remove "local/$S3_BUCKET" /sauvegarde >/dev/null
    mc ls --recursive "local/$S3_BUCKET"
  '); then
  echo "ÉCHEC : copie du bucket S3 impossible — sauvegarde annulée." >&2
  exit 1
fi
# grep -c . rend 1 quand il n'y a rien : c'est un bucket vide, pas un échec.
nb_bucket=$(printf '%s\n' "$liste_objets" | grep -c . || true)
nb_copie=$(find "$DEST_ABS/s3" -type f | wc -l | tr -d '[:space:]')
if [ "$nb_bucket" != "$nb_copie" ]; then
  echo "ÉCHEC : $nb_copie fichier(s) copié(s) dans $DEST/s3 pour $nb_bucket objet(s) dans le bucket — sauvegarde incomplète." >&2
  exit 1
fi

echo "4/4 — Redémarrage de l'application…"
redemarrer_app

# Bascule (retouche V) : seulement ici, tout est vérifié. L'ancienne
# destination devient <dest>.precedente (la plus ancienne .precedente est
# jetée), la nouvelle prend sa place. Un mv qui échouerait ici laisserait la
# sauvegarde précédente dans <dest>.precedente — rien n'est perdu.
if [ "$DEST" != "$DOSSIER" ]; then
  echo "Bascule : $DOSSIER ← $DEST (l'ancienne devient ${DOSSIER}.precedente)…"
  rm -rf "${DOSSIER}.precedente"
  mv "$DOSSIER" "${DOSSIER}.precedente"
  mv "$DEST" "$DOSSIER"
  DEST_ABS=$(cd "$DOSSIER" && pwd) # l'ancien chemin (.nouvelle) n'existe plus
fi

TAILLE=$(du -sh "$DEST_ABS" | cut -f1)
echo
echo "Sauvegarde terminée : $DOSSIER ($TAILLE)"
echo "  base    : $(gunzip -c "$DEST_ABS/postgres.sql.gz" | wc -l | tr -d ' ') lignes de SQL"
[ -f "$DEST_ABS/umami.sql.gz" ] && echo "  mesure  : $(gunzip -c "$DEST_ABS/umami.sql.gz" | wc -l | tr -d ' ') lignes de SQL"
echo "  fichiers: $nb_copie (autant dans le bucket)"
echo "Vérifier la restauration avec : ./scripts/restore.sh $DOSSIER"
