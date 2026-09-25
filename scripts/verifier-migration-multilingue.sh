#!/usr/bin/env bash
# Rejoue la migration multilingue sur une base JETABLE, sans toucher aux autres :
#   1. schéma de `main` par ses propres migrations, contenu de démonstration ;
#   2. instantané du contenu ; 3. migration multilingue ; 4. instantané, comparaison ;
#   5. migrate:down ; 6. instantané avec le code de `main`, comparaison.
# NODE_ENV=production partout : sans lui, Payload « pousse » le schéma en dev et
# masquerait une migration incomplète. Seule exception, le seed (il refuse de
# tourner en production) : PAYLOAD_MIGRATING=true y coupe la poussée du schéma.
# Prérequis : conteneur Docker pdlm-postgres-1 démarré, fichier .env présent.
set -euo pipefail
cd "$(dirname "$0")/.."

BASE=pdlm_migration_multilingue
URI="postgres://postgres:postgres@127.0.0.1:5432/$BASE"
PSQL=(docker exec -i pdlm-postgres-1 psql -U postgres -v ON_ERROR_STOP=1 -q)
TRAVAIL=$(mktemp -d)
MAIN="$TRAVAIL/main"
ICI=$(pwd)

nettoyer() { git worktree remove --force "$MAIN" 2>/dev/null || true; git worktree prune; }
trap nettoyer EXIT

# Les journaux de Payload vont dans $TRAVAIL/journal.txt (affiché en cas
# d'échec) ; l'instantané écrit lui-même son fichier (INSTANTANE_FICHIER).
journal() { "$@" >>"$TRAVAIL/journal.txt" 2>&1 || { tail -40 "$TRAVAIL/journal.txt"; return 1; }; }
comparer() {
  if diff -u "$TRAVAIL/avant.json" "$TRAVAIL/$1.json"; then
    echo "✅ $2"
  else
    echo "❌ $1 : le contenu diffère (fichiers dans $TRAVAIL, base $BASE conservée)"
    exit 1
  fi
}

"${PSQL[@]}" -c "DROP DATABASE IF EXISTS $BASE" -c "CREATE DATABASE $BASE"
git worktree add --detach "$MAIN" main >/dev/null 2>&1
ln -s "$ICI/node_modules" "$MAIN/node_modules"
cp "$ICI/.env" "$MAIN/.env"
cp "$ICI/scripts/instantane-contenu.ts" "$MAIN/scripts/"

export DATABASE_URI="$URI" NODE_ENV=production S3_ENABLED=false
(
  cd "$MAIN"
  journal npx payload migrate
  NODE_ENV=development PAYLOAD_MIGRATING=true journal npx payload run src/seed/index.ts
  # Le seed ne crée ni média, ni document, ni sous-menu, ni bloc image, galerie
  # ou contact : on les ajoute ici, pour que chaque table touchée ait des lignes.
  "${PSQL[@]}" -d "$BASE" <<'SQL'
INSERT INTO media (tenant_id, alt, filename, mime_type, filesize, width, height)
  VALUES (1, 'Vue du village depuis le col', 'village.jpg', 'image/jpeg', 1000, 800, 600);
INSERT INTO documents (tenant_id, titre, categorie, filename, mime_type, filesize)
  VALUES (1, 'Compte rendu du conseil municipal', 'autres', 'conseil.pdf', 'application/pdf', 1000);
INSERT INTO menus_items_enfants (_order, _parent_id, id, label, page_id)
  SELECT 1, id, 'verif-enfant', 'Conseil municipal', 2 FROM menus_items ORDER BY _order LIMIT 1;
INSERT INTO pages_blocks_image (_order, _parent_id, _path, id, media_id, legende)
  SELECT 20, 1, 'blocs', 'verif-image', id, 'Le village' FROM media LIMIT 1;
INSERT INTO pages_blocks_galerie (_order, _parent_id, _path, id) VALUES (21, 1, 'blocs', 'verif-galerie');
INSERT INTO pages_blocks_galerie_images (_order, _parent_id, id, media_id, legende)
  SELECT 1, 'verif-galerie', 'verif-galerie-1', id, 'La place' FROM media LIMIT 1;
INSERT INTO pages_blocks_contact (_order, _parent_id, _path, id, titre, texte)
  VALUES (22, 1, 'blocs', 'verif-contact', 'Nous écrire', 'La mairie répond sous huit jours.');
-- Mêmes blocs dans la dernière version de la page 1.
CREATE TEMP TABLE v AS SELECT id FROM _pages_v WHERE parent_id = 1 AND latest ORDER BY id DESC LIMIT 1;
INSERT INTO _pages_v_blocks_image (_order, _parent_id, _path, media_id, legende, _uuid)
  SELECT 20, v.id, 'version.blocs', m.id, 'Le village', 'verif-image' FROM v, media m;
WITH g AS (INSERT INTO _pages_v_blocks_galerie (_order, _parent_id, _path, _uuid)
           SELECT 21, v.id, 'version.blocs', 'verif-galerie' FROM v RETURNING id)
INSERT INTO _pages_v_blocks_galerie_images (_order, _parent_id, media_id, legende, _uuid)
  SELECT 1, g.id, m.id, 'La place', 'verif-galerie-1' FROM g, media m;
INSERT INTO _pages_v_blocks_contact (_order, _parent_id, _path, titre, texte, _uuid)
  SELECT 22, v.id, 'version.blocs', 'Nous écrire', 'La mairie répond sous huit jours.', 'verif-contact' FROM v;
SQL
  INSTANTANE_FICHIER="$TRAVAIL/avant.json" journal npx payload run scripts/instantane-contenu.ts
)
journal npx payload migrate
INSTANTANE_FICHIER="$TRAVAIL/apres.json" journal npx payload run scripts/instantane-contenu.ts
comparer apres "up : contenu français identique"
# Une traduction corse, que le retour arrière doit écarter sans toucher au français.
"${PSQL[@]}" -d "$BASE" <<'SQL'
INSERT INTO pages_locales (titre, _locale, _parent_id) VALUES ('Accolta', 'co', 1);
INSERT INTO pages_blocks_contact (_order, _parent_id, _path, id, titre, texte, _locale)
  VALUES (22, 1, 'blocs', 'verif-contact-co', 'Scriveteci', 'Testu corsu.', 'co');
SQL
journal npx payload migrate:down
(cd "$MAIN" && INSTANTANE_FICHIER="$TRAVAIL/retour.json" journal npx payload run scripts/instantane-contenu.ts)
comparer retour "down : contenu identique à l'origine"
"${PSQL[@]}" -c "DROP DATABASE $BASE"
nettoyer
rm -rf "$TRAVAIL"
