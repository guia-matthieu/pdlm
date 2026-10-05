# Notes QC — tâche 5, seconde moitié : mise en forme et composition du gabarit Village

Exécutée le 05/10/2026 dans le worktree `~/Projects/glm.gabarits`, branche
`gabarits-couleurs`, depuis `1eec8fa`. Suite de `docs/qc/notes-tache-05a.md`
(kit de frise, illustrations, polices : non refaits).

Commits, dans l'ordre :

| Commit | Objet |
|---|---|
| `4ff9ecd` | Plan : décision 19, ancres de la tâche 5 revérifiées |
| `77208dd` | **Correctifs du moteur (tâche 4)**, à part : pictos en 404, photos de la commune jamais affichées |
| `b4db31e` | Moteur : balisage que la maquette demande (ajouts consignés dans `CONTRAT.md`) |
| `2e59427` | `theme.css` porté et chargé, polices servies (décision 19) |
| `7673ed3` | `gabarit.ts`, `README.md` du gabarit, maquette de référence |
| `e140b0b` | Suite de conformité (points 3, 5, 8), test de captures |
| (ce commit) | Captures, notes, statut de la tâche dans le plan |

## Ce qui a été fait

- **`src/gabarits/village/theme.css`** (851 lignes une fois formaté) : la mise en forme de
  `K-village-illustre/theme.css`, réécrite sur le balisage des sections
  communes. Les 7 couleurs littérales, les 12 `rgba()` et les anciennes
  variables ont disparu : `--principale-fonce` → `--profond` ; `--texte` →
  `--encre` ; `--texte-doux` → variable locale `--doux` (`color-mix(in oklab,
  var(--encre) 72%, #fff)`) ; `--bande` → `--pale` ; ombres et voiles →
  `color-mix(… var(--encre) …, transparent)`. Le vert « ouvert » (`#14532d`,
  `#1f9d55`) et les couleurs de l'alerte de la maquette (`#fff3cf`, `#85590a`)
  n'ont plus d'emploi (voir Écarts).
- **Chargement** : décision 19 (ci-dessous).
- **`gabarit.ts`** : héros, démarches, mairie, texte libre, actualités
  (variante `une`), agenda, mosaïque (variante `une-haute`) ; `cadrageHeros:
  'haut'` ; `friseAuPied: true` ; `polices` = les deux fichiers servis.
- **`README.md`** du gabarit (intention, fichiers, couleurs, crédits, licences).
- **`maquette/`** : `accueil.html`, `accueil-illustre.html`, leur `theme.css`
  d'origine (seule retouche : `url(polices/` → `url(../polices/`), `images/`
  (1,5 Mo, Wikimedia Commons CC0, `CREDITS.md`), `captures/` (6 captures du
  rendu réel). `.prettierignore` créé pour que le formateur n'y touche pas
  (`accueil.html` vérifié identique à la source par `cmp`).

## Décision 19 — comment la feuille et les polices arrivent dans la page

Texte complet dans le plan. **Retenu** : deux routes statiques de l'origine,
`/gabarits/<nom>/theme.css` et `/gabarits/<nom>/polices/<fichier>`
(`force-static`, `generateStaticParams` tiré du registre, `dynamicParams =
false`), que le layout lie dans le `<head>` (`precedence="gabarit"`, donc
après `styles.css`) avec un `preload` par police. Les fichiers restent sous
`src/gabarits/<nom>/`, où les points 3 et 8 les lisent.

**Écartés** : `import './theme.css'` (feuille globale, tous les gabarits
servis à toutes les communes) ; `next/font/local` (préchargement des polices
de tous les gabarits, la feuille ne nomme plus ses polices) ; copie dans
`public/` (deux exemplaires) ; `<style>` en ligne (16 Ko par page, et les
polices demandent quand même une route).

**Mesuré** avant d'écrire la décision :

