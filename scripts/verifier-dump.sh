# pdlm — contrôle d'un dump gzip PostgreSQL créé par scripts/backup.sh
#
# Sourcé par backup.sh et restore.sh (retouche U) : un seul endroit pour le
# contrôle « ce dump est complet ». Sans lui, un dump tronqué (sauvegarde
# interrompue) n'est découvert qu'À LA RESTAURATION — c'est-à-dire trop tard.
#
# verifier_dump <fichier> <libellé>
#   - gunzip -t : l'archive gzip est saine ;
#   - le marqueur final de pg_dump est présent (« PostgreSQL database dump
#     complete ») : le dump va jusqu'au bout.
# Sort non nul avec un message clair — les appelants tournent sous set -e.

verifier_dump() { # $1=fichier $2=libellé du dump (pour le message)
  if ! gunzip -t "$1" 2>/dev/null; then
    echo "ÉCHEC : le dump $2 est illisible — opération annulée." >&2
    exit 1
  fi
  # tail -c lit le flux jusqu'au bout (pas de SIGPIPE pour gunzip, que un
  # grep -q sur le flux entier provoquerait) ; le marqueur de fin vit dans
  # le dernier kilo-octet du dump.
  if ! gunzip -c "$1" 2>/dev/null | tail -c 1024 | grep -q 'PostgreSQL database dump complete'; then
    echo "ÉCHEC : le dump $2 est incomplet (marqueur de fin absent) — opération annulée." >&2
    exit 1
  fi
}
