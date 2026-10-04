# Multilingue — partie 1 : le socle (design)

Date : 2026-09-22 · Statut : validé section par section en séance, à relire

## Contexte et décisions

pdlm doit servir des sites communaux en langue régionale, **le corse d'abord**, sans rien coder en dur qui empêcherait d'ajouter le breton, le basque, l'occitan ou une autre langue ensuite.

Décisions prises avec l'utilisateur :

- **Modèle hybride.** L'interface (menus, rubriques, pied de page, liens d'accès) est toujours traduite. Les contenus sont traduits au cas par cas. Un contenu non traduit s'affiche en français, marqué comme tel.
- **Traduction automatique en v1, sur le modèle Elgarweb** : le rédacteur la lance dans l'admin, côté serveur, et le résultat est enregistré puis relu par un humain. Le visiteur ne déclenche jamais de traduction. Elle fait l'objet de la **partie 2**, conçue quand la recherche sur les outils de traduction du corse sera rentrée (`docs/recherche/2026-09-22_recherche-multilingue-corse.md`). Les deux parties sortent dans la même version.
- **Adresses : une règle unique.** Chaque domaine a une langue principale, servie à sa racine. Les autres langues sont servies sous un préfixe (`/co/`, `/fr/`).
- **Approche : la localisation native de Payload** (`localization` + `localized: true`), et non des documents dupliqués par langue.

Hors périmètre de cette partie : la traduction automatique (partie 2), les slugs et segments d'URL traduits, les textes d'interface adaptés par commune, la détection des traductions devenues obsolètes.

## 1. Les langues et leur activation

**Liste des langues** : `src/lib/langues.ts`, seule source de vérité. Elle est lue par la configuration Payload (`localization.locales`), le proxy, le routage, le sélecteur de langue et les tests.

```ts
{ code: 'co', nom: 'Corse', nomNatif: 'Corsu', dates?: { mois, jours, format } }
```

- `code` est une étiquette BCP 47 (`co`, `br`, `eu`, `oc`…), ce qui permettra plus tard des variantes de dialecte enregistrées (`oc-gascon`).
- `dates` est facultatif. Il n'est à renseigner que si `Intl` ne connaît pas la langue (voir § 4).
- **Ajouter une langue** demande une ligne dans cette liste, un dictionnaire d'interface (§ 4) et une migration de base.

**Le français est toujours actif et fait foi.** C'est la langue par défaut de Payload (`defaultLocale: 'fr'`) et la langue de repli. C'est aussi une obligation légale : une version en langue régionale est permise comme traduction, mais le français doit toujours exister, et les actes comme l'affichage légal restent en français (loi Molac art. 8, Conseil constitutionnel 2021-818 DC, CAA Toulouse 12/12/2024, Conseil d'État 5 juin 2025 ; sources dans `docs/recherche/2026-09-22_recherche-multilingue-corse.md`).

**Communes** : nouveau champ `langues` (« Langues du site »), à choix multiples parmi les langues de la liste, français exclu puisqu'il est toujours actif.

**Domaines** : nouveau champ `langue` (« Langue servie à la racine »), `fr` par défaut. La validation refuse une langue que la commune n'a pas activée. Les sous-domaines de la plateforme servent toujours le français à la racine.

## 2. Le contenu traduisible

### État de traduction

Chaque collection concernée reçoit un champ localisé `traduction` qui peut valoir `non-traduite` (défaut), `a-relire` ou `validee`. Il n'a de sens que hors français : dans l'admin, il n'est affiché que lorsqu'on édite une autre langue.

**Ce champ décide seul de l'affichage public d'une langue.** On n'utilise pas l'option expérimentale `experimental.localizeStatus` de Payload, qui exige des brouillons alors que seules Pages et Actualités en ont. La partie 2 écrira ses résultats en `a-relire`, invisibles au public jusqu'à la validation humaine, y compris pour les collections sans brouillon.