```
$ curl -s -D - -o /dev/null localhost:3000/gabarits/village/polices/bricolage-grotesque-latin-wght.woff2
HTTP/1.1 200 OK   content-type: font/woff2   cache-control: public, max-age=2592000
/gabarits/littoral/theme.css 404
/gabarits/village/polices/bricolage-LICENSE.txt 404
/gabarits/village/polices/..%2Ftheme.css 404

$ curl -s localhost:3000/ | grep -o '<link[^>]*>'
<link rel="stylesheet" href="/_next/static/chunks/src_app_(frontend)_styles_0-lpwga.css" …/>
<link rel="stylesheet" href="/gabarits/village/theme.css" data-precedence="gabarit"/>
<link rel="preload" href="/gabarits/village/polices/bricolage-grotesque-latin-wght.woff2" as="font" type="font/woff2" crossorigin="anonymous"/>
<link rel="preload" href="/gabarits/village/polices/AtkinsonHyperlegibleNext-Regular-latin.woff2" as="font" …/>

$ npm run build      (une fois, sur l'état de l'essai — pas relancé sur le HEAD final)
├   /gabarits/[nom]/polices/[fichier]
│ ├ ● /gabarits/village/polices/bricolage-grotesque-latin-wght.woff2
│ └ ● /gabarits/village/polices/AtkinsonHyperlegibleNext-Regular-latin.woff2
├   /gabarits/[nom]/theme.css
│ └ ● /gabarits/village/theme.css
$ cmp .next/server/app/gabarits/village/polices/bricolage-…woff2.body src/gabarits/village/polices/bricolage-…woff2
IDENTIQUE
$ cat .next/server/app/gabarits/village/theme.css.meta
{"status":200,"headers":{"cache-control":"public, max-age=3600","content-type":"text/css; charset=utf-8",…}}
```

Les fichiers prérendus sont dans `.next/standalone/.next/server/app/gabarits/`.
Le proxy a dû apprendre ces chemins : sans exception dans `HORS_LANGUE`
(`src/lib/adresses.ts`), il les réécrit vers `[lang]` — une ligne, valable pour
tous les gabarits.

## Le balisage : ce qui manquait, et ce que j'ai tranché

La maquette met en forme des éléments que les sections communes ne rendaient
pas. Le contrat interdit à un **gabarit** de toucher aux sections ; j'ai donc
fait des **ajouts au moteur**, valables pour tous les gabarits, consignés dans
`CONTRAT.md` (nouvelle section « Le balisage des sections », ligne ajoutée au
tableau des versions, contrat toujours v1 — additions seules) :

| Manque | Tranché |
|---|---|
| Actualités sans aucun visuel (la maquette : photo de une + vignettes) | Ajout au moteur : `.actu__visuel` = l'image de l'actualité, sinon une scène du kit. Une actualité n'a pas de champ `illustration` : la scène vient du **rang** (`ecole`, `patrimoine`, `associations`, `sentiers` — l'ordre de la maquette). Variante `une`. La date passe avant le titre. |
| Agenda : la date est une seule chaîne « 4 octobre 2026 » | Ajout au moteur : `jourEtMois()` (`src/lib/dates.ts`), jour et mois balisés à part. **L'année n'est plus affichée** dans l'agenda de l'accueil (elle reste dans `datetime`). |
| Mosaïque : scènes toutes en 480×600, recadrées dans des cases de formats différents | Variante `une-haute` : scènes au format de leur case, classe `mosaique--une-haute`. |
| Héros : pas de bouton « Faire une démarche » | Ajout au moteur : `a.section-heros__action` vers `#demarches`, rendu seulement si la section démarches l'est (I30). Clé `accueil.faireDemarche` ; **corse « Fà una pratica » : provisoire, à faire relire.** |
| Héros : le texte est blanc sur photo, encre sur le ciel dessiné | Classes `section-heros--photo` / `--illustre`. |
| Pied de page : la frise au trait | Option `friseAuPied` du gabarit ; le layout compose la frise de la commune et `PiedDePage` la rend. Sur toutes les pages du site. |
| Types | `Variante = 'une' \| 'une-haute'` remplace `variante?: string`. |

**Non construit, dit dans le README du gabarit** (pas de donnée, ou balisage
du layout commun hors de la tâche) : blason et mention « Mairie » de
l'en-tête, bouton « Nous contacter », menu replié sur téléphone, phrase
d'accroche du héros, phrase d'introduction des démarches, « Ouverte
aujourd'hui », tableau des horaires du pied. **Proposition** : un champ
`accueil.accroche` (traduisible) et le logo de la commune dans l'en-tête
(le champ `logo` existe, le layout ne le rend pas) rapprocheraient le plus le
rendu de la maquette ; à décider, hors de cette tâche.

