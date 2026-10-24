# Notes — deux corrections e2e : garde photos de gabarits-captures, état de départ d'apercu

Branche `e2e-independants`, partie de `main` à `c54119d`. Brief :
`~/Projects/guia/tasks/2026-10-25_brief-glm-e2e-independants.md`.

Deux correctifs courts, un commit chacun, dans deux fichiers de tests
seulement. Contexte de départ : `docs/qc/bloque-rpnt-lot2.md` (worktree
`glm.conformite`) pour A, `git show integration-2026-10-21:docs/qc/bloque-integration.md`
pour B.

Environnement : Docker 28.5.1, `docker compose -f docker-compose.dev.yml up -d
postgres minio createbuckets`, serveur de dev sur le port 3000, base du worktree
`pdlm_gabarits_dev` (lue par `pg_stat_activity` au premier rendu — le `.env` du
worktree n'a été ni lu ni touché). État de départ vérifié :
`apparence_gabarit = 'village'` sur `saint-ex`, et
`curl -s http://localhost:3000/ | grep -o '/gabarits/[a-z]*/theme.css'` →
`/gabarits/village/theme.css`.

## A. `gabarits-captures.e2e.spec.ts` — le `beforeAll` téléversait sans regarder `avecPhotos`

Le `beforeAll` du `describe.serial` de chaque gabarit téléversait toutes les
photos de la maquette (héros, actualités, tuiles) sans regarder `avecPhotos`
(`existsSync(g.images)`, calculé par gabarit). Les images du Littoral vivent
hors dépôt (`docs/recherche/`, exclu par `.git/info/exclude` partagé) : dans un
worktree neuf, `readFile` levait ENOENT dans le `beforeAll` → 1 failed + 3 did
not run en cascade, au lieu des sauts propres que les gardes `test.skip` des
seuls tests « avec photos » (message existant : « photos de la maquette
absentes ») sont faits pour produire. Analyse de départ :
`~/Projects/glm.conformite/docs/qc/bloque-rpnt-lot2.md`.

Correctif : le téléversement est gardé par `if (avecPhotos)`. Photos absentes,
le `beforeAll` ne téléverse rien (`photo` reste vide, jamais lue par les tests
« sans photo » : `habiller(jeu, false)` passe `null` partout) ; les gardes
existantes des tests « avec photos » sautent avec leur message inchangé. Photos
présentes, aucun changement : la garde est transparente. Le Village (images
suivies dans `src/`) et les tests « sans photo » tournent dans les deux cas.

### Mesures (fichier rejoué seul, `E2E_PORT=3000 npx playwright test tests/e2e/gabarits-captures.e2e.spec.ts`)

Particularité de CE worktree : les 37 images de la maquette J y sont présentes
(copiées hors git — exclues par `.git/info/exclude`, donc `git status` propre),
contrairement à un worktree neuf. L'absence a donc été simulée le temps de
chaque run, puis les fichiers remis en place.

**Simulation de l'absence.** Les premières mesures (celles du tableau
avant/après) ont déplacé le dossier hors du worktree, vers `/tmp` :

```console
$ mv /Users/matthieucredou/Projects/glm.gabarits/docs/recherche /tmp/recherche-e2e-absente
$ # … run Playwright …
$ mv /tmp/recherche-e2e-absente /Users/matthieucredou/Projects/glm.gabarits/docs/recherche
$ ls docs/recherche/2026-09-25_front-beau/J-maquette-littoral/images/ | wc -l
     37
$ git status --short          # vide
```

Sur consigne du relecteur, toute simulation suivante se fait par renommage
à l'intérieur du worktree, sans sortie hors `~/Projects/glm.gabarits` :

```console
$ mv docs/recherche docs/recherche.absent
$ # … run Playwright …
$ mv docs/recherche.absent docs/recherche
```

**Sorties Playwright brutes** (lignes de résumé telles quelles) :

```console
$ # Avant correctif, photos absentes :
  1 failed
    [chromium] › tests/e2e/gabarits-captures.e2e.spec.ts:423:5 › Captures du gabarit
    Littoral — deux jeux de couleurs (tâche 10) › jeu #2a7f9e avec photos : gabarit
    composé, dérivation appliquée      (Error: ENOENT: … phare-pano-2000.jpg, à televerser l. 214, appelé par le beforeAll l. 347)
  3 did not run
  4 passed (22.0s)

$ # Après correctif, photos absentes :
  2 skipped
  6 passed (24.8s)

$ # Avant correctif, photos présentes :
  8 passed (38.6s)

$ # Après correctif, photos présentes :
  8 passed (34.3s)

$ # Après correctif, photos absentes — re-mesure de contrôle
$ # (renommage interne docs/recherche.absent, méthode ci-dessus) :
  2 skipped
  6 passed (23.4s)
```

| Photos maquette J | Avant correctif                     | Après correctif       |
| ----------------- | ----------------------------------- | --------------------- |
| absentes          | `1 failed, 3 did not run, 4 passed` | `2 skipped, 6 passed` |
| présentes         | `8 passed`                          | `8 passed`            |