Attention au repli de Payload : lu sans précaution, `traduction` en `co` pourrait renvoyer la valeur française. La lecture de l'état se fait donc sans repli (`fallbackLocale: false`), et une valeur absente vaut `non-traduite`.

### Champs traduits

| Collection | Champs localisés                                                                            | Communs aux langues                                       |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Pages      | `titre`, `blocs` (le champ entier), `metaTitle`, `metaDescription`                          | `slug`, commune                                           |
| Actualités | `titre`, `resume`, `contenu`                                                                | `slug`, `image`, `datePublication`, `auteur`              |
| Événements | `titre`, `lieu`, `description` (et les textes du groupe `inscription`, à confirmer au plan) | dates, `lien`, `actif`                                    |
| Documents  | `titre`                                                                                     | fichier (les actes restent en français), catégorie, dates |
| Alertes    | `message`                                                                                   | `niveau`, dates                                           |
| Menus      | `label` (éléments et sous-éléments)                                                         | `page`, `url`                                             |
| Médias     | `alt`                                                                                       | fichier, tailles                                          |
| Communes   | `nom`, `horaires`                                                                           | le reste                                                  |

Les légendes des blocs Image et Galerie sont traduites avec le champ `blocs`.

**`blocs` est localisé comme un champ entier**, pas bloc par bloc. La version corse est une copie complète et cohérente, qui peut s'éloigner de la française. Localiser les champs à l'intérieur des blocs ferait apparaître en version corse, sans le signaler, tout bloc ajouté en français (RGAA 8.7). Même logique pour les champs `richText`.

### Règles d'affichage en langue L (autre que le français)

1. **Page ou fiche** : si `traduction` en L vaut `validee`, tout le document s'affiche en L. Sinon, il s'affiche **entièrement** en français, dans un conteneur `lang="fr"`, précédé d'une mention écrite en L (`lang="L"`) qui l'annonce. Une page n'est jamais à moitié traduite.
2. **Listes** (actualités, agenda, documents) : tous les éléments apparaissent. Un élément non validé en L garde son titre français, marqué `lang="fr"`.
3. **Petits textes** (libellé de menu, `alt`, nom de la commune) : s'ils ne sont pas traduits, le repli sur le français est admis, avec `lang="fr"` sur l'élément concerné.

**Limite connue** : sur Pages et Actualités, le statut de publication est commun à toutes les langues. Publier la traduction corse publie donc aussi un brouillon français en cours, s'il y en a un. C'est acceptable pour une petite mairie où une seule personne fait les deux. On réévaluera `localizeStatus` quand Payload l'aura stabilisé.

## 3. Adresses, routage et référencement

### Routes

Les pages publiques passent sous `app/(frontend)/[lang]/...` (guide Next 16 : `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`). `sitemap.xml` et `robots.txt` restent hors de `[lang]`, un fichier par domaine. `<html lang>` est posé par le layout de `[lang]`, ce qui remplace le `lang="fr"` en dur de `src/app/(frontend)/layout.tsx`.

### Aiguillage en deux temps

1. **`src/proxy.ts`** reste sans accès à la base. Si le premier segment du chemin est un code de la liste de langues, la requête passe telle quelle. Sinon, le chemin est réécrit en interne (`NextResponse.rewrite`) vers une valeur sentinelle de `[lang]` qui signifie « langue principale du domaine ». Le visiteur ne voit pas cette réécriture. La logique est une fonction pure, testable, comme `estDomainePlateforme`.
2. **Le layout de `[lang]`** résout la commune et le domaine (`resolveCommune`, étendu pour renvoyer aussi la langue du domaine), puis :
   - valeur sentinelle : on prend la langue principale du domaine ;
   - préfixe d'une langue non activée pour la commune : `notFound()` ;
   - préfixe égal à la langue principale du domaine (`pigna.corsica/co/x`) : redirection 308 vers l'adresse sans préfixe.

