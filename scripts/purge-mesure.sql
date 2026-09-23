-- pdlm — purge de la mesure d'audience (I21 : aucune donnée de plus de 25 mois).
-- Lancé par le service `purge-mesure` au démarrage puis toutes les 24 h, et par
-- restore.sh après une restauration, avec ON_ERROR_STOP. Tables relevées sur
-- Umami 3.4.0. Limite : (maintenant + 2 jours) − 25 mois — la date est avancée
-- AVANT de retrancher les mois, sinon le saut de fin de mois laisse une ligne
-- dépasser 25 mois avant la purge suivante (28/02 → 1/03). `-v maintenant=…`
-- fige l'horloge pour les tests.
\if :{?maintenant}
\else
\set maintenant now
\endif
SELECT (:'maintenant'::timestamptz + interval '2 days') - interval '25 months' AS limite \gset

BEGIN;

CREATE TEMP TABLE purge_bilan (nom text, lignes bigint) ON COMMIT DROP;

WITH d AS (DELETE FROM event_data WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'event_data', count(*) FROM d;
WITH d AS (DELETE FROM session_data WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_data', count(*) FROM d;
WITH d AS (DELETE FROM revenue WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'revenue', count(*) FROM d;
WITH d AS (DELETE FROM heatmap_event WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'heatmap_event', count(*) FROM d;
WITH d AS (DELETE FROM session_replay WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_replay', count(*) FROM d;
WITH d AS (DELETE FROM session_replay_saved WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_replay_saved', count(*) FROM d;
WITH d AS (DELETE FROM website_event WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'website_event', count(*) FROM d;
WITH d AS (DELETE FROM session_link WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_link', count(*) FROM d;
-- Sessions sur leur seule date (voir le plan, tâche 12 : le sel mensuel d'Umami
-- empêche une session de recevoir des événements au-delà de son mois).
WITH d AS (DELETE FROM session WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session', count(*) FROM d;

SELECT now() AS purge, nom, lignes FROM purge_bilan ORDER BY nom;

COMMIT;