Détail du « après, absentes » : les 2 tests « avec photos » du Littoral sautent
(garde existante `test.skip(!avecPhotos, 'photos de la maquette absentes')`,
l. 431/457 après correctif) ; les 2 « sans photo » du Littoral et les 4 du
Village passent. Plus aucun échec ni « did not run ».

## B. `apercu.e2e.spec.ts` — l'état de départ « village » est posé par le fichier

Le fichier supposait `saint-ex` au gabarit « Village » (état du seed) sans le
poser. La base de dev étant partagée entre worktrees, un `littoral` résiduel
d'une session interrompue avant sa remise en état faisait échouer 4 tests sur
l'état de départ, pas sur l'aperçu (mesure et reproduction :
`git show integration-2026-10-21:docs/qc/bloque-integration.md`, rejoué ici à
l'identique : `4 failed, 2 passed (1.0m)`).

Correctif : un `beforeAll` de fichier lit le gabarit présent, PATCHe `village`,
et un `afterAll` rend le gabarit trouvé (les hooks de fichier ne tournent qu'une
fois, `workers: 1`). Deux points venus de la relecture, mesurés au passage :

- **Session opérateur, pas admin de commune.** `apparence.gabarit` est réservé
  à l'opérateur (Décision 15, `src/collections/Communes.ts` l. 405-408,
  `access.update: isOperateur`) : un PATCH par l'admin de la commune répond 200
  mais Payload retire le champ en silence — l'update n'a aucun effet. Une
  première version des hooks connectée en admin l'a prouvé sur pièce : depuis
  `littoral` posé par psql, `4 failed … 2 passed (1.3m)` comme sans correctif,
  puis un run suivant vert uniquement parce que le `finally` du test
  « opérateur » (lui connecté en opérateur) était retombé sur `village`.
- **Relecture après chaque PATCH** : le code 200 ne prouve rien (ci-dessus) ;
  un GET relit la commune et vérifie `apparence.gabarit` (avant comme après).

### Preuve (fichier rejoué seul, `E2E_PORT=3000 npx playwright test tests/e2e/apercu.e2e.spec.ts`)

```console
$ # Départ posé à la main, comme dans bloque-integration.md :
$ docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d pdlm_gabarits_dev -c "update communes set apparence_gabarit='littoral' where slug='saint-ex';"
UPDATE 1
$ curl -s http://localhost:3000/ | grep -o '/gabarits/[a-z]*/theme.css' | head -1
/gabarits/littoral/theme.css

$ E2E_PORT=3000 npx playwright test tests/e2e/apercu.e2e.spec.ts
Running 6 tests using 1 worker

  ✓  1 [chromium] › tests/e2e/apercu.e2e.spec.ts:161:3 › Aperçu d’apparence — accès et en-têtes › anonyme : 404, même pour une commune qui existe (I28) (2.2s)
  ✓  2 [chromium] › tests/e2e/apercu.e2e.spec.ts:172:3 › Aperçu d’apparence — accès et en-têtes › admin : l’accueil du gabarit servi, encadrable, ni en cache ni indexé (2.3s)
  ✓  3 [chromium] › tests/e2e/apercu.e2e.spec.ts:205:3 › Aperçu d’apparence — accès et en-têtes › le site public garde frame-ancestors none (821ms)
  ✓  4 [chromium] › tests/e2e/apercu.e2e.spec.ts:213:3 › Aperçu d’apparence — onglet de l’admin › admin : aperçu en direct, sans écriture tant qu’on n’enregistre pas (6.6s)
  ✓  5 [chromium] › tests/e2e/apercu.e2e.spec.ts:286:3 › Aperçu d’apparence — onglet de l’admin › admin : une couleur forcée est marquée et alertée dans la bande des contrastes (8.6s)
  ✓  6 [chromium] › tests/e2e/apercu.e2e.spec.ts:333:3 › Aperçu d’apparence — onglet de l’admin › opérateur : le gabarit basculé est servi dans l’aperçu (6.0s)

  6 passed (32.3s)

$ # Après le run, l'afterAll a rendu l'état initial trouvé (littoral) :
$ docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d pdlm_gabarits_dev -t -c "select apparence_gabarit from communes where slug='saint-ex';"
 littoral

$ # Remise à l'état de repos du worktree, puis vérification par curl :
$ docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d pdlm_gabarits_dev -c "update communes set apparence_gabarit='village' where slug='saint-ex';"
UPDATE 1
$ curl -s http://localhost:3000/ | grep -o '/gabarits/[a-z]*/theme.css' | head -1
/gabarits/village/theme.css
```

Départ `village` (nominal, état du seed), après correctif : `6 passed (32.7s)`,
afterAll rend `village`, curl → `/gabarits/village/theme.css`.

| Gabarit de départ     | Avant correctif      | Après correctif    |
| --------------------- | -------------------- | ------------------ |
| `village` (seed)      | `6 passed`           | `6 passed (32.7s)` |
| `littoral` (résiduel) | `4 failed, 2 passed` | `6 passed (32.3s)` |
