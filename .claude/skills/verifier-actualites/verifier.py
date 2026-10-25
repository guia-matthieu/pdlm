"""Vérification binaire du parcours public « Actualités » de pdlm.

Usage : python3 -I verifier.py [URL_DE_BASE]   (défaut http://localhost:3011)
Sortie : une ligne OK/ÉCHEC par contrôle, code retour 0 si tout passe, 1 sinon.
Ne lit que des pages publiques : aucune écriture, aucune connexion.
"""
import sys
import urllib.error
import urllib.request
from collections import Counter
from html.parser import HTMLParser

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3011").rstrip("/")


class Page(HTMLParser):
    """Relève les liens (avec la zone où ils se trouvent), le <title> et le premier <h1>."""

    def __init__(self):
        super().__init__()
        self.liens = []  # (zone, href, texte)
        self.titre = ""
        self.h1 = ""
        self._pile = []
        self._href = None
        self._texte = ""
        self._dans = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "nav" and a.get("aria-label") == "Menu principal":
            self._pile.append("menu")
        elif tag in ("main", "article", "footer", "header"):
            self._pile.append(tag)
        if tag == "a":
            self._href, self._texte = a.get("href"), ""
        if tag in ("title", "h1"):
            self._dans = tag

    def handle_endtag(self, tag):
        if tag in ("nav", "main", "article", "footer", "header") and self._pile:
            self._pile.pop()
        if tag == "a" and self._href is not None:
            zone = "menu" if "menu" in self._pile else (self._pile[-1] if self._pile else "")
            self.liens.append((zone, self._href, self._texte.strip()))
            self._href = None
        if tag == self._dans:
            self._dans = None

    def handle_data(self, data):
        if self._href is not None:
            self._texte += data
        if self._dans == "title":
            self.titre += data
        elif self._dans == "h1" and not self.h1:
            self.h1 += data


def lire(chemin):
    try:
        with urllib.request.urlopen(BASE + chemin, timeout=60) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""


echecs = 0


def controle(ok, libelle):
    global echecs
    print(("OK     " if ok else "ÉCHEC  ") + libelle)
    echecs += 0 if ok else 1


statut, html = lire("/actualites")
controle(statut == 200, f"/actualites répond 200 (reçu {statut})")
liste = Page()
liste.feed(html)

articles = {h: t for z, h, t in liste.liens if z == "main" and h and h.startswith("/actualites/")}
controle(len(articles) >= 1, f"la liste contient au moins une actualité ({len(articles)} trouvée(s))")

doublons = [h for h, n in Counter(h for z, h, _ in liste.liens if z == "menu").items() if n > 1]
controle(not doublons, f"le menu principal n'a pas d'entrée en double {doublons or ''}".rstrip())

for href, texte in articles.items():
    s, h = lire(href)
    p = Page()
    p.feed(h)
    controle(s == 200, f"{href} répond 200 (reçu {s})")
    controle(p.h1.strip() == texte, f"{href} : le <h1> reprend le titre de la liste (« {p.h1.strip()} » vs « {texte} »)")
    controle(p.titre.startswith(texte), f"{href} : le <title> commence par le titre de l'article")

s, _ = lire("/actualites/cette-actualite-n-existe-pas")
controle(s == 404, f"un slug inconnu répond 404 (reçu {s})")

print(f"\n{'VERT' if echecs == 0 else 'ROUGE'} — {echecs} échec(s)")
sys.exit(1 if echecs else 0)
