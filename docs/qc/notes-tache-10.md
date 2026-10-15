# Notes QC — tâche 10 : README, captures regardées, audit final

> **Qui a écrit ces notes.** Session d'exécution GLM (15/10/2026), brief `~/Projects/guia/tasks/2026-10-15_brief-glm-gabarits-tache10.md`. Écrites au fil des commits. Tâche 10 du plan `docs/superpowers/plans/2026-09-25-gabarits-couleurs.md`, branche `gabarits-couleurs` partie de `0d3aea4` (arbre propre).

## Ancres du 15/10 — commit `Plan — tâche 10 : ancres du 15/10`

Vérifiées une à une avant tout écrit :

- README § « Accessibilité (RGAA) » : l. 403-418, conformes au brief. La consigne à retirer est la puce l. 407-414 (« **Avant publication**, vérifier le contraste… vérifier avant d'activer la commune ») — le brief la donnait l. 406-414 : la l. 406 (« focus visible…zoom 200 % ») appartient en réalité à la puce « Navigation clavier » (l. 405-406), qui reste. Restent aussi l. 415 (texte alternatif obligatoire) et la phrase l. 416-418 (Lighthouse signal rapide, « seule une recette manuelle (grille RGAA officielle) fait foi »).
- Filtre des chunks : `tests/e2e/gabarits-conformite.e2e.spec.ts` l. 274 (`.filter((src) => !src.startsWith('/_next/static/chunks/'))`), commentaire l. 266-269 — conformes.
- Gabarits : `src/gabarits/village` et `src/gabarits/littoral` présents.
- Scripts : `package.json` l. 8 (`build`, `--max-old-space-size=8000`), l. 16 (`start` = `next start`), l. 17 (`test` = unit + int + e2e).
- Ignorés : `.gitignore` l. 16 (`/.next/`), l. 50 (`/test-results/`).
- Outils : `montage` présent (`/opt/homebrew/bin/montage`).

Seule correction au plan : l. 1128, ancre de la section README (167-182 → 403-418). Les autres entrées de la tâche 10 ne portent pas de n° de ligne, rien d'autre à corriger.

## Affectation des jeux de couleurs (avant l'étape 2)

Le brief écrit « principale / accent / texte » ; le plan tranche l'ordre (l. 45 : « Défauts : principale `#264653`, accent `#e2a72e`, terre `#b36b00` ») et l'affectation (l. 199 : `deriver({ principale: '#2a7f9e', terre: '#d2462f' })`) :

- **Jeu 1** : principale `#2a7f9e`, accent `#f2b134`, terre `#d2462f` ;
- **Jeu 2** : principale `#9b3d57`, accent `#7fc4c9`, terre `#e08a2c`.

## Commit 2 — `README — accessibilité : ce que garantit la dérivation des couleurs`

La puce l. 407-414 (consigne de vérification manuelle + lien webaim) est remplacée par deux puces : ce que la dérivation garantit, puis l'échappatoire des couleurs forcées. Puce « texte alternatif » (l. 415) et puce Lighthouse (l. 416-418) conservées telles quelles.

Chaque affirmation du nouveau texte, avec sa source et le test qui la vérifie :

- **« La seule validation est le format `#rrggbb` »** — invariant I24 (spec l. 58 : « Rien n'est refusé sauf le format ») ; code : `src/lib/couleurs.ts` l. 56 (`FORMAT = /^#[0-9a-fA-F]{6}$/`) appliqué par `valide()` l. 62 aux trois saisies (l. 189-191) et aux forcées (l. 197). Tests : `tests/unit/couleurs.spec.ts` « une saisie hors format vaut le défaut » (l. 119), « les majuscules sont acceptées et donnent la même sortie » (l. 138), « une forcée hors format est ignorée » (l. 161).
- **« chaque couple texte/fond est ajusté, teinte conservée, jusqu'à son seuil »** — `assombrirJusqua` (couleurs.ts l. 139-141, « Plus grande clarté (teinte gardée) qui atteint `seuil`… inchangée si déjà conforme ») et `eclaircirJusqua` (l. 153-155) : dichotomie sur la seule clarté OKLCH. Invariant I25 (spec l. 93 : « Chaque garantie du tableau tient pour toute couleur choisie valide »). Test : `couleurs.spec.ts` describe « deriver — garanties (I25) », « toutes les garanties tiennent sur 3 000 tirages » (l. 23, propriété fast-check à graine fixe), plus les cas nommés « #2f7d5b (4,99:1) ressort inchangée » (l. 67) et « #7fc8a0 (1,97:1) est assombrie jusqu'à 4,5:1 avec un écart de teinte < 2° » (l. 71).
- **Seuils cités** — tels que `deriver()` les applique : 4.5:1 texte courant sur blanc (`--principale-sure`, l. 201 et contrôle l. 237), sur pâle (`--encre` sur `--pale`, contrôle l. 238) et sur accent (`--texte-sur-accent` noir ou blanc selon le meilleur contraste, l. 230, contrôle l. 241) ; 3:1 grandes dates sur profond (`--accent-sur-profond`, l. 233, contrôle l. 240 — CONTRAT.md l. 114 : garantie 3:1 pour du texte large ≥ 24 px ou ≥ 18,66 px gras) et pictogrammes (tons l. 217, contrôles l. 242-251) ; 7:1 texte blanc sur profond (l. 204, contrôle l. 239).
- **« la bande “Contrastes dérivés” montre en direct les onze rapports »** — le tableau de contrôles fait 5 lignes nommées + 6 pictos = 11 (couleurs.ts l. 236-252) ; rendu par `ApparenceApercu.tsx` (`.contrastes`, l. 170-187), recalculé à chaque rendu du formulaire (l. 84-86 : « I23 : la bande de contrôle recalcule la dérivation à chaque rendu, comme le site public le fera »). Test e2e : `tests/e2e/apercu.e2e.spec.ts` « admin : aperçu en direct, sans écriture tant qu'on n'enregistre pas » — `[data-role]` au nombre de 11 (l. 214), frappe d'accent suivie dans l'iframe, zéro écriture API.
- **« une couleur forcée est servie telle quelle, sans ajustement »** — couleurs.ts l. 221-227 (« Une forcée remplace sa variable ») : `f.texte ?? sure`, `f.pale ?? pale`, `f.profond ?? profond`, pictos l. 223 ; seules `--encre` et `--texte-sur-accent` restent calculées. Tests : « une forcée est utilisée telle quelle, marquée force, et avertit sous le seuil » (couleurs.spec.ts l. 146), « une picto forcée ne remplace que son ton » (l. 165), « l'accent sur profond se recalcule contre le profond forcé » (l. 171).
- **« marque la ligne “forcée, sous votre responsabilité” et passe en alerte si le rapport descend sous le seuil »** — `ApparenceApercu.tsx` l. 183-184 (`c.force ? ' — forcée, sous votre responsabilité' : ''` sur chaque ligne forcée), classe `insuffisant` (l. 177) et avertissements `role="alert"` (l. 189-196) remplis par les messages « … : 4,53:1, illisible » de couleurs.ts l. 262-264 (l'alerte n'apparaît que sous le seuil, la marque « forcée » sur toute forcée — le texte du README dit exactement cela).

Le champ admin porte déjà la même mention : `src/collections/Communes.ts` l. 490 (« Une couleur forcée est utilisée telle quelle (I24) : le contraste est sous votre responsabilité »).

**Écart au brief, motif** : le brief donne l'intitulé `README — accessibilité : ce que garantit la dérivation des couleurs` au « commit de clôture » (étape 5) tout en exigeant des commits à part par étape ; le plan (Step 5) attache cet intitulé au commit qui porte la réécriture du README. Je l'applique ici, au commit de l'étape 1 ; le commit de clôture final portera la mise à jour de l'état d'exécution du plan (le brief autorise ce commit à part).