## Défauts trouvés dans le travail antérieur (commit à part, `77208dd`)

Ni le kit ni les illustrations de la session 5a n'ont de défaut que j'aie vu.
Deux défauts de la **tâche 4**, révélés en regardant le rendu :

1. **Les pictogrammes des démarches répondaient 404.** `/pictos/*.svg` (dans
   `public/`) était réécrit par le proxy vers `/racine/pictos/…`. Les
   pastilles étaient des disques vides — visibles sur les captures de la
   tâche 4. Test d'abord (`adresses.spec.ts`, vu échouer), puis exception.
2. **La photo d'accueil et les photos de la mosaïque ne s'affichaient
   jamais.** La commune du site est lue avec ses relations peuplées ;
   `mediaDe` recevait un objet et le passait comme identifiant → `null` →
   toujours l'illustration. Corrigé par `idRelation` (`src/lib/relation.ts`,
   test unitaire vu échouer) ; le contrôle d'appartenance à la commune reste
   appliqué. La suite ne le voyait pas : la commune de démonstration n'a pas
   de photo.

## Suite de conformité (étape 4)

- **Point 3 lit réellement le fichier** : il a échoué deux fois sur le vrai
  `theme.css` avant de passer — sur le mot `rgba()` dans un commentaire, puis
  sur `var(--ton)` (variable posée par la section, hors contrat : retirée du
  thème, le fond de la pastille reste à `styles.css`). Le retour silencieux
  « pas de fichier » est supprimé : `theme.css` est requis, non vide.
- **Point 8 lit réellement le dossier** — et il était trop faible : n'importe
  quel fichier de licence validait toutes les polices. Il exige maintenant la
  licence **de chaque police** (`<famille>-LICENSE.txt`, convention écrite
  dans `CONTRAT.md`) et que `gabarit.polices` égale le contenu du dossier.
  Prouvé en retirant `atkinson-LICENSE.txt` :
  `✘ 8 — … Error: licence de AtkinsonHyperlegibleNext-Regular-latin.woff2`.
- **Point 5 : la mesure était fausse pour `color-mix()`.** La couleur
  calculée se lit `oklab(0.868 …)` ; l'ancien calcul en tirait trois chiffres
  comme des canaux 0-255 (premier passage : 4 faux échecs « 1.81 < 4.5 » sur
  fond sombre ; sur fond clair il aurait donné de faux succès). Remplacé par
  une lecture par canevas (toute syntaxe, transparence mêlée au fond). **C'est
  une modification de la suite commune**, que la décision 18 voulait stable :
  à relire en priorité. Avec la mesure juste, les trois palettes extrêmes
  passent.
- Le point 2 (I27, égalité des scripts) reste filtré en dev : tâche 10.

## Choix que le plan ne tranchait pas

- **Place du texte libre** : absent de la maquette ; placé après le bloc
  démarches + mairie, avant les actualités (comme le gabarit provisoire).
- **Sur téléphone, la carte mairie passe avant les démarches** (`order`),
  comme la maquette : l'ordre visuel diffère de l'ordre du DOM et de la
  tabulation pour ces deux sections. À juger à la recette RGAA.
- **Ciel blanc pour les scènes des actualités** : la bande et le ciel étaient
  tous deux `--pale`, la scène de la une n'avait plus de bord.
- **Dates des brèves en `--encre`** (sur le pâle, décision 17) ; la date de la
  une, sur sa carte blanche, garde `--principale-sure` comme la maquette.
- **Titre de l'en-tête en `--encre`** (maquette). Conséquence : le test
  `couleurs.e2e` qui sondait ce titre pour vérifier l'alias des liens a rougi ;
  la sonde est déplacée sur un lien de la page `/actualites` (même assertion).
- **Cache** : 1 h pour la feuille, 30 jours pour les polices, sans empreinte
  dans l'adresse.
