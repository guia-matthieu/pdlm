# Notes QC — travail 1 : lien d'appel au format international, puis tâche 7 : Frise Village dans l'admin

> **Qui a écrit ces notes.** Session d'exécution GLM (14/10/2026), brief `~/Projects/guia/tasks/2026-10-12_brief-glm-gabarits-tache7.md`. Écrites au fil des commits. La tâche 7 suit le plan `docs/superpowers/plans/2026-09-25-gabarits-couleurs.md`, tâche 7 (l. 1079), branche `gabarits-couleurs` partie de `ffe9542`.

## Travail 1 — lien d'appel au format international

### Ce qui a été fait

Ancres vérifiées d'abord : `src/gabarits/sections/Mairie.tsx:28` et `src/components/PiedDePage.tsx:52` portaient bien `href={`tel:${….replace(/\s/g, '')}`}`. Aucune suite existante n'affirme cet `href` : les deux mentions `tel:` des tests (`tests/unit/url.spec.ts:12`, `tests/unit/adresses.spec.ts:112`) sont des entrées du validateur d'URL et des liens épargnés par `cheminLangue`, pas des attendus de composants — rien à corriger.

TDD : `tests/unit/telephone.spec.ts` écrit et exécuté avant le code.

- `src/lib/telephone.ts` : fonction pure `lienTelephone(saisie: string): string`, rend le `href` complet (`tel:` compris). Règles dans l'ordre du brief : `+` de tête conservé ; `00` de tête remplacé par `+` ; dix chiffres commençant par `0` hors préfixes d'outre-mer → `tel:+33` + les neuf derniers ; tout le reste → `tel:` + les chiffres (comportement d'aujourd'hui). Nettoyage : seuls les chiffres sont gardés, un `+` ne survit que s'il est en tête de la saisie.
- `PREFIXES_OUTRE_MER` : constante nommée des 15 préfixes du brief, avec le commentaire demandé (« non vérifiée contre le plan de numérotation »).
- `Mairie.tsx` et `PiedDePage.tsx` : le `href` passe par `lienTelephone()`, le texte affiché ne change pas. Rien d'autre touché dans ces deux fichiers.

### Commandes et sorties

Test vu rouge d'abord (le module n'existe pas encore) :

```
$ npx vitest run tests/unit/telephone.spec.ts
 Test Files  1 failed (1)
      Tests  no tests
   (erreur de résolution de @/lib/telephone)
```

Puis vert après le code :

```
$ npx vitest run tests/unit/telephone.spec.ts
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

`npm run typecheck` : 0 erreur (sortie vide après la ligne de commande).

### Écarts au brief

Aucun.

## Tâche 7 — Frise Village dans l'admin

(à compléter à chaque commit)
