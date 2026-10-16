# Retouches courriel — pied de page, rive mairie littoral 1440

Brief : `~/Projects/guia/tasks/2026-10-16_brief-glm-retouches-courriel.md`.
Branche `gabarits-retouches-courriel`, partie de `main` à `398585a` (suites
1440 fusionnées). Deux retouches courtes, sans plan. Ces notes se complètent
à chaque commit.

## Ancres vérifiées (une fois, au départ)

| Annonce du brief | Trouvé | OK |
| --- | --- | --- |
| `Mairie.tsx` l. 25 (arobase) et l. 49-58 (rendu du courriel) | l. 25 `const arobase = … ?? -1` ; l. 49-58 : `<a className="mairie__courriel">` avec `<span>`/`<wbr>`/`<span>` | ✅ |
| `PiedDePage.tsx` l. 56-58 : courriel rendu brut | l. 56-59 : `{t.courriel} <a href={`mailto:${c.email}`}>{c.email}</a>` | ✅ |
| `littoral/theme.css` l. 326-391 : rive mairie | l. 326-337 `.section-mairie` en `flex; flex-wrap: wrap` ; l. 339-344 casettes (marge/box `1.8rem`) ; l. 390-392 `.section-mairie p:not(:has(strong)) { max-width: 22rem }` | ✅ |
| `village/theme.css` : règle `.mairie__courriel` | l. 385-388 `.mairie__courriel span { white-space: nowrap }` | ✅ |
| `tests/e2e/suites-1440.e2e.spec.ts` | lu en entier : 11 tests, `lignesCourriel` (l. 89-121) mesure par Range par caractère dans `.section-mairie` | ✅ |

Repérages complémentaires (grep, une fois) :

- `PiedDePage` n'est rendu que par `src/app/(frontend)/[lang]/layout.tsx`
  (l. 7, l. 128). Ce layout importe la feuille globale
  `src/app/(frontend)/styles.css` (l. 26) **et** la `theme.css` du gabarit
  par `<link precedence>` (l. 96-97, via `src/gabarits/fichiers.ts`). La
  feuille globale est donc chargée partout où `PiedDePage` peut apparaître,
  avec ou sans thème.
- Échelle du littoral : `html { font-size: 106.25 % }` (l. 62-63) → en
  **propriété**, `22rem` = 374 px. Les media queries, elles, basculent entre
  700 et 701 px pour `43.75rem` (mesure suites-1440 : 1 colonne à 700, 2 à
  701) : leur `rem` vaut bien 16 px (valeur initiale), les ruptures sont à
  700 et 900 px.
- Ruptures littoral : `@media (max-width: 56.25rem)` (l. 899, rive en grille
  2 colonnes) et `@media (max-width: 43.75rem)` (l. 1019, 1 colonne, avec
  reset `max-width: none` des `p:not(:has(strong))` l. 1036-1039 — le
  commentaire du fichier y explique le pourquoi des filets pleine largeur).
- `.mairie__courriel` n'est utilisé ni par les tests e2e ni ailleurs dans
  `src/` que `Mairie.tsx` l. 53 et les deux `theme.css` — la classe reste
  néanmoins exigée par le brief (elle marque le lien de la carte mairie).

## Cadre de travail

- Services : `docker compose -f docker-compose.dev.yml up -d postgres minio
  createbuckets`. Serveur de développement sur le **port 3000** (sur 3007,
  Payload refuse les écritures), lancé par cette session, arrêté à la fin.
- `.env` du worktree non lu, aucune migration, aucun champ Payload touché.
- Événements de démonstration : à vérifier au démarrage (décalés au 23/10
  par la session précédente, `notes-suites-1440.md` § Tâche A).

## Tâche A — le courriel du pied de page se coupe aussi après l'arobase

### Mesures avant (code de `398585a`)

Spéc jetable (non commis) mesurant, par Range par caractère, les lignes du
lien `mailto:` du pied (`.pied-page a[href^="mailto:"]`) et de la carte
mairie (`.section-mairie a[href^="mailto:"]`) — courriel de test
`secretariat.mairie@commune-saint-exupery-sur-mer.fr` :

| Gabarit | Largeur | Pied | Carte mairie |
| --- | --- | --- | --- |
| village | 390 | `secretariat.mairie@commune-` / `saint-exupery-sur-mer.fr` | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` |
| village | 1440 | `secretariat.mairie@commune-saint-exupery-` / `sur-mer.fr` | idem ✅ |
| littoral | 390 | `secretariat.mairie@commune-` / `saint-exupery-sur-mer.fr` | idem ✅ |
| littoral | 1440 | `secretariat.mairie@commune-saint-exupery-` / `exupery-sur-mer.fr` | idem ✅ |

Le pied coupait donc au trait d'union (comportement par défaut du
navigateur : repli autorisé après `-` et `/`). Un seul `mailto:` par
emplacement, `scrollWidth` = viewport partout, déjà corrects avant.

### Modification

- Nouveau composant partagé `src/components/Courriel.tsx` : rend `null` si
  l'adresse est absente (garde-fou « téléphone sans courriel » conservé),
  sinon un unique `<a class="courriel" href="mailto:…">` découpé en
  `<span>partie­locale@</span><wbr /><span>domaine</span>`. Champ de type
  email : l'arobase est garantie par la validation Payload.
- `Mairie.tsx` : le bloc courriel appelle `<Courriel … className="mairie__courriel" />`
  (classe conservée sur le lien de la carte mairie) ; la ligne `arobase`
  disparaît.
- `PiedDePage.tsx` : `{t.courriel} <Courriel adresse={c.email} />`.
- CSS : **une seule règle globale** `.courriel span { white-space: nowrap }`
  dans `src/app/(frontend)/styles.css` (juste après la règle `a`), et retrait
  des deux règles `.mairie__courriel span` de `village/theme.css` et
  `littoral/theme.css`. Pourquoi la feuille globale : le layout frontal
  importe `styles.css` en même temps que la `theme.css` du gabarit (repérage
  ci-dessus), et l'aperçu (`(apercu)/layout.tsx`) l'importe aussi — la règle
  vaut donc partout où `PiedDePage` ou `Mairie` peut être rendu, y compris
  hors thème, comme l'exige le brief. Les sélecteurs de thèmes ne
  couvraient que la carte mairie.

### Mesures après

Même spéc jetable, même courriel de test :

| Gabarit | Largeur | Pied | Carte mairie |
| --- | --- | --- | --- |
| village | 390 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| village | 1440 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| littoral | 390 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |
| littoral | 1440 | `secretariat.mairie@` / `commune-saint-exupery-sur-mer.fr` | idem |

Coupure uniquement après l'arobase aux quatre emplacements, un seul
`mailto:` avec l'adresse entière (href mesuré), `scrollWidth` = viewport
partout, carte mairie inchangée. `suites-1440` repassée : 11/11 verts.

## Tâche B — littoral 1440 : la rive mairie sur une seule rangée

À compléter.

## Test

À compléter (rouge ancien / vert nouveau).

## Clôture

À compléter (vérification finale, captures).

## Journal

- (ce commit) — squelette de ces notes (ancres vérifiées, cadre).
- Tâche A — composant `Courriel` partagé, règle `nowrap` globalisée dans
  `styles.css`, mesures avant/après ci-dessus.