- **Données des captures** : la commune de démonstration n'a en base **ni
  frise, ni photo** (le brief la disait « à photos partielles »), 2
  actualités, 2 événements, 3 démarches à lien. `tests/e2e/village-captures.e2e.spec.ts`
  la compose le temps des captures (frise de 21 pièces, 7 photos de la
  maquette, 2 actualités et 2 événements ajoutés, coordonnées, horaires) puis
  remet tout en état. Vérifié en base après le dernier passage : `media 0,
  actualités 2, événements 2, frise 0, photo d'accueil nulle`. Le grain n'est
  pas modifié.

## Écarts au plan

1. Source portée : `K-village-illustre/`, pas `G-maquette-v2/` (brief ; ancre
   corrigée dans le plan).
2. Le portage réécrit les sélecteurs : ce n'est pas un remplacement de
   variables dans le fichier de la maquette.
3. Ajouts au moteur et à `styles.css` (ci-dessus) : le plan ne prévoyait que
   les fichiers du gabarit.
4. `gabarit.ts` est commité en deux temps (`polices` avec l'étape 2, la
   composition avec l'étape 3) : les routes ont besoin de `polices`.
5. Un commit par étape, mais **les messages portent le numéro d'étape du
   plan** (« étape 1 », « 4 », « 5 »), pas celui du brief (2, 3, 4).
6. `tests/e2e/couleurs.e2e.spec.ts` modifié (sonde), `.prettierignore` créé.

## Captures regardées — écarts à la maquette, section par section

Dans `src/gabarits/village/maquette/captures/`. Références :
`K-village-illustre/captures/accueil-{desktop,mobile}.png` et
`accueil-illustre-{desktop,mobile}.png`. Les couleurs diffèrent par
construction (maquette vert sapin / ocre ; commune de démonstration aux
défauts ardoise `#264653` / `#e2a72e`).

| Section | 1440 | 390 |
|---|---|---|
| Bandeau d'alerte | Fond pâle, filet `--terre-sure` au lieu du jaune système ; pas de mot « Travaux » en gras ni de lien (le message est un texte simple). | idem |
| En-tête | **Écart net** : ni blason, ni « Mairie », ni bouton « Nous contacter ». Le menu a ses entrées réelles ; « Documents » y est deux fois (base déjà amorcée, cf. notes 5a). | **Écart net** : pas de bouton « Menu » ; le menu tient sur deux lignes sous le nom. |
| Héros, photo | Composition conforme (titre géant blanc, voile en biais, bouton blanc, frise blanche, carte mairie qui chevauche). Pas de phrase d'accroche. La photo est cadrée plus serré (taille `hero` 1600×900 recadrée au centre : moins de ciel) — tâche 6. | Conforme ; pas d'accroche. |
| Héros, illustré | Conforme à `accueil-illustre` : titre en encre sur le ciel, soleil, oiseaux, village à droite sous la carte mairie, frise blanche devant. | Conforme (soleil masqué, village recadré à droite). |
| Frise | Même principe ; la silhouette n'est pas celle de la maquette au pixel : le moteur pose les pièces à avances fixes (48 / 70 / 95), l'écart ne peut pas être négatif, donc des pièces larges se touchent (maison basse + mairie + arbre vers x = 750) et les sapins ne se serrent pas par deux. | idem |
| Démarches | Conforme (pastilles rondes teintées, picto blanc, titres Bricolage). 3 démarches au lieu de 6 (seules celles qui ont un lien sont rendues, I30), sans sous-titre (donnée absente), sans phrase d'introduction. | Conforme, une colonne. |
| Carte mairie | Conforme (filet d'accent, ombre, téléphone en grand). « Horaires : » en une ligne grise au lieu de « Ouverte aujourd'hui » + horaires ; le courriel remplace « Écrire à la mairie ». | Conforme, placée avant les démarches. |
| Texte libre | Absent de la maquette : deux paragraphes et deux boutons en pilule entre les démarches et la bande. | idem |
| Actualités | Conforme : bande pâle au bord arrondi, une avec aplat d'accent décalé et carte blanche qui chevauche, trois brèves à vignette. La photo de la une est recadrée (taille `card` 800×1000, portrait) : on voit moins large que la maquette. | Conforme. |
| Agenda | Conforme : fond profond, grands jours en accent, filet clair. Le lieu est préfixé « Lieu : » (texte commun). | Conforme, deux colonnes. |
| Mosaïque | Conforme : grande, haute, deux simples, libellé blanc sur dégradé, tuile sans photo illustrée. Titre « Vivre à Saint-Exupéry-les-Bains » (clé commune) au lieu de « Vivre au village ». | Conforme ; libellés réduits (1,1 rem) pour ne plus être coupés — la maquette coupait « Associations ». |
| Pied de page | Frise au trait d'accent sur blanc, puis fond profond : conforme. Colonnes « nom / Contact / Informations » au lieu de « mairie / tableau des horaires / informations ». | Conforme, une colonne. |
| Commune de démonstration telle quelle (`village-*.png`) | Pas de frise : le héros finit sur un fondu vers le blanc, qui grise le bas de la scène — c'est le cas « frise vide » de la spec, pas le rendu de référence. Une seule brève (2 actualités), 2 événements sur deux colonnes larges. | idem |

Non résorbé, à dire : l'en-tête (blason, bouton, menu mobile), l'accroche du
héros, le cadrage des photos (tâche 6), la silhouette exacte de la frise
(avances fixes du moteur). L'indicateur « N » du serveur de développement est
visible à gauche sur `village-1440.png` (capture de la suite de conformité ;
il est masqué dans les quatre autres).

## Vérifications finales (05/10, 18h44–18h46, sur l'état commité `e140b0b`)

```
$ npm run typecheck
> tsc --noEmit
(sans sortie, code 0)

$ npm run lint
✖ 40 problems (0 errors, 40 warnings)

$ npm run test:unit
 Test Files  29 passed (29)
      Tests  223 passed (223)

$ npm run test:int        (vert au premier passage)
 Test Files  23 passed (23)
      Tests  217 passed (217)

$ npm run test:e2e
  40 passed (1.3m)
```

Avant cela, un passage complet a donné `39 passed, 1 failed`
(`couleurs.e2e.spec.ts:51`, `rgb(14, 34, 42)` au lieu de `rgb(38, 70, 83)`) :
c'est la sonde du titre d'en-tête, décrite plus haut.

## TDD : ce qui a été vu échouer, ce qui ne l'a pas été

Vus échouer avant le code : `aiguiller` (gabarits, pictos), `jourEtMois`,
`idRelation`, « chaque police de theme.css est déclarée » (`gabarits-fichiers`).
**Écrits après le code** : `lignesFrise` (extraction d'un code existant) et
`tests/unit/gabarits-sections.spec.ts` (balisage des sections : visuels,
variantes, date, bouton) — ils passent, je ne les ai pas vus rouges.

## Ce que je n'ai pas pu vérifier

- **Build de production sur le HEAD final** : `npm run build` n'a été lancé
  qu'une fois, pendant l'essai de la décision 19 (routes et layout déjà en
  place, thème minimal). Ni `next start`, ni le rendu servi en production,
  ni I27 sans filtre (tâche 10).
- **Rendu hors Chromium** : `main:has(…)`, `color-mix()` et `clip-path` ne
  sont vus que dans le Chromium de Playwright.
- **Pages intérieures** : le thème s'y applique (police, en-tête, pied) ;
  elles passent leurs tests mais je n'en ai regardé aucune capture.
- **Largeurs intermédiaires** (861–1100 px) : une règle existe (carte mairie
  à 21 rem, démarches sur une colonne), non capturée.
- **Contrastes sur photo** : texte blanc sur le héros et les tuiles à photo —
  la suite mesure le fond opaque sous l'image (`--profond`), pas l'image.
- **Second gabarit** : « une commune ne reçoit pas la feuille d'un autre
  gabarit » est vrai par construction (une seule adresse liée), non éprouvé
  tant que Littoral n'existe pas.
- **Bruit de formatage** : un hook reformate les fichiers édités ;
  `src/lib/contenu.ts`, `src/lib/adresses.ts`, `Accueil.tsx`, `types.ts`,
  `Mosaique.tsx`, `Demarches.tsx` portent dans leurs commits des retours à la
  ligne sans rapport avec le changement. Les 28 fichiers hors périmètre que le
  hook avait touchés ont été comparés à `prettier(HEAD)` (identiques) puis
  restaurés.
