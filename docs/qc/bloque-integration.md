# Blocage d'intégration — échecs e2e de la première suite complète

Brief : `~/Projects/guia/tasks/2026-10-21_brief-glm-integration.md`, étape 4 :
« si la cause est ailleurs [que la combinaison des branches] […], écris
`docs/qc/bloque-integration.md` (mesure, commande et sortie, options,
recommandation), commite et rends la main. »

Détail complet des mesures et de la preuve : `notes-integration-2026-10-21.md`,
section « Incident e2e ». Résumé autonome ici.

## Mesure

La première suite e2e complète de la branche `integration-2026-10-21`
(17 fichiers, `E2E_PORT=3000`) a rendu **4 échecs** — `apercu.e2e.spec.ts`
l. 112, 153, 226, 273 — tous au même symptôme : le select Gabarit de la
fiche commune affiche « Littoral », « Village » attendu. Relancé seul, le
fichier passe 6/6 deux fois de suite.

La cause n'est pas la combinaison des branches mais l'état initial de la
base de dev partagée : `communes.apparence_gabarit = 'littoral'` sur
`saint-ex` **avant** la suite (résidu d'une session antérieure
vraisemblablement interrompue avant son remise en état ; l'auteur exact
n'est pas démontrable). `apercu.e2e.spec.ts` suppose l'état du seed (select
à « Village ») et n'en pose pas un lui-même. Reproduction déterministe en
posant `littoral` (psql) puis en relançant la suite : **mêmes 4 échecs,
mêmes symptômes** ; en `village` (état du seed réel — posé à la création par
le `defaultValue` de `Communes.ts`) : **144 passés, 4 sautés, 0 échec**.

## Commandes et sorties

```console
$ docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres \
    -d pdlm_gabarits_dev -c "update communes set apparence_gabarit='littoral' \
    where slug='saint-ex';"
UPDATE 1
$ curl -s http://localhost:3000/ | grep -o '/gabarits/[a-z]*/theme.css'
/gabarits/littoral/theme.css
$ E2E_PORT=3000 npm run test:e2e          # run B, départ « littoral »
  4 failed  (apercu.e2e.spec.ts:112, 153, 226, 273 — « Littoral » au lieu de « Village »)
  4 skipped
  140 passed (4.6m)
$ # … remise à 'village' (UPDATE + curl → village/theme.css) …
$ E2E_PORT=3000 npm run test:e2e          # run C, départ « village »
  4 skipped                               # mesure.e2e.spec.ts, serveur réutilisé sans vars Umami
  144 passed (4.7m)                       # exit 0
```

## Options

1. **Ne rien corriger ici** (retenu pour cette branche) : la fusion est
   saine, la suite est verte depuis l'état du seed ; l'incident ne se
   reproduit que si une session meurt en posant `littoral` sans remise en
   état. Coût : l'incident reparaîtra à la prochaine interruption brutale
   d'une spec gabarit (fin de quota), avec le même diagnostic à refaire.
2. **Rendre `apercu.e2e.spec.ts` insensible à l'état initial** : poser
   `apparence: { gabarit: 'village' }` en `beforeAll` (comme
   `accessibilite.e2e.spec.ts` pose le sien) au lieu de supposer l'état du
   seed, et restaurer l'origine en `afterAll`. Coût : touche une spec déjà
   relue de la branche `gabarits-couleurs` — décision à prendre avec son
   relecteur, pas sur une branche d'intégration.
3. **Re-seeder la base de dev avant chaque suite complète** : réécrit les
   données que partagent les autres worktrees/sessions ; disproportionné.

## Recommandation

Option 1 maintenant : avancer `integration-2026-10-21` dans `main` telle
quelle (tout vert : lint, typecheck, 308 unitaires, 228 intégration, 144 e2e,
build). Ouvrir en suivi, sur une branche à part, l'option 2 si ces échecs
résiduels reviennent — c'est une solidification des specs, pas un défaut de
la fusion.
