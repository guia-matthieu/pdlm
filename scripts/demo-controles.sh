#!/usr/bin/env bash
# pdlm — contrôles préalables au déploiement de la démo en ligne
# (docs/deploiement-demo.md, appelé aux § 4 et § 9).
#
# Usage : ./scripts/demo-controles.sh <CONTENEUR_CADDY>
#
# Ne modifie rien : contrôles seulement, rejouables. Sort non nul avec un
# message clair si :
#   - docker-compose.demo.yml est absent (l'archive déployée ne contient
#     pas la démo) ;
#   - le conteneur Caddy nommé en argument n'existe pas ;
#   - le port 3110 est tenu par autre chose que la démo elle-même ;
#   - le Compose de ce dossier (piloté par son .env) liste un conteneur
#     hors démo — ce serait le .env d'une autre pile, les commandes qui
#     suivent dans la procédure ne doivent pas s'exécuter.
#
# La sortie non nul sert justement à la procédure, qui chaîne :
# ./scripts/demo-controles.sh <CONTENEUR_CADDY> && … — aucun `exit` à
# taper dans la session de l'opérateur.

set -euo pipefail
cd "$(dirname "$0")/.."

erreur() {
  echo "contrôles démo : $*" >&2
  exit 1
}

[ "$#" -eq 1 ] || erreur "usage : $0 <CONTENEUR_CADDY>"
CADDY=$1

# 1. L'archive déployée contient la surcouche de démo (retouche C).
[ -f docker-compose.demo.yml ] \
  || erreur "docker-compose.demo.yml absent — l'archive déployée ne contient pas la démo ; STOP"

# 2. Le conteneur Caddy partagé existe : c'est lui qu'on connectera au réseau
#    pdlm-demo-edge après le up (§ 4) — seul contrôle réseau préalable.
docker inspect "$CADDY" >/dev/null 2>&1 \
  || erreur "conteneur Caddy « $CADDY » introuvable (docker inspect) — STOP"

# 3. Port 3110 (publications de boucle locale de l'app) : libre, ou déjà
#    publié par la démo elle-même (pile démarrée, contrôles rejoués).
#    Docker d'abord : quand la pile publie le port, c'est docker-proxy qui
#    l'écoute sur l'hôte — ss/lsof le diraient « occupé » à tort.
titulaires=$(docker ps --filter publish=3110 --format '{{.Names}}')
for c in $titulaires; do
  case $c in
    pdlm-demo-*) ;;
    *) erreur "port 3110 déjà publié par « $c » — STOP" ;;
  esac
done
if [ -z "$titulaires" ]; then
  # Aucun conteneur ne le publie : il doit être libre sur l'hôte aussi
  # (ss : Linux ; lsof : ailleurs).
  if ss -ltn 2>/dev/null | grep -q ':3110 '; then
    erreur "port 3110 déjà écouté sur l'hôte (ss) — STOP"
  fi
  if lsof -nP -iTCP:3110 -sTCP:LISTEN >/dev/null 2>&1; then
    erreur "port 3110 déjà écouté sur l'hôte (lsof) — STOP"
  fi
fi

# 4. Le Compose de ce dossier, piloté par son .env (COMPOSE_PROJECT_NAME,
#    COMPOSE_FILE — § 3), ne vise QUE la démo : scripts/backup.sh et
#    scripts/restore.sh le lancent nu, ce .env doit être le bon. Une liste
#    vide passe (premier démarrage) — c'est un conteneur d'une autre pile
#    qui arrête tout.
if ! conteneurs=$(docker compose ps --all --format '{{.Name}}' 2>&1); then
  erreur "docker compose ps a échoué — .env ou fichiers Compose invalides : $conteneurs"
fi
hors_demo=''
for c in $conteneurs; do
  case $c in
    pdlm-demo-*) ;;
    *) hors_demo="$hors_demo $c" ;;
  esac
done
[ -z "$hors_demo" ] \
  || erreur "le Compose de ce dossier vise des conteneurs hors démo :$hors_demo — .env d'une autre pile ? STOP"

etat_port='libre'
if [ -n "$titulaires" ]; then
  etat_port='déjà publié par la démo'
fi
nb=$(printf '%s\n' "$conteneurs" | grep -c '^pdlm-demo-' || true)
echo "contrôles démo : OK — surcouche présente ; Caddy « $CADDY » trouvé ; port 3110 $etat_port ; Compose du dossier : $nb conteneur(s), tous pdlm-demo-*"