Les liens internes passent tous par un utilitaire unique, qui n'ajoute le préfixe que si la langue diffère de la langue principale du domaine.

### Adresse canonique d'une page en langue L

- S'il existe un domaine canonique de la commune dont la langue principale est L : ce domaine, sans préfixe.
- Sinon : la base canonique française actuelle (`baseUrlCommune` dans `src/lib/contenu.ts`) suivie de `/L`.

Exemples : `pigna.fr/co/marche` a pour canonique `pigna.corsica/marche`, et `pigna.corsica/fr/marche` a pour canonique `pigna.fr/marche`.

### `hreflang` et sitemap

Chaque page annonce son adresse canonique dans chaque langue où elle est disponible, plus une version `x-default` en français. Une langue n'est annoncée que si la traduction y est `validee` : on ne désigne pas comme « corse » une page qui s'affiche en français.

Le `sitemap.xml` d'un domaine liste les adresses dont le canonique est sur ce domaine, avec leurs versions dans les autres langues (`xhtml:link`).

### Pas de négociation automatique

On ne redirige pas selon `Accept-Language`. C'est le domaine qui fixe la langue d'arrivée, et le visiteur choisit ensuite.

### Limite de la v1

Les slugs et les segments d'URL restent en français (`pigna.corsica/actualites/marche-de-noel`).

## 4. Interface publique

**Dictionnaires d'interface** : `src/i18n/fr.ts` (référence) et `src/i18n/co.ts`. Ils couvrent tous les textes fixes : lien d'évitement, rubriques, « Lire la suite », `aria-label`, titre et description par défaut de `generateMetadata`, mention « non traduit », sélecteur de langue. Le typage impose que chaque langue fournisse **toutes** les clés du français : une langue incomplète ne compile pas, et un test le vérifie aussi.

**Dates** : `formaterDate(date, langue)` (`src/lib/dates.ts`) utilise `Intl` quand la langue est reconnue (`Intl.DateTimeFormat.supportedLocalesOf`), et sinon les noms de mois et de jours de la liste des langues. Constat du 2026-09-22 : `co` n'est pas reconnu, et `Intl` retombe **en silence** sur la locale du système, c'est-à-dire le français sur le poste de développement (Node 23) mais l'**anglais** dans l'image de production `node:22.17.0-alpine` (« Tuesday, September 22, 2026 », vérifié par exécution). Un test doit donc porter sur la sortie attendue, pas sur l'absence d'erreur. `br`, `eu`, `oc` et `ca` sont reconnus. Pour `gsw` (alsacien), les données sont celles du suisse allemand.

**Sélecteur de langue** : il est dans l'en-tête et n'apparaît que si la commune a au moins deux langues. C'est un `<nav aria-label>` contenant une liste de liens simples, sans JavaScript ni menu déroulant. Chaque lien porte le nom natif de la langue, les attributs `lang` et `hreflang`, `aria-current` pour la langue affichée, et mène vers la même page dans l'autre langue.

**Aucun JavaScript client ajouté** : tout est rendu côté serveur.

## 5. Admin

- `localization.filterAvailableLocales` renvoie le français et les langues activées pour la commune sélectionnée, lue depuis le tenant du plugin multi-tenant. Un opérateur voit toutes les langues.
- L'interface de l'admin reste en français (`i18n.supportedLanguages: { fr }` ne change pas). On choisit la langue du _contenu_ avec le sélecteur de langue natif de Payload.
- Le Journal existant enregistre déjà chaque modification avec un instantané. Les changements d'état de traduction y apparaissent sans travail supplémentaire.

## 6. Migration des données

**C'est le point le plus risqué.** Quand on localise un champ, Payload sur Postgres déplace sa colonne vers une table `*_locales`. La migration générée crée cette table et supprime l'ancienne colonne **sans recopier les données**.

