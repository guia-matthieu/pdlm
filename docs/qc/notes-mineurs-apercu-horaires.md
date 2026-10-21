# Mineurs — aperçu (bundle, sandbox) et plages horaires

Brief : `~/Projects/guia/tasks/2026-10-21_brief-glm-mineurs-apercu-horaires.md`.
Branche `mineurs-apercu-horaires`, partie de `integration-2026-10-21` à
`3eb73c9`. Quatre corrections courtes, sans plan. Ces notes se complètent à
chaque commit.

## A. Bundle admin — `peutApercevoir` hors du registre

### Constat repris

`ApparenceApercu.tsx` l. 7 importait `peutApercevoir` depuis `@/lib/apercu`,
qui importe `GABARITS` (`@/gabarits/registre`, l. 15) pour valider le
paramètre `gabarit` : le graphe du composant client emportait le registre.

### Ce qui a changé (commit `Aperçu — peutApercevoir déplacé, le registre hors du composant`)

- `src/lib/apercu-acces.ts` (nouveau) : `peutApercevoir` et sa seule
  dépendance, `@/access/roles` (`isOperateur`, `aRoleSur`,
  `UtilisateurAcces`). Aucun import du registre.
- `src/lib/apercu.ts` : fonction retirée, réexportée
  (`export { peutApercevoir } from './apercu-acces'`) — l'appelant serveur
  (`apercu/apparence/page.tsx` l. 8) est inchangé.
- `src/components/admin/ApparenceApercu.tsx` l. 7 : import depuis
  `@/lib/apercu-acces`. Plus aucun composant client n'importe `@/lib/apercu`
  (vérifié : `grep -rn "lib/apercu" src/` ne rend plus que la page serveur et
  le réexport).

### Mesure avant / après

`npm run build` (réussi deux fois), puis repérage du chunk par la chaîne
« Aperçu du site public » (rendue par `ApparenceApercu`) :

| | chunk | octets |
| --- | --- | --- |
| avant | `.next/static/chunks/44p-a8safsw91.js` | 423 696 |
| après | `.next/static/chunks/11lg2gfn_e1l_.js` | 423 519 (−177) |

Marqueurs du registre dans le chunk (`grep -c`) : `littoral`, `bricolage`,
`Atkinson`, `source-serif` — présents avant **et** après (1 occurrence chacun ;
littéral `littoral:{gabarit:{nom:"littoral",…`).

### Pourquoi le registre reste : `FriseApercu`

Le même chunk embarque `FriseApercu` (marqueur `frise-apercu`, 1 occurrence),
qui importe lui-même le registre (`FriseApercu.tsx` l. 6) et s'en sert au
rendu : `composerFrise(entree.kit, saisies)` (l. 50-55) redessine la frise à
chaque frappe, côté client. C'est un usage en fonctionnement, pas un import
résiduel : le registre est chargé pour la frise, il ne peut pas quitter ce
chunk sans redéfinir ce composant (kit servi par le serveur, découpage de
chunks…). Rien de tout cela n'est dans le périmètre de la décision A, qui
prescrivait seulement le déplacement de `peutApercevoir` — exécuté tel quel.

**Le critère « le registre n'est plus dans le chunk admin » n'est donc pas
atteint**, par FriseApercu et non par `@/lib/apercu` (dont le graphe est
propre). Options pour trancher :

1. **Accepter** (recommandé) : la décision est appliquée, l'arête
   `ApparenceApercu → lib/apercu → registre` est coupée ; si FriseApercu
   change de chunk ou de forme, le registre ne suivra plus l'aperçu
   d'apparence.
2. Servir la composition de frise depuis le serveur (prop de kit) — nouvelle
   conception, à décider.
3. Découper les chunks admin (config webpack) — fragile, n'économise rien tant
   que la frise charge le registre.

## B. Iframe d'aperçu — `sandbox="allow-same-origin"`

### Ce qui a changé (commit `Aperçu — iframe de l'aperçu posée en sandbox`)

`ApparenceApercu.tsx` l. 161 : l'iframe reçoit
`sandbox="allow-same-origin"` (sans `allow-scripts` : l'aperçu est rendu côté
serveur). Lien de la spec HTML vérifié : same-origin conservé, scripts et
formulaires coupés.

### Vérification sur capture

`docs/qc/captures-mineurs-apercu-horaires/apercu-sandbox-1440.png` — onglet
Apparence de saint-ex (gabarit « Village », sélecteur 1440 px), navigateur
Chromium 1440×900, serveur de dev port 3000. Aucune écriture en base (lecture
de la fiche seule, aucun champ touché, aucun verrou posé).

Mesures dans l'iframe au moment de la capture (script Playwright jetable,
supprimé) :

- attribut `sandbox` rendu : `allow-same-origin` ;
- titre du document : « Aperçu de l'apparence », `h1` « Saint-Exupéry-les-Bains » ;
- police calculée du `h1` : `Bricolage, "Atkinson Next", system-ui, sans-serif` ;
- couleur calculée : `rgb(14, 34, 42)`.

L'aperçu n'est pas cassé : la page s'affiche encadrée, polices et couleurs
comprises (visible sur la capture). Pas de fichier « à décider ».

## C. `importMap.js` — sortie du générateur

`npm run generate:importmap` : « No new imports found, skipping writing
import map ». Pour éprouver la forme aussi (le saut d'écriture ne compare
que les imports), le fichier a été supprimé puis le générateur relancé :
« Writing import map to …/admin/importMap.js ». `git diff --stat` sur
`src/app/(payload)/admin/importMap.js` : **aucune différence** — le fichier
de la branche est octet pour octet la sortie du générateur (le reformatage
de la tâche 9 est déjà la forme générée). Rien à garder ni à changer, aucune
édition à la main.
