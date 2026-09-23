#!/usr/bin/env bash
# Test de scripts/purge-mesure.sql contre une vraie base Umami (I21).
# Prérequis : docker compose -f docker-compose.dev.yml --profile mesure up -d
# Crée un site factice, des lignes de part et d'autre de la limite dans chaque
# table purgée, lance la purge, vérifie, puis efface le site factice.
set -euo pipefail
cd "$(dirname "$0")/.."

psql_umami() { docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -tA "$@"; }

SITE=00000000-0000-4000-8000-00000000c0de
TABLES="event_data session_data revenue heatmap_event session_replay session_replay_saved website_event session_link session"
nettoyer() {
  for t in $TABLES website; do psql_umami -c "DELETE FROM $t WHERE website_id='$SITE'" >/dev/null; done
}
trap nettoyer EXIT
nettoyer

# Même limite que la purge ; VIEUX juste en deçà, RECENT juste au-delà.
LIMITE="((now() + interval '2 days') - interval '25 months')"
VIEUX="($LIMITE - interval '1 hour')"
RECENT="($LIMITE + interval '1 day')"
SV=00000000-0000-4000-8000-0000000000a1   # session ancienne
SR=00000000-0000-4000-8000-0000000000a2   # session récente
EV=00000000-0000-4000-8000-0000000000e1   # événement ancien
ER=00000000-0000-4000-8000-0000000000e2   # événement récent

psql_umami <<SQL >/dev/null
INSERT INTO website (website_id, name) VALUES ('$SITE', 'purge-test');
INSERT INTO session (session_id, website_id, created_at) VALUES ('$SV', '$SITE', $VIEUX), ('$SR', '$SITE', $RECENT);
INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at) VALUES
  ('$EV', '$SITE', '$SV', gen_random_uuid(), '/vieux', $VIEUX),
  ('$ER', '$SITE', '$SR', gen_random_uuid(), '/recent', $RECENT);
INSERT INTO event_data (event_data_id, website_id, website_event_id, data_key, data_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$EV', 'vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$ER', 'recent', 1, $RECENT);
INSERT INTO session_data (session_data_id, website_id, session_id, data_key, data_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', 'vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', 'recent', 1, $RECENT);
INSERT INTO revenue (revenue_id, website_id, session_id, event_id, event_name, currency, revenue, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', '$EV', 'vieux', 'EUR', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', '$ER', 'recent', 'EUR', 1, $RECENT);
INSERT INTO heatmap_event (heatmap_event_id, website_id, session_id, visit_id, url_path, event_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', gen_random_uuid(), '/vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/recent', 1, $RECENT);
INSERT INTO session_replay (replay_id, website_id, session_id, visit_id, chunk_index, events, event_count, started_at, ended_at, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', gen_random_uuid(), 0, '\x00', 0, $VIEUX, $VIEUX, $VIEUX),
  (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), 0, '\x00', 0, $RECENT, $RECENT, $RECENT);
INSERT INTO session_replay_saved (saved_replay_id, name, website_id, visit_id, created_at) VALUES
  (gen_random_uuid(), 'vieux', '$SITE', gen_random_uuid(), $VIEUX), (gen_random_uuid(), 'recent', '$SITE', gen_random_uuid(), $RECENT);
INSERT INTO session_link (website_id, session_id, distinct_id, created_at) VALUES
  ('$SITE', '$SV', 'vieux', $VIEUX), ('$SITE', '$SR', 'recent', $RECENT);
SQL

echo "--- purge ---"
docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -f - <scripts/purge-mesure.sql

attendu() { # $1=libellé $2=requête $3=valeur attendue
  local lu; lu=$(psql_umami -c "$2")
  if [ "$lu" = "$3" ]; then echo "OK   $1 ($lu)"; else echo "ÉCHEC $1 : lu $lu, attendu $3" >&2; exit 1; fi
}
for t in $TABLES; do
  attendu "$t : seule la ligne récente reste" \
    "SELECT count(*) FROM $t WHERE website_id='$SITE' AND created_at < $LIMITE" 0
  attendu "$t : la ligne récente est gardée" \
    "SELECT count(*) FROM $t WHERE website_id='$SITE' AND created_at >= $LIMITE" 1
done

# Horloge figée : fin février (année ordinaire puis bissextile), là où la soustraction
# de mois saute. La ligne « juste trop vieille » doit partir, la suivante rester.
purge_a() { # $1=date de purge
  docker compose -f docker-compose.dev.yml exec -T postgres psql -q -v ON_ERROR_STOP=1 -v maintenant="$1" \
    -U umami -d umami -f - <scripts/purge-mesure.sql >/dev/null
}
for cas in "2027-02-28 12:00+00|2025-01-31 00:00+00|2025-02-03 00:00+00" \
           "2028-02-28 12:00+00|2026-01-31 00:00+00|2026-02-02 13:00+00"; do
  IFS='|' read -r quand trop_vieux garde <<<"$cas"
  psql_umami -c "INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at) VALUES
    (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/fige-vieux', '$trop_vieux'),
    (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/fige-garde', '$garde')" >/dev/null
  purge_a "$quand"
  attendu "purge du $quand : $trop_vieux supprimé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/fige-vieux'" 0
  attendu "purge du $quand : $garde gardé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/fige-garde'" 1
  psql_umami -c "DELETE FROM website_event WHERE website_id='$SITE' AND url_path LIKE '/fige-%'" >/dev/null
done

# Atomicité : une purge qui échoue en cours de route ne supprime rien.
psql_umami -c "INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at)
  VALUES (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/vieux2', $VIEUX)" >/dev/null
if perl -pe 's/^COMMIT;$/SELECT 1\/0;\nCOMMIT;/' scripts/purge-mesure.sql \
  | docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -f - >/dev/null 2>&1; then
  echo "ÉCHEC : la purge sabotée aurait dû échouer" >&2; exit 1
fi
attendu "purge interrompue : rien de supprimé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/vieux2'" 1
echo "Purge conforme (I21)."
