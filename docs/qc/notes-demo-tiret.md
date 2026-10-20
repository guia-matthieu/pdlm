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

## Tâche A — les specs ne dépendent plus de l'amorçage

### Ce qui a changé

- `tests/helpers/evenements.ts` (nouveau) : `creerEvenements` (POST datés de
  `Date.now() + jours`, fin à +3 h, `lieu` posé) et `supprimerEvenements`
  (recherche par titre `draft=true&limit=100`, DELETE puis GET dont le 404 est
  exigé) — appelés depuis le navigateur comme les `api()` des specs (cookie de
  session + CSRF).
- `gabarits-conformite.e2e.spec.ts` : le `beforeAll` retire un éventuel résidu
  d'un passage interrompu puis crée deux événements (+3 et +10 J, titres
  « (suite conformité) ») ; l'`afterAll` les supprime (GET 404 vérifié).
- `littoral-captures`, `village-captures`, `gabarits-captures` : leur boucle de
  création devient `creerEvenements(...)` ; le filtre `evenements` de
  `nettoyer()` devient `supprimerEvenements(...)` (suppression maintenant
  vérifiée par GET 404) ; `crees.evenements` (poussé, jamais lu) disparaît.
  Le seed (`src/seed/contenu-demo.ts`) et `src/lib/contenu.ts` ne bougent pas.

### Preuve (sorties réelles, base de dév du worktree)

1. Lecture avant touche (spec jetable, GET authentifié) — dates d'origine
   notées :

   ```
   EVT 1 Marché de printemps | debut=2026-10-23T09:22:35.379Z fin=2026-10-23T15:22:35.379Z | AVENIR
   EVT 2 Conseil municipal (séance publique) | debut=2026-10-23T09:22:35.383Z fin=2026-10-23T11:22:35.383Z | AVENIR
   ```

2. PATCH authentifié des deux événements de démo à -40/-39 J (`PATCHES AU
   PASSE (-40/-39 J)`), puis `gabarits-conformite` **sans création
   d'événements** (état du fichier avant ce changement) :

   ```
     2 failed
       [chromium] › tests/e2e/gabarits-conformite.e2e.spec.ts:242:5 › Suite de conformité — village › 1 et 2 — accueil 200, sections dans l’ordre du gabarit, rien hors de l’origine, aucun script ajouté
       [chromium] › tests/e2e/gabarits-conformite.e2e.spec.ts:242:5 › Suite de conformité — littoral › 1 et 2 — accueil 200, sections dans l’ordre du gabarit, rien hors de l’origine, aucun script ajouté
     12 did not run
   ```

   Échec sur `expect(rendues).toEqual(gabarit.accueil.map((s) => s.section))`
   (l. 266 du fichier d'alors) : sans événement à venir, la section `agenda`
   ne rend plus — la dépendance à l'amorçage que la tâche vise.

3. Même base, événements de démo toujours au passé, `gabarits-conformite`
   **avec la création par la spec** :

   ```
     14 passed (26.4s)
   ```

4. Aucun résidu de test en base (GET, toute la collection, `draft=true`) :

   ```
   EVENEMENTS EN BASE : 2
     2 Conseil municipal (séance publique)
     1 Marché de printemps
   ```

5. Dates d'origine rétablies par PATCH, vérifiées par GET :

   ```
   EVT 1 Marché de printemps | debut=2026-10-23T09:22:35.379Z fin=2026-10-23T15:22:35.379Z | AVENIR
   EVT 2 Conseil municipal (séance publique) | debut=2026-10-23T09:22:35.383Z fin=2026-10-23T11:22:35.383Z | AVENIR
   ```

6. Suites de captures refactorées :

   ```
     12 passed (52.6s)
   ```

- (ce commit) — tâche A : helper `evenements`, `gabarits-conformite` crée et
  supprime ses événements, les trois suites de captures passent par le même
  helper (suppression vérifiée 404).
