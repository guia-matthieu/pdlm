# Démo tiret — événements des specs, plages horaires insécables

Brief : `~/Projects/guia/tasks/2026-10-17_brief-glm-demo-tiret.md`.
Branche `gabarits-demo-tiret`, partie de `main` à `651e31f`. Deux corrections
courtes, sans plan. Ces notes se complètent à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `src/seed/contenu-demo.ts` l. 234-274 : événements créés à la date de l'amorçage | l. 233-261 : `Marché de printemps` (+5 J) et `Conseil municipal (séance publique)` (+12 J), créés seulement si la collection est vide | ✅ |
| `src/lib/contenu.ts` l. 90-91 : agenda = événements `dateFin >= now` | l. 90-99 `evenementsCommune` avec `filtreEvenementAVenir()` (`src/lib/dates.ts` l. 22-24 : `dateFin >= now`) | ✅ |
| `Mairie.tsx` l. 34-41 et `PiedDePage.tsx` l. 43-46 : les deux affichages des horaires | `Mairie.tsx` l. 38 `{horaires.texte}` dans un `<span lang>` ; `PiedDePage.tsx` l. 46 idem — grep `src/` : ce sont les deux seuls endroits qui rendent `horaires.texte` | ✅ |
| Specs créant ou lisant `evenements` | `gabarits-conformite` (l. 269 rendu des sections, l. 404 test 6 — **aucune création** : dépend des événements de démo) ; `gabarits-captures` (l. 283 création +12/+25/+33 J, l. 373 nettoyage par titre) ; `littoral-captures` (l. 32, +12 à +33 J) ; `village-captures` (l. 23) ; `frontend` (l. 30 : visite `/agenda`, sans exiger d'événement) | ✅ |

Repérages complémentaires (grep, une fois) :

- Les trois specs de captures créent déjà leurs événements datés de
  `Date.now()` et les suppriment par titre dans `nettoyer()` (appelé en
  beforeAll et afterAll) — mais la suppression n'est pas vérifiée par GET.
- `suites-1440.e2e.spec.ts` : `api`/`json` locaux (l. 52-68),
  `lignesCourriel` mesure les lignes par Range par caractère (l. 91-123),
  `HORAIRES` de démo posée par PATCH en beforeAll (l. 158-162) — le fichier
  n'exige aucun événement.

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets`. Serveur de développement sur le **port 3000**, lancé par
  cette session, arrêté à la fin.
- `.env` du worktree non lu, aucune migration, aucun champ Payload touché.
- Toute écriture en base (événements de démo décalés pour la preuve) est
  remise en état, vérifiée par GET.

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