La migration est donc complétée à la main : elle recopie chaque valeur existante dans `*_locales` avec `_locale = 'fr'` **avant** toute suppression de colonne. Même traitement pour les tables de blocs et de tableaux concernées (blocs des Pages, éléments des Menus).

Recette obligatoire, sur le modèle de la recette sauvegarde et restauration de v0.1.0 :

1. une copie de la base v0.1.1 avec le contenu de démonstration ;
2. la migration ;
3. la comparaison champ par champ avant et après ;
4. un test de retour arrière depuis la sauvegarde.

Aucune donnée n'est à migrer pour les nouveaux champs : `langues` est vide et `langue` vaut `fr`.

## 7. Nouveaux invariants et cas d'erreur

- **I14** : une langue non activée pour la commune donne une 404 (jamais une 500), et n'est ni annoncée en `hreflang` ni listée dans le sitemap.
- **I15** : on ne peut pas désactiver une langue qu'un domaine de la commune sert à sa racine. L'erreur explique qu'il faut d'abord changer ce domaine.
- **I16** : les codes de la liste de langues sont des slugs réservés, et la vérification s'ajoute à `uniqueSlugParCommune`.
- **I6 élargi** : au plus un domaine canonique par commune **et par langue principale**. Le canonique français reste requis pour activer une commune.
- **I17** : une langue autre que le français n'est affichée pour un document que si sa traduction y est `validee` (§ 2).

## 8. Tests (TDD)

- **Tests unitaires** sur des fonctions pures : lecture du préfixe dans le proxy, choix de la langue dans le layout, calcul de l'adresse canonique, liste `hreflang`, `formaterDate` pour `co` (y compris la détection du repli silencieux d'`Intl`), slugs réservés, complétude des dictionnaires.
- **Tests d'intégration** (base réelle) : règles d'affichage du § 2 ; validations des Domaines (langue non activée, canonique par langue) et des Communes (I15) ; migration sans perte (§ 6).
- **Tests de bout en bout** (Playwright) : `pigna.localhost/co/...` ; sélecteur de langue ; attributs `lang` de la page, de la mention et du contenu en repli (une page non traduite sous `/co/` a `<html lang="co">` et son contenu dans un conteneur `lang="fr"` : c'est l'inverse de l'anti-modèle observé à Vannes, qui sert des pages françaises sous `/br/` en les déclarant bretonnes) ; 404 (I14) et redirection 308.
- **Données de démonstration** : une commune avec le corse activé, une page traduite et validée, une page non traduite, un libellé de menu non traduit.

## 9. Critère de fin

Une commune active le corse, traduit une page et la valide. La page est alors servie en corse sur `/co/` et sur son domaine `.corsica`, avec `lang` et `hreflang` corrects. Une page non traduite s'affiche en français, correctement marquée. Aucun JavaScript client n'est ajouté, la migration s'est faite sans perte, et toute la suite de tests existante passe.

## 10. Points ouverts

1. **Relecture des textes corses** : le dictionnaire `co.ts` (quelques dizaines de textes) et les noms de mois et de jours doivent être relus par un locuteur. Qui ?
2. **Tester un domaine propre en local et en CI** : `*.localhost` est traité comme un sous-domaine de la plateforme par `candidatCommune`. Il faut un moyen de servir `pigna.corsica` dans les tests de bout en bout (Caddy de développement, résolution DNS de test, ou autre) : à trancher dans le plan.
3. ✅ **Cadre légal** : confirmé par la recherche du 2026-09-22 (voir § 1). Aucune jurisprudence propre aux sites web bilingues de collectivités n'a été trouvée.
4. **Groupe `inscription` des Événements** : quels sous-champs traduire ? À régler dans le plan, après lecture du champ.
5. **Partie 2** : ce socle expose ce dont la traduction automatique a besoin : lire le document en `fr`, écrire en L, positionner `traduction = a-relire`. L'interface commune des services de traduction, le traitement du texte riche Lexical et le choix du service pour le corse relèvent de la partie 2.
