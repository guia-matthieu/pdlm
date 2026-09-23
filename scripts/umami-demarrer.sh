#!/bin/sh
# pdlm — démarrage du conteneur Umami (monté en lecture seule, voir docker-compose*.yml).
#
# 1. Refuse de démarrer sans APP_SECRET (jamais ${X:?} dans Compose : cela
#    casserait toute la pile, même profil « mesure » inactif).
# 2. Interface en français par défaut. L'image officielle fige la langue par
#    défaut à la construction (DEFAULT_LOCALE="en-US" dans les fichiers
#    compilés) ; sans cela, le maire ouvrirait son lien de partage en anglais.
#    Chacun peut toujours changer de langue dans son profil. Si une version
#    d'Umami déplace la constante, le conteneur refuse de démarrer au lieu de
#    repasser silencieusement en anglais.
# 3. Lance la commande d'origine de l'image.
set -eu

[ -n "${APP_SECRET:-}" ] || { echo "UMAMI_APP_SECRET requis dans .env" >&2; exit 1; }

ANGLAIS='"DEFAULT_LOCALE",0,"en-US"'
FRANCAIS='"DEFAULT_LOCALE",0,"fr-FR"'
a_traduire=$(grep -rlF "$ANGLAIS" .next/static/chunks .next/server/chunks 2>/dev/null || true)
for fichier in $a_traduire; do
  sed -i "s/\"DEFAULT_LOCALE\",0,\"en-US\"/\"DEFAULT_LOCALE\",0,\"fr-FR\"/" "$fichier"
done
if ! grep -rqF "$FRANCAIS" .next/static/chunks; then
  echo "Langue par défaut d'Umami introuvable (version changée ?) : mettre à jour scripts/umami-demarrer.sh" >&2
  exit 1
fi

exec sh scripts/start-docker.sh
