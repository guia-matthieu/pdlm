# Multilingue — socle (partie 1) : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir un site communal en corse (et demain en breton, basque, occitan…) à côté du français : interface toujours traduite, contenus traduits au cas par cas, repli en français correctement marqué, adresses `/co/…` ou domaine propre, `hreflang` et sitemap justes, sans aucun JavaScript client ajouté.

**Architecture:** Localisation native de Payload (`localization` + `localized: true`), une seule liste de langues (`src/lib/langues.ts`). Le proxy, sans base, réécrit tout chemin sans préfixe de langue vers une valeur sentinelle de `[lang]` ; le layout de `app/(frontend)/[lang]` résout la commune, la langue du domaine, et décide : afficher, 404 ou 308. Toute la logique d'adresses est faite de fonctions pures (`src/lib/adresses.ts`), les lectures par langue sont centralisées dans `src/lib/contenu.ts` (I4).

**Tech Stack:** Next 16.3.3 (App Router, `proxy.ts`), Payload 3.90.1 + `@payloadcms/db-postgres` (Postgres 17), plugin multi-tenant, Vitest 4 (unit + int sur base réelle), Playwright (Chromium).

**Spec:** `docs/superpowers/specs/2026-09-22-multilingue-socle-design.md` (validée par l'utilisateur le 23/09).

## Global Constraints

- Le français est toujours actif et fait foi : `defaultLocale: 'fr'`, langue de repli, jamais désactivable (spec § 1).
- Une langue = une ligne dans `src/lib/langues.ts` + un dictionnaire `src/i18n/<code>.ts` + une migration. Rien d'autre ne doit coder une langue en dur.
- Codes de langue : étiquettes BCP 47 (`co`, `br`, `eu`, `oc`…).
- **Aucun JavaScript client ajouté** sur le front public : tout est rendu côté serveur.
- Pas de négociation `Accept-Language` : le domaine fixe la langue d'arrivée.
- Slugs et segments d'URL restent en français.
- L'admin reste en français (`i18n.supportedLanguages: { fr }` inchangé).
- `lang` exact partout : `<html lang>` = langue affichée ; tout contenu de repli dans un conteneur `lang="fr"` ; mention « non traduit » en `lang="L"`.
- Tests : `test:int` sur `pdlm_test`, e2e sur `pdlm_e2e` (`DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e`), **jamais `pdlm`** (base de dev de l'utilisateur).
- `src/payload-types.ts` : committer la **sortie brute** de `npm run generate:types` (jamais passée à Prettier). Ne jamais réécrire un `.json` de migration à la main ni avec l'outil Write (un hook le reformate).
- Messages d'erreur de validation montrés à l'agent : `ValidationError` de Payload (un `Error` simple est masqué en production).
- Textes d'interface en français « FALC-compatible » : phrases courtes, pas de jargon.
- Tout texte corse de ce plan est **provisoire, à relire par un locuteur** (spec § 10, point 1) : le signaler en commentaire en tête de `src/i18n/co.ts` et dans `src/lib/langues.ts`.

## Écarts à la spec, constatés en lisant le code (à valider par l'utilisateur avec le plan)

1. **Champs obligatoires localisés** : dans `@payloadcms/drizzle` (`schema/traverseFields.js`, l. 796), un champ `required: true` devient une colonne `NOT NULL` de la table `*_locales`. Garder `required` rendrait impossible la traduction partielle des petits textes (libellés de menu, `alt`, nom de commune) voulue par la spec (règle 3). → Les champs localisés perdent `required: true` et reçoivent `validate: requisEnFrancais` (obligatoire en français seulement) ; pour les collections qui ont un état de traduction, un hook refuse `validee` si un champ obligatoire manque dans la langue (I17 renforcé). Effet visible : l'astérisque « obligatoire » disparaît de ces champs dans l'admin ; la description le remplace.
2. **Tables de versions** : Pages et Actualités ont des brouillons, donc des tables `_pages_v*` et `_actualites_v`. La migration doit les traiter comme les tables principales (la spec ne cite que les tables de blocs et de tableaux).
3. **Aucun index unique « un canonique par commune »** n'existe en base : le commentaire de `Domaines.ts` cite une migration J4 qui ne l'a jamais créé. La migration ajoute l'index partiel `(commune_id, langue) WHERE canonique`, qui porte I6 élargi.
4. **`baseUrlCommune`** (spec § 3) s'appelle en réalité `baseUrlsPubliques` (`src/lib/contenu.ts`).
5. **Le layout ne connaît pas le chemin demandé** (Next ne le passe pas aux layouts). → Le proxy pose un en-tête `x-pdlm-chemin` (chemin + requête d'origine), écrasé à chaque requête comme `x-commune-host` (I7).
6. **Navigation en `<a>` au lieu de `next/link`** sur le front public : un layout n'est pas re-rendu lors d'une navigation client, donc le sélecteur de langue garderait les liens de la page précédente. Des liens simples rechargent la page, ce qui va dans le sens « sans JavaScript ».
7. **Mesure d'audience** : les routes `/mesure/api/send`, `/mesure/script.js`, `/mesure/opposition` restent hors de `[lang]` et ne sont jamais réécrites. La page `/mesure-d-audience` passe sous `[lang]` ; son texte (information RGPD) reste en français, présenté comme un contenu non traduit (mention en L, conteneur `lang="fr"`). Le formulaire d'opposition renvoie vers la page dans la bonne langue (champ caché `retour`, liste blanche).
8. **Point ouvert 4 réglé** : le groupe `inscription` des Événements ne contient que `actif` (case) et `lien` (URL) — aucun texte à traduire.
9. **Point ouvert 2 réglé** : en e2e, Chromium reçoit `--host-resolver-rules=MAP valvert.corsica 127.0.0.1` ; même mécanisme en local et en CI, sans DNS ni Caddy.
10. **Test de migration** : pas en Vitest (les bases de test sont en mode *push*, jamais migrées), mais par un script rejouable, `scripts/verifier-migration-multilingue.sh`, qui monte une base jetable depuis les migrations de `main`, y sème la démo, migre, compare, redescend et recompare. La recette sur pile de type production (tâche 11) reste obligatoire.

## Review Focus

- `/co` sans barre finale, et `/co/`, doivent servir l'accueil corse, pas une 404 (test : tâche 2, `aiguiller` et `choisirLangue` ; e2e tâche 10).
- La redirection 308 d'un préfixe égal à la langue du domaine garde la chaîne de requête : `valvert.corsica/co/actualites?page=2` → `/actualites?page=2` (test : tâche 2 `choisirLangue` ; e2e tâche 10).
- Un en-tête `x-pdlm-chemin` forgé par le client est écrasé par le proxy (test : tâche 2, `proxy.spec.ts`).
- Un lien de menu saisi `/actualites` devient `/co/actualites` sous `/co/`, mais `https://…`, `mailto:`, `tel:` et `//hôte` restent intacts (test : tâche 2, `cheminLangue`).
- Une commune qui retire le corse alors que des pages y sont `validee` : `/co/…` en 404, plus de `hreflang` ni d'entrée de sitemap en `co` (test : tâche 6, `languesDisponibles` ; tâche 2, `choisirLangue`).

---

## Préalable (fait le 25/09 par le pilote)

Worktree `~/Projects/glm.multilingue`, branche `multilingue-socle` rebasée sur `main` (`ba1b1ba`, mesure d'audience fusionnée), `npm ci` fait, `.env` copié depuis `~/Projects/glm`. Tout se fait dans ce worktree. Avant chaque suite de tests : Docker répond (`docker info`) et `pdlm-postgres-1` tourne.

---

### Task 1: Liste des langues, dictionnaires d'interface, dates

**Files:**
- Create: `src/lib/langues.ts`
- Create: `src/i18n/fr.ts`, `src/i18n/co.ts`, `src/i18n/index.ts`
- Modify: `src/lib/dates.ts:37-42` (`formaterDate`)
- Modify (appelants de `formaterDate`, 2ᵉ argument `'fr'` pour l'instant) : `src/app/(frontend)/actualites/page.tsx:39`, `src/app/(frontend)/actualites/[slug]/page.tsx:45`, `src/app/(frontend)/agenda/page.tsx:29,33`, `src/app/(frontend)/documents/page.tsx:60`
- Test: `tests/unit/langues.spec.ts`, `tests/unit/dates.spec.ts`, `tests/unit/dictionnaires.spec.ts`

**Interfaces:**
- Produces:
  - `type CodeLangue = 'fr' | 'co'` ; `FRANCAIS: 'fr'` ; `LANGUES: readonly Langue[]` ; `LANGUES_REGIONALES` ; `CODES_LANGUES: readonly CodeLangue[]`
  - `estCodeLangue(v: unknown): v is CodeLangue` ; `langueDe(code: CodeLangue): Langue`
  - `formaterDate(date: string | Date, langue: CodeLangue, options?: Intl.DateTimeFormatOptions): string`
  - `type Dictionnaire = typeof fr` ; `dictionnaire(langue: CodeLangue): Dictionnaire`

- [ ] **Step 1: Write the failing tests**

`tests/unit/langues.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { CODES_LANGUES, LANGUES, LANGUES_REGIONALES, estCodeLangue, langueDe } from '@/lib/langues'

describe('liste des langues', () => {
  it('commence par le français, toujours présent', () => {
    expect(LANGUES[0].code).toBe('fr')
    expect(CODES_LANGUES).toContain('fr')
    expect(LANGUES_REGIONALES.map((l) => l.code)).not.toContain('fr')
  })

  it('contient le corse avec son nom natif', () => {
    expect(langueDe('co')).toMatchObject({ code: 'co', nom: 'Corse', nomNatif: 'Corsu' })
  })

  it('a des codes uniques, en BCP 47 simple', () => {
    expect(new Set(CODES_LANGUES).size).toBe(CODES_LANGUES.length)
    for (const code of CODES_LANGUES) expect(code).toMatch(/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/)
  })

  it('reconnaît un code et refuse le reste', () => {
    expect(estCodeLangue('co')).toBe(true)
    expect(estCodeLangue('CO')).toBe(false)
    expect(estCodeLangue('racine')).toBe(false)
    expect(estCodeLangue(undefined)).toBe(false)
  })

  it('donne des noms de dates complets à toute langue inconnue d’Intl', () => {
    for (const l of LANGUES) {
      if (Intl.DateTimeFormat.supportedLocalesOf([l.code]).length > 0) continue
      expect(l.dates, `${l.code} : Intl ne la connaît pas, dates obligatoires`).toBeDefined()
      expect(l.dates?.mois).toHaveLength(12)
      expect(l.dates?.jours).toHaveLength(7)
    }
  })
})
```

`tests/unit/dates.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { formaterDate } from '@/lib/dates'

// 10:00 UTC = 12:00 à Paris (heure d'été) ; un mardi.
const DATE = '2026-09-22T10:00:00.000Z'

describe('formaterDate', () => {
  it('formate en français via Intl', () => {
    expect(formaterDate(DATE, 'fr', { dateStyle: 'long' })).toBe('22 septembre 2026')
    expect(formaterDate(DATE, 'fr', { dateStyle: 'full', timeStyle: 'short' })).toBe(
      'mardi 22 septembre 2026 à 12:00',
    )
  })

  it('constate qu’Intl ne connaît pas le corse (sinon revoir le repli)', () => {
    // Si ce test casse, Node a gagné des données corses : vérifier leur sortie
    // avant de supprimer les noms de langues.ts.
    expect(Intl.DateTimeFormat.supportedLocalesOf(['co'])).toEqual([])
  })

  it('formate en corse avec les noms de la liste, pas la locale du système', () => {
    expect(formaterDate(DATE, 'co', { dateStyle: 'long' })).toBe('22 settembre 2026')
    expect(formaterDate(DATE, 'co', { dateStyle: 'full' })).toBe('marti 22 settembre 2026')
    expect(formaterDate(DATE, 'co', { dateStyle: 'full', timeStyle: 'short' })).toBe(
      'marti 22 settembre 2026, à 12:00',
    )
  })

  it('applique le fuseau de Paris en corse aussi (jour qui change à minuit)', () => {
    // 22:30 UTC le 22 = 00:30 le 23 à Paris
    expect(formaterDate('2026-09-22T22:30:00.000Z', 'co', { dateStyle: 'long' })).toBe(
      '23 settembre 2026',
    )
  })
})
```

`tests/unit/dictionnaires.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { CODES_LANGUES } from '@/lib/langues'
import { dictionnaire } from '@/i18n'

/** Clés à plat, sous-objets compris (ex. « categories.budget »). */
function cles(objet: object, prefixe = ''): string[] {
  return Object.entries(objet).flatMap(([cle, valeur]) =>
    valeur !== null && typeof valeur === 'object'
      ? cles(valeur, `${prefixe}${cle}.`)
      : [`${prefixe}${cle}`],
  )
}

describe('dictionnaires d’interface', () => {
  const fr = dictionnaire('fr')

  it.each(CODES_LANGUES)('%s fournit toutes les clés du français, et aucune autre', (code) => {
    expect(cles(dictionnaire(code)).sort()).toEqual(cles(fr).sort())
  })

  it.each(CODES_LANGUES)('%s n’a aucun texte vide', (code) => {
    const d = dictionnaire(code) as unknown as Record<string, unknown>
    for (const cle of cles(d)) {
      const valeur = cle.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], d)
      const texte = typeof valeur === 'function' ? (valeur as (...a: string[]) => string)('X', 'Y') : valeur
      expect(String(texte).trim(), `${code}.${cle}`).not.toBe('')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/langues.spec.ts tests/unit/dates.spec.ts tests/unit/dictionnaires.spec.ts`
Expected: FAIL — modules `@/lib/langues` et `@/i18n` introuvables.

- [ ] **Step 3: Write `src/lib/langues.ts`**

```ts
/**
 * Liste des langues : SEULE source de vérité (spec multilingue § 1). Lue par la
 * configuration Payload, le proxy, le routage, le sélecteur de langue et les
 * tests. Ajouter une langue = une ligne ici + un dictionnaire `src/i18n/<code>.ts`
 * + une migration de base.
 *
 * Textes corses PROVISOIRES, à relire par un locuteur (spec § 10, point 1).
 */

/** Noms de dates pour une langue qu'Intl ne connaît pas (constat du 22/09 : `co`). */
export interface NomsDates {
  /** Janvier → décembre. */
  mois: readonly string[]
  /** Dimanche → samedi (ordre de `Date.getUTCDay()`). */
  jours: readonly string[]
  /** Gabarits : {j} jour du mois, {mois}, {a} année, {jour} jour de la semaine, {date}, {h}, {min}. */
  format: { long: string; complet: string; heure: string }
}

export interface Langue {
  code: string
  nom: string
  nomNatif: string
  dates?: NomsDates
}

export const LANGUES = [
  { code: 'fr', nom: 'Français', nomNatif: 'Français' },
  {
    code: 'co',
    nom: 'Corse',
    nomNatif: 'Corsu',
    dates: {
      mois: [
        'ghjennaghju',
        'ferraghju',
        'marzu',
        'aprile',
        'maghju',
        'ghjugnu',
        'lugliu',
        'aostu',
        'settembre',
        'ottobre',
        'nuvembre',
        'dicembre',
      ],
      jours: ['dumenica', 'luni', 'marti', 'mercuri', 'ghjovi', 'venneri', 'sabbatu'],
      format: { long: '{j} {mois} {a}', complet: '{jour} {j} {mois} {a}', heure: '{date}, à {h}:{min}' },
    },
  },
] as const satisfies readonly Langue[]

export type CodeLangue = (typeof LANGUES)[number]['code']

export const FRANCAIS = 'fr' satisfies CodeLangue

export const CODES_LANGUES: readonly CodeLangue[] = LANGUES.map((l) => l.code)

export const LANGUES_REGIONALES: readonly Langue[] = LANGUES.filter((l) => l.code !== FRANCAIS)

export function estCodeLangue(valeur: unknown): valeur is CodeLangue {
  return typeof valeur === 'string' && (CODES_LANGUES as readonly string[]).includes(valeur)
}

export function langueDe(code: CodeLangue): Langue {
  const langue = LANGUES.find((l) => l.code === code)
  if (!langue) throw new Error(`Langue inconnue : « ${code} »`)
  return langue
}
```

- [ ] **Step 4: Write the dictionaries**

`src/i18n/fr.ts` :

```ts
/**
 * Dictionnaire d'interface de référence. Toute autre langue doit fournir
 * exactement ces clés (le typage l'impose, tests/unit/dictionnaires.spec.ts
 * le vérifie aussi).
 */
export const fr = {
  evitement: 'Aller au contenu',
  menuPrincipal: 'Menu principal',
  selecteurLangue: 'Langue du site',
  accueil: 'Accueil',
  actualites: 'Actualités',
  agenda: 'Agenda',
  documents: 'Documents',
  descriptionSite: (nom: string) =>
    `Site officiel de la commune de ${nom} : actualités, agenda et démarches.`,
  bienvenue: (nom: string) => `Bienvenue à ${nom}`,
  enConstruction: 'Le site est en cours de construction. Revenez bientôt !',
  consulter: 'Vous pouvez consulter :',
  aucuneActualite: 'Aucune actualité pour le moment.',
  pagination: 'Pagination',
  precedent: 'Précédent',
  suivant: 'Suivant',
  pageSur: (numero: string, total: string) => `Page ${numero} / ${total}`,
  aucunEvenement: 'Aucun événement à venir.',
  lieu: (lieu: string) => `Lieu : ${lieu}`,
  sInscrire: 'S’inscrire',
  filtrerCategorie: 'Filtrer par catégorie',
  toutes: 'Toutes',
  aucunDocument: 'Aucun document dans cette catégorie.',
  conservation: (duree: string) => `conservation : ${duree}`,
  categories: {
    deliberations: 'Délibérations',
    arretes: 'Arrêtés',
    budget: 'Budget',
    urbanisme: 'Urbanisme',
    autres: 'Autres',
  },
  horaires: 'Horaires :',
  contact: 'Contact',
  telephone: 'Téléphone :',
  courriel: 'Courriel :',
  informations: 'Informations',
  mentionsLegales: 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  accessibilite: 'Accessibilité',
  mesureAudience: 'Mesure d’audience',
  propulsePar: 'Site propulsé par',
  logicielLibre: '(logiciel libre).',
  nonTraduit: 'Cette page est présentée en français.',
}

export type Dictionnaire = typeof fr
```

`src/i18n/co.ts` :

```ts
import type { Dictionnaire } from './fr'

/**
 * Corse — TEXTES PROVISOIRES, à relire par un locuteur avant la mise en
 * production (spec multilingue § 10, point 1).
 */
export const co: Dictionnaire = {
  evitement: 'Andà à u cuntenutu',
  menuPrincipal: 'Menu principale',
  selecteurLangue: 'Lingua di u situ',
  accueil: 'Accolta',
  actualites: 'Nutizie',
  agenda: 'Agenda',
  documents: 'Ducumenti',
  descriptionSite: (nom) => `Situ ufficiale di u cumunu di ${nom} : nutizie, agenda è pratiche.`,
  bienvenue: (nom) => `Benvenuti à ${nom}`,
  enConstruction: 'U situ hè in custruzzione. Riturnate prestu !',
  consulter: 'Pudete fighjà :',
  aucuneActualite: 'Nisuna nutizia per avà.',
  pagination: 'Paginazione',
  precedent: 'Precedente',
  suivant: 'Seguente',
  pageSur: (numero, total) => `Pagina ${numero} / ${total}`,
  aucunEvenement: 'Nisun avvenimentu à vene.',
  lieu: (lieu) => `Locu : ${lieu}`,
  sInscrire: 'Scriversi',
  filtrerCategorie: 'Filtrà per categuria',
  toutes: 'Tutte',
  aucunDocument: 'Nisun ducumentu in sta categuria.',
  conservation: (duree) => `cunservazione : ${duree}`,
  categories: {
    deliberations: 'Deliberazioni',
    arretes: 'Decreti',
    budget: 'Bilanciu',
    urbanisme: 'Urbanisimu',
    autres: 'Altri',
  },
  horaires: 'Orarii :',
  contact: 'Cuntattu',
  telephone: 'Telefonu :',
  courriel: 'Messaghju :',
  informations: 'Infurmazioni',
  mentionsLegales: 'Menzioni legali',
  confidentialite: 'Pulitica di cunfidenzialità',
  accessibilite: 'Accessibilità',
  mesureAudience: 'Misura d’audienza',
  propulsePar: 'Situ purtatu da',
  logicielLibre: '(prugrammu liberu).',
  nonTraduit: 'Sta pagina ùn hè ancu tradotta in corsu : eccu a versione in francese.',
}
```

`src/i18n/index.ts` :

```ts
import type { CodeLangue } from '@/lib/langues'

import { co } from './co'
import { fr, type Dictionnaire } from './fr'

export type { Dictionnaire }

/** Un dictionnaire par langue : une langue ajoutée sans le sien ne compile pas. */
const DICTIONNAIRES: Record<CodeLangue, Dictionnaire> = { fr, co }

export function dictionnaire(langue: CodeLangue): Dictionnaire {
  return DICTIONNAIRES[langue]
}
```

- [ ] **Step 5: Rewrite `formaterDate` in `src/lib/dates.ts`**

Remplacer les lignes 37-42 par :

```ts
/**
 * Formatage public dans la langue affichée, fuseau Europe/Paris (D9).
 * Si Intl ne connaît pas la langue, il retombe EN SILENCE sur la locale du
 * système (français sur le poste de dev, anglais dans l'image alpine — constat
 * du 22/09) : on prend alors les noms de `langues.ts`.
 */
export function formaterDate(
  date: string | Date,
  langue: CodeLangue,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'long' },
): string {
  const d = typeof date === 'string' ? new Date(date) : date
  if (Intl.DateTimeFormat.supportedLocalesOf([langue]).length > 0) {
    return new Intl.DateTimeFormat(langue, { timeZone: 'Europe/Paris', ...options }).format(d)
  }
  const noms = langueDe(langue).dates
  if (!noms) {
    throw new Error(`Langue « ${langue} » : inconnue d’Intl et sans noms de dates dans langues.ts.`)
  }
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((part) => [part.type, part.value]),
  )
  const annee = Number(p.year)
  const mois = Number(p.month)
  const jour = Number(p.day)
  const jourSemaine = new Date(Date.UTC(annee, mois - 1, jour)).getUTCDay()
  const remplir = (gabarit: string, valeurs: Record<string, string>) =>
    gabarit.replace(/\{(\w+)\}/g, (_, cle: string) => valeurs[cle] ?? '')
  const valeurs = {
    j: String(jour),
    mois: noms.mois[mois - 1],
    a: String(annee),
    jour: noms.jours[jourSemaine],
    h: p.hour,
    min: p.minute,
  }
  const texteDate = remplir(options.dateStyle === 'full' ? noms.format.complet : noms.format.long, valeurs)
  return options.timeStyle ? remplir(noms.format.heure, { ...valeurs, date: texteDate }) : texteDate
}
```

Ajouter en tête : `import { langueDe, type CodeLangue } from './langues'`.

Puis, dans les 4 fichiers de pages listés, remplacer `formaterDate(x, { … })` par `formaterDate(x, 'fr', { … })` (la tâche 7 passera la vraie langue).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: tous les tests unitaires PASS (les 62 existants + les nouveaux), tsc 0 erreur. Si le test « mardi 22 septembre 2026 à 12:00 » échoue sur le séparateur, recopier la sortie réelle de Node 23 **et** vérifier qu'elle est identique sous `node:22.17.0-alpine` (`docker run --rm node:22.17.0-alpine node -e "…"`) avant de l'inscrire.

- [ ] **Step 7: Commit**

```bash
git add src/lib/langues.ts src/i18n src/lib/dates.ts "src/app/(frontend)" tests/unit/langues.spec.ts tests/unit/dates.spec.ts tests/unit/dictionnaires.spec.ts
git commit -m "Multilingue — liste des langues, dictionnaires d'interface, dates en corse"
```

---

### Task 2: Adresses (fonctions pures) et aiguillage du proxy

**Files:**
- Create: `src/lib/adresses.ts`
- Modify: `src/proxy.ts:56-65`
- Test: `tests/unit/adresses.spec.ts`, `tests/unit/proxy.spec.ts` (ajouts)

**Interfaces:**
- Consumes: `CodeLangue`, `estCodeLangue`, `FRANCAIS` (tâche 1).
- Produces (tous purs, sans base ni `server-only`) :
  - `RACINE = 'racine'` — valeur sentinelle de `[lang]` : « langue principale du domaine ».
  - `aiguiller(pathname: string): string | null` — chemin de réécriture, ou `null` si le chemin passe tel quel.
  - `cheminSansPrefixe(chemin: string): { langue: CodeLangue | null; reste: string }`
  - `cheminLangue(chemin: string, langue: CodeLangue, langueRacine: CodeLangue): string`
  - `type Decision = { type: 'afficher'; langue: CodeLangue } | { type: 'introuvable' } | { type: 'rediriger'; vers: string }`
  - `choisirLangue(args: { param: string; langueRacine: CodeLangue; languesSite: readonly CodeLangue[]; cheminDemande: string }): Decision`
  - `interface DomaineLangue { hostname: string; langue: string; canonique: boolean }`
  - `baseCanonique(langue: CodeLangue, domaines: readonly DomaineLangue[], basePlateforme: string): string`
  - `adresseCanonique(langue: CodeLangue, chemin: string, domaines: readonly DomaineLangue[], basePlateforme: string): string`
  - `adressesAlternatives(args: { chemin: string; langueContenu: CodeLangue; languesDisponibles: readonly CodeLangue[]; domaines: readonly DomaineLangue[]; basePlateforme: string }): { canonical?: string; languages: Record<string, string> }`
  - `interface RessourceSitemap { chemin: string; langues: readonly CodeLangue[]; priorite: string }`
  - `sitemapXml(ressources: readonly RessourceSitemap[], langueRacine: CodeLangue, domaines: readonly DomaineLangue[], basePlateforme: string): string`
  - Proxy : en-tête `x-pdlm-chemin` = `pathname + search` d'origine, toujours écrasé.

- [ ] **Step 1: Write the failing tests — `tests/unit/adresses.spec.ts`**

```ts
import { describe, expect, it } from 'vitest'

import {
  RACINE,
  adresseCanonique,
  adressesAlternatives,
  aiguiller,
  baseCanonique,
  cheminLangue,
  cheminSansPrefixe,
  choisirLangue,
  sitemapXml,
  type DomaineLangue,
} from '@/lib/adresses'

const DOMAINES: DomaineLangue[] = [
  { hostname: 'pigna.fr', langue: 'fr', canonique: true },
  { hostname: 'www.pigna.fr', langue: 'fr', canonique: false },
  { hostname: 'pigna.corsica', langue: 'co', canonique: true },
]
const PLATEFORME = 'https://pigna.plateforme.test'

describe('aiguiller (proxy)', () => {
  it('laisse passer un chemin préfixé par un code de langue', () => {
    expect(aiguiller('/co/marche')).toBeNull()
    expect(aiguiller('/co')).toBeNull()
    expect(aiguiller('/co/')).toBeNull()
    expect(aiguiller('/fr/marche')).toBeNull()
  })

  it('réécrit tout autre chemin vers la sentinelle', () => {
    expect(aiguiller('/')).toBe(`/${RACINE}`)
    expect(aiguiller('/marche')).toBe(`/${RACINE}/marche`)
    expect(aiguiller('/CO/marche')).toBe(`/${RACINE}/CO/marche`)
    expect(aiguiller('/corse')).toBe(`/${RACINE}/corse`)
    // Même un visiteur qui tape la sentinelle ne l'atteint pas directement
    expect(aiguiller(`/${RACINE}/marche`)).toBe(`/${RACINE}/${RACINE}/marche`)
  })

  it('ne touche jamais aux routes hors langue', () => {
    for (const chemin of [
      '/sitemap.xml',
      '/robots.txt',
      '/mesure/api/send',
      '/mesure/script.js',
      '/mesure/opposition',
    ]) {
      expect(aiguiller(chemin), chemin).toBeNull()
    }
  })
})

describe('cheminSansPrefixe', () => {
  it('sépare le préfixe de langue et garde la requête', () => {
    expect(cheminSansPrefixe('/co/actualites?page=2')).toEqual({
      langue: 'co',
      reste: '/actualites?page=2',
    })
    expect(cheminSansPrefixe('/co')).toEqual({ langue: 'co', reste: '/' })
    expect(cheminSansPrefixe('/co/')).toEqual({ langue: 'co', reste: '/' })
    expect(cheminSansPrefixe('/co?x=1')).toEqual({ langue: 'co', reste: '/?x=1' })
    expect(cheminSansPrefixe('/marche')).toEqual({ langue: null, reste: '/marche' })
  })
})

describe('cheminLangue', () => {
  it('n’ajoute le préfixe que si la langue diffère de celle du domaine', () => {
    expect(cheminLangue('/marche', 'fr', 'fr')).toBe('/marche')
    expect(cheminLangue('/marche', 'co', 'fr')).toBe('/co/marche')
    expect(cheminLangue('/', 'co', 'fr')).toBe('/co')
    expect(cheminLangue('/marche', 'fr', 'co')).toBe('/fr/marche')
    expect(cheminLangue('/actualites?page=2', 'co', 'fr')).toBe('/co/actualites?page=2')
  })

  it('laisse intacts les liens externes et les schémas', () => {
    for (const lien of ['https://exemple.fr/x', 'mailto:a@b.fr', 'tel:0102030405', '//hote/x', '#contenu']) {
      expect(cheminLangue(lien, 'co', 'fr'), lien).toBe(lien)
    }
  })
})

describe('choisirLangue (layout)', () => {
  const base = { langueRacine: 'fr' as const, languesSite: ['fr', 'co'] as const }

  it('sentinelle → langue du domaine', () => {
    expect(choisirLangue({ ...base, param: RACINE, cheminDemande: '/marche' })).toEqual({
      type: 'afficher',
      langue: 'fr',
    })
  })

  it('préfixe d’une langue activée → cette langue', () => {
    expect(choisirLangue({ ...base, param: 'co', cheminDemande: '/co/marche' })).toEqual({
      type: 'afficher',
      langue: 'co',
    })
  })

  it('I14 : langue non activée pour la commune → introuvable', () => {
    expect(
      choisirLangue({ ...base, languesSite: ['fr'], param: 'co', cheminDemande: '/co/marche' }),
    ).toEqual({ type: 'introuvable' })
  })

  it('code inconnu → introuvable (jamais une erreur)', () => {
    expect(choisirLangue({ ...base, param: 'xx', cheminDemande: '/xx' })).toEqual({
      type: 'introuvable',
    })
  })

  it('préfixe égal à la langue du domaine → 308 sans préfixe, requête gardée', () => {
    expect(
      choisirLangue({
        langueRacine: 'co',
        languesSite: ['fr', 'co'],
        param: 'co',
        cheminDemande: '/co/actualites?page=2',
      }),
    ).toEqual({ type: 'rediriger', vers: '/actualites?page=2' })
    expect(choisirLangue({ ...base, param: 'fr', cheminDemande: '/fr' })).toEqual({
      type: 'rediriger',
      vers: '/',
    })
  })
})

describe('adresses canoniques', () => {
  it('prend le domaine canonique de la langue quand il existe', () => {
    expect(baseCanonique('co', DOMAINES, PLATEFORME)).toBe('https://pigna.corsica')
    expect(baseCanonique('fr', DOMAINES, PLATEFORME)).toBe('https://pigna.fr')
  })

  it('sinon la base française suivie du préfixe', () => {
    const sansCorse = DOMAINES.filter((d) => d.langue === 'fr')
    expect(baseCanonique('co', sansCorse, PLATEFORME)).toBe('https://pigna.fr/co')
  })

  it('sans domaine du tout : le sous-domaine de la plateforme', () => {
    expect(baseCanonique('fr', [], PLATEFORME)).toBe(PLATEFORME)
    expect(baseCanonique('co', [], PLATEFORME)).toBe(`${PLATEFORME}/co`)
    expect(baseCanonique('co', [], '')).toBe('')
  })

  it('exemples de la spec', () => {
    // pigna.fr/co/marche a pour canonique pigna.corsica/marche
    expect(adresseCanonique('co', '/marche', DOMAINES, PLATEFORME)).toBe('https://pigna.corsica/marche')
    // pigna.corsica/fr/marche a pour canonique pigna.fr/marche
    expect(adresseCanonique('fr', '/marche', DOMAINES, PLATEFORME)).toBe('https://pigna.fr/marche')
    expect(adresseCanonique('fr', '/', DOMAINES, PLATEFORME)).toBe('https://pigna.fr')
  })

  it('hreflang : seules les langues disponibles, plus x-default en français', () => {
    expect(
      adressesAlternatives({
        chemin: '/marche',
        langueContenu: 'co',
        languesDisponibles: ['fr', 'co'],
        domaines: DOMAINES,
        basePlateforme: PLATEFORME,
      }),
    ).toEqual({
      canonical: 'https://pigna.corsica/marche',
      languages: {
        fr: 'https://pigna.fr/marche',
        co: 'https://pigna.corsica/marche',
        'x-default': 'https://pigna.fr/marche',
      },
    })
  })

  it('hreflang : page non traduite → le corse n’est pas annoncé, canonique française', () => {
    expect(
      adressesAlternatives({
        chemin: '/marche',
        langueContenu: 'fr',
        languesDisponibles: ['fr'],
        domaines: DOMAINES,
        basePlateforme: PLATEFORME,
      }),
    ).toEqual({
      canonical: 'https://pigna.fr/marche',
      languages: { fr: 'https://pigna.fr/marche', 'x-default': 'https://pigna.fr/marche' },
    })
  })
})

describe('sitemapXml', () => {
  const ressources = [
    { chemin: '/', langues: ['fr', 'co'] as const, priorite: '1.0' },
    { chemin: '/marche', langues: ['fr', 'co'] as const, priorite: '0.7' },
    { chemin: '/demarches', langues: ['fr'] as const, priorite: '0.7' },
  ]

  it('sur le domaine français : seulement les adresses dont le canonique y est', () => {
    const xml = sitemapXml(ressources, 'fr', DOMAINES, PLATEFORME)
    expect(xml).toContain('<loc>https://pigna.fr/marche</loc>')
    expect(xml).toContain('<loc>https://pigna.fr/demarches</loc>')
    expect(xml).not.toContain('<loc>https://pigna.corsica')
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="co" href="https://pigna.corsica/marche"/>',
    )
    expect(xml).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"')
  })

  it('sur le domaine corse : seulement les pages disponibles en corse', () => {
    const xml = sitemapXml(ressources, 'co', DOMAINES, PLATEFORME)
    expect(xml).toContain('<loc>https://pigna.corsica/marche</loc>')
    expect(xml).not.toContain('demarches')
  })

  it('sans domaine corse : les adresses /co vont dans le sitemap français', () => {
    const xml = sitemapXml(ressources, 'fr', DOMAINES.filter((d) => d.langue === 'fr'), PLATEFORME)
    expect(xml).toContain('<loc>https://pigna.fr/co/marche</loc>')
  })
})
```

Ajouts à `tests/unit/proxy.spec.ts` (nouveau `describe`, même helper `requete`) :

```ts
describe('proxy — aiguillage des langues', () => {
  const avant = { ...process.env }
  beforeEach(() => {
    process.env.PLATFORM_DOMAIN = 'plateforme.test'
  })
  afterEach(() => {
    process.env = { ...avant }
  })

  it('réécrit un chemin sans préfixe vers la sentinelle, sans rediriger', () => {
    const reponse = proxy(requete('pigna.fr', '/marche?x=1'))
    expect(reponse.status).toBe(200)
    expect(new URL(reponse.headers.get('x-middleware-rewrite') ?? '').pathname).toBe('/racine/marche')
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/marche?x=1')
  })

  it('laisse passer un chemin préfixé', () => {
    const reponse = proxy(requete('pigna.fr', '/co/marche'))
    expect(reponse.headers.get('x-middleware-rewrite')).toBeNull()
    expect(reponse.headers.get('x-middleware-next')).toBe('1')
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/co/marche')
  })

  it('écrase un x-pdlm-chemin forgé par le client', () => {
    const reponse = proxy(
      new NextRequest('https://pigna.fr/marche', {
        headers: { host: 'pigna.fr', 'x-pdlm-chemin': '/co/autre' },
      }),
    )
    expect(reponse.headers.get('x-middleware-request-x-pdlm-chemin')).toBe('/marche')
  })

  it('ne réécrit ni le sitemap ni les routes de mesure', () => {
    for (const chemin of ['/sitemap.xml', '/robots.txt', '/mesure/api/send']) {
      expect(proxy(requete('pigna.fr', chemin)).headers.get('x-middleware-rewrite'), chemin).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/adresses.spec.ts tests/unit/proxy.spec.ts`
Expected: FAIL — `@/lib/adresses` introuvable ; les nouveaux tests du proxy échouent (pas de réécriture).

- [ ] **Step 3: Write `src/lib/adresses.ts`**

```ts
import { FRANCAIS, estCodeLangue, type CodeLangue } from './langues'

/**
 * Adresses multilingues (spec § 3) — fonctions pures, sans base : testables
 * seules, utilisables dans le proxy comme dans les pages.
 */

/** Valeur sentinelle de `[lang]` : « langue principale du domaine ». Jamais visible. */
export const RACINE = 'racine'

/** Routes qui vivent hors de `[lang]` : jamais réécrites. */
const HORS_LANGUE = [/^\/sitemap\.xml$/, /^\/robots\.txt$/, /^\/mesure\/(api\/send|script\.js|opposition)$/]

/** Proxy : chemin de réécriture interne, ou null si le chemin passe tel quel. */
export function aiguiller(pathname: string): string | null {
  if (HORS_LANGUE.some((motif) => motif.test(pathname))) return null
  const premier = pathname.split('/')[1] ?? ''
  if (estCodeLangue(premier)) return null
  return pathname === '/' ? `/${RACINE}` : `/${RACINE}${pathname}`
}

/** Sépare un éventuel préfixe de langue du reste du chemin (requête comprise). */
export function cheminSansPrefixe(chemin: string): { langue: CodeLangue | null; reste: string } {
  const [chemin_, requete] = splitRequete(chemin)
  const segments = chemin_.split('/')
  const premier = segments[1] ?? ''
  if (!estCodeLangue(premier)) return { langue: null, reste: chemin }
  const reste = `/${segments.slice(2).join('/')}`.replace(/\/+$/, '') || '/'
  return { langue: premier, reste: reste + requete }
}

function splitRequete(chemin: string): [string, string] {
  const i = chemin.search(/[?#]/)
  return i === -1 ? [chemin, ''] : [chemin.slice(0, i), chemin.slice(i)]
}

/**
 * Utilitaire unique des liens internes : n'ajoute le préfixe que si la langue
 * diffère de la langue principale du domaine. Tout ce qui n'est pas un chemin
 * interne (`https:`, `mailto:`, `tel:`, `//hôte`, `#ancre`) reste intact.
 */
export function cheminLangue(chemin: string, langue: CodeLangue, langueRacine: CodeLangue): string {
  if (!chemin.startsWith('/') || chemin.startsWith('//')) return chemin
  if (langue === langueRacine) return chemin
  const [c, requete] = splitRequete(chemin)
  return (c === '/' ? `/${langue}` : `/${langue}${c}`) + requete
}

export type Decision =
  | { type: 'afficher'; langue: CodeLangue }
  | { type: 'introuvable' }
  | { type: 'rediriger'; vers: string }

/** Layout de `[lang]` : que faire de la valeur reçue (spec § 3, « aiguillage en deux temps »). */
export function choisirLangue({
  param,
  langueRacine,
  languesSite,
  cheminDemande,
}: {
  param: string
  langueRacine: CodeLangue
  languesSite: readonly CodeLangue[]
  cheminDemande: string
}): Decision {
  if (param === RACINE) return { type: 'afficher', langue: langueRacine }
  if (!estCodeLangue(param) || !languesSite.includes(param)) return { type: 'introuvable' }
  if (param === langueRacine) return { type: 'rediriger', vers: cheminSansPrefixe(cheminDemande).reste }
  return { type: 'afficher', langue: param }
}

export interface DomaineLangue {
  hostname: string
  langue: string
  canonique: boolean
}

/** Base canonique d'une langue : son domaine canonique, sinon la base française + `/L`. */
export function baseCanonique(
  langue: CodeLangue,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const propre = domaines.find((d) => d.canonique && d.langue === langue)
  if (propre) return `https://${propre.hostname}`
  const francais = domaines.find((d) => d.canonique && d.langue === FRANCAIS)
  const baseFr = francais ? `https://${francais.hostname}` : basePlateforme
  if (langue === FRANCAIS) return baseFr
  return baseFr ? `${baseFr}/${langue}` : ''
}

export function adresseCanonique(
  langue: CodeLangue,
  chemin: string,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const base = baseCanonique(langue, domaines, basePlateforme)
  if (!base) return ''
  return chemin === '/' ? base : `${base}${chemin}`
}

/** `alternates` de Next : canonique dans la langue du contenu, hreflang des langues disponibles. */
export function adressesAlternatives({
  chemin,
  langueContenu,
  languesDisponibles,
  domaines,
  basePlateforme,
}: {
  chemin: string
  langueContenu: CodeLangue
  languesDisponibles: readonly CodeLangue[]
  domaines: readonly DomaineLangue[]
  basePlateforme: string
}): { canonical?: string; languages: Record<string, string> } {
  const adresse = (l: CodeLangue) => adresseCanonique(l, chemin, domaines, basePlateforme)
  const languages: Record<string, string> = {}
  for (const l of languesDisponibles) if (adresse(l)) languages[l] = adresse(l)
  if (adresse(FRANCAIS)) languages['x-default'] = adresse(FRANCAIS)
  return { canonical: adresse(langueContenu) || undefined, languages }
}

export interface RessourceSitemap {
  chemin: string
  langues: readonly CodeLangue[]
  priorite: string
}

/**
 * Sitemap d'un domaine : les adresses dont le canonique est sur ce domaine
 * (même origine que la base canonique de sa langue principale), chacune avec
 * ses versions dans les autres langues disponibles.
 */
export function sitemapXml(
  ressources: readonly RessourceSitemap[],
  langueRacine: CodeLangue,
  domaines: readonly DomaineLangue[],
  basePlateforme: string,
): string {
  const baseIci = baseCanonique(langueRacine, domaines, basePlateforme)
  const origineIci = baseIci ? new URL(baseIci).origin : null
  const lignes: string[] = []
  for (const r of ressources) {
    for (const l of r.langues) {
      const loc = adresseCanonique(l, r.chemin, domaines, basePlateforme)
      if (!loc || !origineIci || new URL(loc).origin !== origineIci) continue
      const liens = [...r.langues, 'x-default' as const]
        .map((autre) => {
          const href = adresseCanonique(autre === 'x-default' ? FRANCAIS : autre, r.chemin, domaines, basePlateforme)
          return `<xhtml:link rel="alternate" hreflang="${autre}" href="${href}"/>`
        })
        .join('')
      lignes.push(`  <url><loc>${loc}</loc>${liens}<priority>${r.priorite}</priority></url>`)
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${lignes.join('\n')}
</urlset>`
}
```

- [ ] **Step 4: Wire the proxy — `src/proxy.ts`**

Ajouter `import { aiguiller } from './lib/adresses'` et remplacer l'étape 4 (lignes 61-64) par :

```ts
  // 4. Front public : écraser x-commune-host et x-pdlm-chemin (jamais lus du
  //    client), puis aiguiller la langue (spec multilingue § 3) : un chemin
  //    sans préfixe de langue est réécrit en interne vers la sentinelle de
  //    [lang] — le visiteur ne voit pas la réécriture.
  const entetes = new Headers(request.headers)
  entetes.set('x-commune-host', host)
  entetes.set('x-pdlm-chemin', pathname + request.nextUrl.search)
  const reecriture = aiguiller(pathname)
  if (reecriture) {
    const cible = request.nextUrl.clone()
    cible.pathname = reecriture
    return NextResponse.rewrite(cible, { request: { headers: entetes } })
  }
  return NextResponse.next({ request: { headers: entetes } })
```

Mettre à jour le commentaire d'en-tête (point 3) : « `x-commune-host` et `x-pdlm-chemin` sont TOUJOURS écrasés ».

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: PASS, tsc 0. (Le site n'est pas encore routé sous `[lang]` : ne pas lancer l'e2e à cette tâche.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/adresses.ts src/proxy.ts tests/unit/adresses.spec.ts tests/unit/proxy.spec.ts
git commit -m "Multilingue — adresses (préfixes, canoniques, hreflang, sitemap) et aiguillage du proxy"
```

---

### Task 3: Schéma — localisation Payload, champs traduits, état de traduction

**Files:**
- Create: `src/lib/champs-langue.ts`, `src/lib/langues-admin.ts`, `src/components/admin/ChampTraduction.tsx`
- Modify: `src/payload.config.ts`, `src/collections/{Pages,Actualites,Evenements,Documents,Alertes,Menus,Media,Communes,Domaines}.ts`, `src/app/(payload)/admin/importMap.js` (généré), `src/payload-types.ts` (généré)
- Test: `tests/int/localisation.int.spec.ts`, `tests/helpers/refus.ts`

**Interfaces:**
- Consumes: `LANGUES`, `LANGUES_REGIONALES`, `FRANCAIS` (tâche 1).
- Produces:
  - `requisEnFrancais` (validateur de champ) ; `lexicalVide(v: unknown): boolean`
  - `champTraduction: SelectField` (nom `traduction`, valeurs `'non-traduite' | 'a-relire' | 'validee'`)
  - `exigerTraductionComplete(champs: string[]): CollectionBeforeChangeHook`
  - `languesDisponiblesAdmin` (pour `localization.filterAvailableLocales`)
  - Communes : champ `langues` (select `hasMany`, codes régionaux) ; Domaines : champ `langue` (select, défaut `'fr'`, requis).

**Champs localisés** (spec § 2, point ouvert 4 réglé : `inscription` n'a aucun texte) :

| Collection | `localized: true` | `required` → `requisEnFrancais` | `traduction` | `exigerTraductionComplete` |
| --- | --- | --- | --- | --- |
| Pages | `titre`, `blocs`, `metaTitle`, `metaDescription` | `titre`, `blocs` | oui | `['titre', 'blocs']` |
| Actualités | `titre`, `resume`, `contenu` | `titre`, `resume`, `contenu` (richText : `lexicalVide`) | oui | `['titre', 'resume', 'contenu']` |
| Événements | `titre`, `lieu`, `description` | `titre` | oui | `['titre']` |
| Documents | `titre` | `titre` | oui | `['titre']` |
| Alertes | `message` | `message` | oui | `['message']` |
| Menus | `items[].label`, `items[].enfants[].label` | les deux `label` | non | — |
| Médias | `alt` | `alt` | non | — |
| Communes | `nom`, `horaires` | `nom` | non | — |

- [ ] **Step 1: Reset the test databases (push mode)**

Les bases `pdlm_test` et `pdlm_e2e` sont en mode *push* : déplacer des colonnes vers `*_locales` y déclencherait une question interactive de Drizzle. Les recréer vides (**jamais `pdlm`**, la base de dev de l'utilisateur — la lui laisser, il la resèmera s'il veut) :

```bash
docker exec pdlm-postgres-1 psql -U postgres -c 'DROP DATABASE IF EXISTS pdlm_test' -c 'CREATE DATABASE pdlm_test'
docker exec pdlm-postgres-1 psql -U postgres -c 'DROP DATABASE IF EXISTS pdlm_e2e' -c 'CREATE DATABASE pdlm_e2e'
```

- [ ] **Step 2: Write the test helper and the failing integration test**

Le message d'une `ValidationError` de Payload ne contient que les noms des champs (`node_modules/payload/dist/errors/ValidationError.js`, l. 13), pas leurs messages : `rejects.toThrow(/texte/)` ne peut pas les voir. `tests/helpers/refus.ts` les remonte :

```ts
/**
 * Une ValidationError de Payload n'a dans `message` que les noms des champs ;
 * les textes d'erreur sont dans `data.errors`. On les recolle au message pour
 * pouvoir écrire `await expect(refus(promesse)).rejects.toThrow(/texte/)`.
 */
export function refus<T>(promesse: Promise<T>): Promise<T> {
  return promesse.catch((e: { message?: string; data?: { errors?: Array<{ message?: string }> } }) => {
    throw new Error([e.message ?? '', ...(e.data?.errors ?? []).map((x) => x.message ?? '')].join(' | '))
  })
}
```

Dans tout ce plan, une attente de refus s'écrit `await expect(refus(…)).rejects.toThrow(/…/)`.

`tests/int/localisation.int.spec.ts` :

```ts
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { languesDisponiblesAdmin } from '@/lib/langues-admin'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { refus } from '../helpers/refus'

let payload: Payload
let commune: { id: number; host: string }

const texte = (t: string) => ({
  root: {
    type: 'root', format: '', indent: 0, version: 1, direction: null,
    children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null,
      children: [{ type: 'text', text: t, format: 0, version: 1, detail: 0, mode: 'normal', style: '' }] }],
  },
})

beforeAll(async () => {
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'localisation')
})

afterAll(async () => {
  for (const collection of ['pages', 'actualites', 'menus', 'media'] as const) {
    await payload.delete({ collection, where: { tenant: { equals: commune.id } }, overrideAccess: true })
  }
  await supprimerCommuneTest(payload, commune.id)
})

describe('localisation — lecture sans repli', () => {
  it('un document jamais édité en corse se lit vide en corse sans repli, en français avec repli', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: { tenant: commune.id, titre: 'Marché', slug: 'marche-loc', blocs: [{ blockType: 'contact', titre: 'x' }], _status: 'published' },
      overrideAccess: true,
    })
    const sansRepli = await payload.findByID({ collection: 'pages', id: page.id, locale: 'co', fallbackLocale: false, depth: 0, overrideAccess: true })
    expect(sansRepli.titre ?? null).toBeNull()
    expect(sansRepli.traduction ?? 'non-traduite').toBe('non-traduite')
    const avecRepli = await payload.findByID({ collection: 'pages', id: page.id, locale: 'co', fallbackLocale: 'fr', depth: 0, overrideAccess: true })
    expect(avecRepli.titre).toBe('Marché')
  })
})

describe('localisation — obligatoire en français seulement', () => {
  it('refuse une page sans titre en français', async () => {
    await expect(
      refus(payload.create({ collection: 'pages', data: { tenant: commune.id, slug: 'sans-titre', blocs: [{ blockType: 'contact' }] } as never, overrideAccess: true })),
    ).rejects.toThrow(/obligatoire en français/)
  })

  it('accepte un libellé de menu traduit à moitié (règle 3 : petits textes)', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: { tenant: commune.id, nom: 'Principal', items: [{ label: 'Marché', url: '/marche' }, { label: 'Démarches', url: '/demarches' }] },
      overrideAccess: true,
    })
    const enCorse = await payload.update({
      collection: 'menus', id: menu.id, locale: 'co', overrideAccess: true,
      data: { items: [{ id: menu.items[0].id, label: 'Mercatu', url: '/marche' }, { id: menu.items[1].id, url: '/demarches' }] },
    })
    expect(enCorse.items[0].label).toBe('Mercatu')
    const fr = await payload.findByID({ collection: 'menus', id: menu.id, locale: 'fr', overrideAccess: true })
    expect(fr.items.map((i) => i.label)).toEqual(['Marché', 'Démarches'])
  })
})

describe('I17 — « validée » exige une traduction complète', () => {
  it('refuse de valider en corse une actualité dont le contenu corse manque', async () => {
    const actu = await payload.create({
      collection: 'actualites',
      data: { tenant: commune.id, titre: 'Fête', slug: 'fete-loc', resume: 'Résumé', contenu: texte('Texte'), _status: 'published' },
      overrideAccess: true,
    })
    await expect(
      refus(payload.update({ collection: 'actualites', id: actu.id, locale: 'co', overrideAccess: true, data: { traduction: 'validee', titre: 'Festa' } })),
    ).rejects.toThrow(/résumé|contenu/i)
  })

  it('accepte de valider quand tout est traduit, sans toucher au français', async () => {
    const actu = await payload.create({
      collection: 'actualites',
      data: { tenant: commune.id, titre: 'Foire', slug: 'foire-loc', resume: 'Résumé', contenu: texte('Texte'), _status: 'published' },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'actualites', id: actu.id, locale: 'co', overrideAccess: true,
      data: { traduction: 'validee', titre: 'Fiera', resume: 'Riassuntu', contenu: texte('Testu') },
    })
    const fr = await payload.findByID({ collection: 'actualites', id: actu.id, locale: 'fr', overrideAccess: true })
    expect(fr.titre).toBe('Foire')
  })
})

describe('admin — langues proposées', () => {
  it('un non-opérateur ne voit que le français et les langues de sa commune', async () => {
    await payload.update({ collection: 'communes', id: commune.id, data: { langues: ['co'] }, overrideAccess: true })
    const locales = [{ code: 'fr', label: 'Français' }, { code: 'co', label: 'Corse' }]
    const req = {
      payload,
      user: { role: 'redacteur', tenants: [{ tenant: commune.id, roles: ['redacteur'] }] },
      headers: new Headers({ cookie: `payload-tenant=${commune.id}` }),
    }
    expect((await languesDisponiblesAdmin({ locales, req } as never)).map((l) => l.code)).toEqual(['fr', 'co'])
    await payload.update({ collection: 'communes', id: commune.id, data: { langues: [] }, overrideAccess: true })
    expect((await languesDisponiblesAdmin({ locales, req } as never)).map((l) => l.code)).toEqual(['fr'])
  })

  it('un opérateur voit toutes les langues', async () => {
    const locales = [{ code: 'fr', label: 'Français' }, { code: 'co', label: 'Corse' }]
    const req = { payload, user: { role: 'operateur' }, headers: new Headers() }
    expect(await languesDisponiblesAdmin({ locales, req } as never)).toHaveLength(2)
  })
})
```

Vérifier dans `tests/helpers/login.ts` ou le plugin le nom réel du cookie de commune (`payload-tenant` par défaut, `node_modules/@payloadcms/plugin-multi-tenant/dist/utilities/getTenantFromCookie.js`) ; adapter le test s'il diffère.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test:int -- tests/int/localisation.int.spec.ts`
Expected: FAIL — `@/lib/langues-admin` introuvable (puis, une fois créé, `locale` sans effet tant que `localization` n'est pas configurée).

- [ ] **Step 4: Write `src/lib/champs-langue.ts`**

```ts
import type { CollectionBeforeChangeHook, SelectField } from 'payload'

import { ValidationError } from 'payload'

import { FRANCAIS } from './langues'

/**
 * Un champ localisé `required: true` devient une colonne NOT NULL de la table
 * `*_locales` (drizzle, traverseFields) : impossible alors de ne traduire qu'une
 * partie des petits textes (spec § 2, règle 3). On l'exige donc en français
 * seulement ; hors français, `exigerTraductionComplete` prend le relais.
 */
export function lexicalVide(valeur: unknown): boolean {
  const racine = (valeur as { root?: { children?: unknown[] } } | null | undefined)?.root
  if (!racine?.children?.length) return true
  const texte = (noeud: unknown): string => {
    const n = noeud as { text?: string; children?: unknown[] }
    return (n.text ?? '') + (n.children ?? []).map(texte).join('')
  }
  return racine.children.map(texte).join('').trim() === ''
}

function vide(valeur: unknown): boolean {
  if (valeur === null || valeur === undefined || valeur === '') return true
  if (Array.isArray(valeur)) return valeur.length === 0
  if (typeof valeur === 'object' && 'root' in (valeur as object)) return lexicalVide(valeur)
  return false
}

export const requisEnFrancais = (valeur: unknown, { req }: { req: { locale?: string | null } }) =>
  (req.locale ?? FRANCAIS) !== FRANCAIS || !vide(valeur) || 'Ce champ est obligatoire en français.'

/** État de traduction (spec § 2) — il décide seul de l'affichage public d'une langue. */
export const champTraduction: SelectField = {
  name: 'traduction',
  type: 'select',
  localized: true,
  defaultValue: 'non-traduite',
  label: 'État de la traduction',
  options: [
    { label: 'Non traduite', value: 'non-traduite' },
    { label: 'À relire', value: 'a-relire' },
    { label: 'Validée', value: 'validee' },
  ],
  admin: {
    position: 'sidebar',
    description: 'Seule une traduction validée est montrée au public dans cette langue.',
    // Masqué quand on édite le français (Payload ne passe pas la langue aux `condition`).
    components: { Field: '/components/admin/ChampTraduction#ChampTraduction' },
  },
}

const LIBELLES: Record<string, string> = {
  titre: 'le titre',
  blocs: 'le contenu de la page',
  resume: 'le résumé',
  contenu: 'le contenu',
  message: 'le message',
}

/** I17 : une langue ne passe à « validée » que si ses champs obligatoires sont remplis. */
export const exigerTraductionComplete =
  (champs: string[]): CollectionBeforeChangeHook =>
  ({ data, req }) => {
    if ((req.locale ?? FRANCAIS) === FRANCAIS || data?.traduction !== 'validee') return data
    const manquants = champs.filter((champ) => vide(data[champ]))
    if (manquants.length > 0) {
      throw new ValidationError({
        errors: manquants.map((champ) => ({
          path: champ,
          message: `Impossible de valider la traduction : ${LIBELLES[champ] ?? champ} manque dans cette langue.`,
        })),
      })
    }
    return data
  }
```

- [ ] **Step 5: Write `src/lib/langues-admin.ts`**

```ts
import type { Locale, PayloadRequest } from 'payload'

import { getTenantFromCookie } from '@payloadcms/plugin-multi-tenant/utilities'

import { isOperateur } from '../access/roles'
import { FRANCAIS } from './langues'

/**
 * `localization.filterAvailableLocales` (spec § 5) : le français et les langues
 * activées pour la commune sélectionnée dans l'admin ; un opérateur voit tout.
 */
export async function languesDisponiblesAdmin({
  locales,
  req,
}: {
  locales: Locale[]
  req: PayloadRequest
}): Promise<Locale[]> {
  if (isOperateur(req.user)) return locales
  const tenants = (req.user as { tenants?: Array<{ tenant: unknown }> } | null)?.tenants ?? []
  const id =
    getTenantFromCookie(req.headers, 'number') ??
    (tenants.length === 1 ? (tenants[0].tenant as number | { id: number }) : null)
  const idCommune = typeof id === 'object' && id !== null ? id.id : id
  if (idCommune === null || idCommune === undefined) return locales.filter((l) => l.code === FRANCAIS)
  const commune = await req.payload
    .findByID({ collection: 'communes', id: idCommune, depth: 0, overrideAccess: true })
    .catch(() => null)
  const actives = new Set<string>([FRANCAIS, ...((commune?.langues as string[] | null) ?? [])])
  return locales.filter((l) => actives.has(l.code))
}
```

- [ ] **Step 6: Write `src/components/admin/ChampTraduction.tsx`**

```tsx
'use client'

import type { SelectFieldClientComponent } from 'payload'

import { SelectField, useLocale } from '@payloadcms/ui'

/** L'état de traduction n'a de sens que hors français : masqué quand on édite le français. */
export const ChampTraduction: SelectFieldClientComponent = (props) => {
  const locale = useLocale()
  if (locale?.code === 'fr') return null
  return <SelectField {...props} />
}
```

- [ ] **Step 7: Configure localization — `src/payload.config.ts`**

Imports : `import { FRANCAIS, LANGUES } from './lib/langues'` et `import { languesDisponiblesAdmin } from './lib/langues-admin'`. Après le bloc `i18n` :

```ts
  // Langues du CONTENU (spec multilingue § 1). L'admin, elle, reste en français (i18n ci-dessus).
  localization: {
    locales: LANGUES.map((l) => ({ code: l.code, label: l.nom })),
    defaultLocale: FRANCAIS,
    fallback: true,
    filterAvailableLocales: languesDisponiblesAdmin,
  },
```

- [ ] **Step 8: Localize the collections**

Appliquer le tableau ci-dessus. Exemple complet pour Pages (`src/collections/Pages.ts`) — les autres suivent le même motif :

```ts
import { champTraduction, exigerTraductionComplete, requisEnFrancais } from '../lib/champs-langue'
// …
    beforeChange: [
      figerTenant,
      bloquerPublication,
      validerRelationsTenant(extraireRefsPages),
      exigerTraductionComplete(['titre', 'blocs']),
    ],
  },
  fields: [
    {
      name: 'titre',
      type: 'text',
      localized: true,
      validate: requisEnFrancais,
      label: 'Titre',
      admin: { description: 'Obligatoire en français.' },
    },
    { name: 'slug', /* inchangé, NON localisé */ },
    {
      name: 'blocs',
      type: 'blocks',
      // Localisé comme un champ entier (spec § 2) : jamais bloc par bloc.
      localized: true,
      validate: requisEnFrancais,
      blocks: BlocsPages,
      label: 'Contenu de la page',
      admin: { description: 'Obligatoire en français.' },
    },
    { name: 'metaTitle', type: 'text', localized: true, /* … inchangé */ },
    { name: 'metaDescription', type: 'textarea', localized: true, label: 'Description SEO' },
    champTraduction,
  ],
```

Précisions par collection :
- **Actualités** : `titre`, `resume` (`textarea`), `contenu` (`richText`) → `localized: true`, `validate: requisEnFrancais` (le validateur reconnaît un richText vide via `lexicalVide`) ; ajouter `champTraduction` et `exigerTraductionComplete(['titre', 'resume', 'contenu'])` en fin de `beforeChange`.
- **Événements** : `titre` (requis FR), `lieu`, `description` localisés ; `champTraduction` ; `exigerTraductionComplete(['titre'])`. Le groupe `inscription` ne change pas.
- **Documents** : `titre` ; `champTraduction` ; `hooks.beforeChange: [figerTenant, exigerTraductionComplete(['titre'])]`.
- **Alertes** : `message` ; `champTraduction` ; `hooks.beforeChange: [figerTenant, exigerTraductionComplete(['message'])]`.
- **Menus** : les deux `label` (items et enfants) → `localized: true`, `validate: requisEnFrancais`, sans `required`. Le tableau `items` et `enfants` ne sont PAS localisés (les lignes sont communes, seuls les libellés changent).
- **Médias** : `alt` → `localized: true`, `validate: requisEnFrancais`, description « Obligatoire en français pour l’accessibilité (RGAA). Traduire dans chaque langue du site. ».
- **Communes** : `nom` → `localized: true`, `validate: requisEnFrancais` ; `horaires` → `localized: true`. Ajouter après `actif` :

```ts
    {
      name: 'langues',
      type: 'select',
      hasMany: true,
      label: 'Langues du site',
      options: LANGUES_REGIONALES.map((l) => ({ label: l.nom, value: l.code })),
      admin: {
        description:
          'Le français est toujours actif. Une langue cochée ici apparaît dans le sélecteur du site ; ses pages ne sont montrées que traduites et validées.',
      },
    },
```

- **Domaines** : ajouter après `canonique` :

```ts
    {
      name: 'langue',
      type: 'select',
      required: true,
      defaultValue: FRANCAIS,
      label: 'Langue servie à la racine',
      options: LANGUES.map((l) => ({ label: l.nom, value: l.code })),
      admin: {
        description:
          'Langue affichée à l’adresse nue de ce domaine (ex. pigna.corsica → corse). Les autres langues y sont servies sous /fr, /co…',
      },
    },
```

(La validation « langue activée pour la commune » et I6 élargi sont à la tâche 4.)

- [ ] **Step 9: Regenerate import map and types**

Run: `npm run generate:importmap && npm run generate:types`
Expected: `src/app/(payload)/admin/importMap.js` contient `ChampTraduction` ; `src/payload-types.ts` a `locale?: 'fr' | 'co'`, `traduction?: ('non-traduite' | 'a-relire' | 'validee') | null`, `langues`, `langue`. Ne PAS passer `payload-types.ts` à Prettier.

- [ ] **Step 10: Run tests**

Run: `npm run test:int -- tests/int/localisation.int.spec.ts`
Expected: PASS. Si « refuse de valider… contenu corse manque » passe à tort (le `data` du `beforeChange` est complété avec le français par Payload), le hook doit relire le document en `fallbackLocale: false` (`req.payload.findByID({ collection, id: originalDoc.id, locale: req.locale, fallbackLocale: false, depth: 0, overrideAccess: true, req })`) et compter comme présent un champ seulement s'il l'est dans cette lecture ou dans les données de la requête (`req.data`) ; noter le constat dans le ledger.

Puis : `npm run test:unit && npm run test:int && npx tsc --noEmit`
Expected: tout PASS (les 91 int existants passent : ils écrivent en français, langue par défaut).

- [ ] **Step 11: Commit**

```bash
git add src/lib/champs-langue.ts src/lib/langues-admin.ts src/components/admin/ChampTraduction.tsx src/payload.config.ts src/collections "src/app/(payload)/admin/importMap.js" src/payload-types.ts tests/int/localisation.int.spec.ts tests/helpers/refus.ts
git commit -m "Multilingue — localisation Payload, champs traduits, état de traduction (I17)"
```

---

### Task 4: Invariants des langues — I15, I16, I6 élargi, langue d'un domaine

**Files:**
- Modify: `src/hooks/uniqueSlugParCommune.ts:8-16`, `src/collections/Domaines.ts`, `src/collections/Communes.ts:61-91`
- Test: `tests/int/langues-invariants.int.spec.ts`, `tests/unit/slugs-reserves.spec.ts`

**Interfaces:**
- Consumes: `CODES_LANGUES`, `FRANCAIS`, `langueDe` (tâche 1) ; `RACINE` (tâche 2) ; champs `langues` / `langue` (tâche 3).
- Produces: `SLUGS_RESERVES` contient les codes de langue et `RACINE` ; `compterCanoniques(req, commune, langue, exclureId?)`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/slugs-reserves.spec.ts` :

```ts
import { describe, expect, it } from 'vitest'

import { RACINE } from '@/lib/adresses'
import { CODES_LANGUES } from '@/lib/langues'
import { SLUGS_RESERVES } from '@/hooks/uniqueSlugParCommune'

describe('I16 — slugs réservés', () => {
  it('réserve chaque code de langue et la sentinelle', () => {
    for (const code of CODES_LANGUES) expect(SLUGS_RESERVES).toContain(code)
    expect(SLUGS_RESERVES).toContain(RACINE)
  })
})
```

`tests/int/langues-invariants.int.spec.ts` :

```ts
import type { Payload } from 'payload'

import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { refus } from '../helpers/refus'

let payload: Payload
const aSupprimer: number[] = []

beforeAll(async () => {
  payload = await getPayloadClient()
})

afterEach(async () => {
  while (aSupprimer.length) await supprimerCommuneTest(payload, aSupprimer.pop()!)
})

async function commune(langues: string[] = []) {
  const c = await creerCommuneActive(payload, 'langues-inv')
  aSupprimer.push(c.id)
  if (langues.length) await payload.update({ collection: 'communes', id: c.id, data: { langues }, overrideAccess: true })
  return c
}

const domaine = (communeId: number, hostname: string, langue: string, canonique = false) =>
  refus(payload.create({ collection: 'domaines', data: { hostname, commune: communeId, langue, canonique }, overrideAccess: true }))

describe('langue d’un domaine', () => {
  it('refuse une langue que la commune n’a pas activée', async () => {
    const c = await commune()
    await expect(domaine(c.id, `${c.host}.corsica`, 'co')).rejects.toThrow(/n’a pas activé/)
  })

  it('accepte une langue activée', async () => {
    const c = await commune(['co'])
    await expect(domaine(c.id, `${c.host}.corsica`, 'co', true)).resolves.toMatchObject({ langue: 'co' })
  })
})

describe('I6 élargi — un canonique par commune ET par langue', () => {
  it('accepte un canonique corse à côté du canonique français', async () => {
    const c = await commune(['co'])
    await expect(domaine(c.id, `${c.host}.corsica`, 'co', true)).resolves.toBeDefined()
  })

  it('refuse un second canonique français', async () => {
    const c = await commune()
    await expect(domaine(c.id, `autre-${c.host}`, 'fr', true)).rejects.toThrow(/déjà un domaine canonique en français/)
  })

  it('refuse de faire passer au corse le dernier canonique français d’une commune active', async () => {
    const c = await commune(['co'])
    const fr = await payload.find({ collection: 'domaines', where: { hostname: { equals: c.host } }, overrideAccess: true })
    await expect(
      refus(payload.update({ collection: 'domaines', id: fr.docs[0].id, data: { langue: 'co' }, overrideAccess: true })),
    ).rejects.toThrow(/dernier domaine canonique en français/)
  })

  it('permet de retirer le canonique corse', async () => {
    const c = await commune(['co'])
    const co = await domaine(c.id, `${c.host}.corsica`, 'co', true)
    await expect(payload.delete({ collection: 'domaines', id: co.id, overrideAccess: true })).resolves.toBeDefined()
  })
})

describe('I15 — désactiver une langue servie à la racine', () => {
  it('refuse, en expliquant quel domaine changer d’abord', async () => {
    const c = await commune(['co'])
    await domaine(c.id, `${c.host}.corsica`, 'co', true)
    await expect(
      refus(payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true })),
    ).rejects.toThrow(new RegExp(`${c.host}\\.corsica.*changez d’abord`, 'i'))
  })

  it('accepte quand aucun domaine ne la sert', async () => {
    const c = await commune(['co'])
    await expect(
      payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true }),
    ).resolves.toMatchObject({ langues: [] })
  })
})

describe('I16 — un code de langue n’est pas un slug de page', () => {
  it('refuse une page de slug « co »', async () => {
    const c = await commune()
    await expect(
      refus(payload.create({ collection: 'pages', data: { tenant: c.id, titre: 'Co', slug: 'co', blocs: [{ blockType: 'contact' }] }, overrideAccess: true })),
    ).rejects.toThrow(/réservé/)
  })
})
```

`supprimerCommuneTest` désactive la commune puis supprime ses domaines : si une commune a `langues: ['co']` et un domaine corse, la suppression des domaines passe (aucun invariant ne l'empêche une fois la commune inactive) — vérifier que l'`afterEach` ne laisse rien (`payload.count` des domaines `langues-inv-`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:unit -- tests/unit/slugs-reserves.spec.ts && npm run test:int -- tests/int/langues-invariants.int.spec.ts`
Expected: FAIL (codes non réservés, aucun contrôle de langue, message I6 actuel).

- [ ] **Step 3: Reserve language slugs — `src/hooks/uniqueSlugParCommune.ts`**

```ts
import { RACINE } from '../lib/adresses'
import { CODES_LANGUES } from '../lib/langues'

/** Slugs réservés aux routes statiques du front public (R7) et aux préfixes de langue (I16). */
export const SLUGS_RESERVES = [
  'actualites',
  'agenda',
  'documents',
  'admin',
  'api',
  'mesure',
  'mesure-d-audience',
  RACINE,
  ...CODES_LANGUES,
]
```

- [ ] **Step 4: Domaines — langue activée + I6 par langue (`src/collections/Domaines.ts`)**

Remplacer `compterCanoniques` et le `beforeChange` / `beforeDelete` :

```ts
async function compterCanoniques(req: PayloadRequest, commune: number, langue: string, exclureId?: number) {
  const conditions: Where[] = [
    { commune: { equals: commune } },
    { canonique: { equals: true } },
    { langue: { equals: langue } },
  ]
  if (exclureId !== undefined) conditions.push({ id: { not_equals: exclureId } })
  const res = await req.payload.count({ collection: 'domaines', where: { and: conditions } })
  return res.totalDocs
}

const erreur = (path: string, message: string) => new ValidationError({ errors: [{ path, message }] })
```

`beforeChange` :

```ts
      async ({ req, data, originalDoc }) => {
        const commune = idDe(data?.commune ?? originalDoc?.commune)
        if (commune === undefined) throw erreur('commune', 'Domaine sans commune.')
        const langue: string = data?.langue ?? originalDoc?.langue ?? FRANCAIS
        const canonique: boolean = data?.canonique ?? originalDoc?.canonique ?? false
        const cible = await req.payload.findByID({ collection: 'communes', id: commune, overrideAccess: true, req })

        // La langue servie à la racine doit être activée pour la commune.
        if (langue !== FRANCAIS && !((cible.langues as string[] | null) ?? []).includes(langue)) {
          const nom = estCodeLangue(langue) ? langueDe(langue).nom.toLowerCase() : langue
          throw erreur('langue', `La commune n’a pas activé le ${nom}. Activez-le d’abord dans sa fiche (Langues du site).`)
        }

        // I6 élargi : au plus un canonique par commune et par langue (l'index
        // unique partiel de la migration multilingue le garantit en base).
        if (canonique && (await compterCanoniques(req, commune, langue, originalDoc?.id)) > 0) {
          const nom = estCodeLangue(langue) ? langueDe(langue).nom.toLowerCase() : langue
          throw erreur('canonique', `Cette commune possède déjà un domaine canonique en ${nom}.`)
        }

        // Le canonique français reste requis pour une commune active : on ne
        // peut ni le dé-canonicaliser ni le faire passer à une autre langue
        // s'il est le dernier.
        const etaitCanoniqueFr = originalDoc?.canonique === true && (originalDoc?.langue ?? FRANCAIS) === FRANCAIS
        const resteCanoniqueFr = canonique && langue === FRANCAIS
        if (etaitCanoniqueFr && !resteCanoniqueFr && cible.actif !== false) {
          if ((await compterCanoniques(req, commune, FRANCAIS, originalDoc.id)) === 0) {
            throw erreur(
              'canonique',
              'Impossible de retirer le dernier domaine canonique en français d’une commune active (en créer un autre ou désactiver la commune d’abord).',
            )
          }
        }
        return data
      },
```

`beforeDelete` : même logique, restreinte au canonique **français** (`doc.canonique === true && (doc.langue ?? 'fr') === 'fr'`), avec `compterCanoniques(req, commune, FRANCAIS, doc.id)` et le message « Impossible de supprimer le dernier domaine canonique en français d’une commune active. ». Imports : `ValidationError` depuis `payload`, `FRANCAIS, estCodeLangue, langueDe` depuis `../lib/langues`. Mettre à jour le commentaire de tête (« un seul canonique par commune et par langue »), la description du champ `canonique` (« Un seul par commune et par langue… Le canonique français est requis pour activer une commune. ») et retirer la mention de la migration J4 qui n'a jamais créé d'index.

- [ ] **Step 5: Communes — activation par le canonique français et I15 (`src/collections/Communes.ts`)**

Dans le premier `beforeChange`, la requête d'activation devient :

```ts
                  where: {
                    and: [
                      { commune: { equals: communeId } },
                      { canonique: { equals: true } },
                      { langue: { equals: FRANCAIS } },
                    ],
                  },
```

et le message : « Activation impossible : la commune doit posséder un domaine canonique en français. ». Ajouter ensuite, dans le même hook avant `return data` :

```ts
        // I15 : pas de désactivation d'une langue qu'un domaine sert à sa racine.
        if (originalDoc?.id && Array.isArray(data?.langues)) {
          const retirees = ((originalDoc.langues as string[] | null) ?? []).filter(
            (l) => !(data.langues as string[]).includes(l),
          )
          if (retirees.length > 0) {
            const servis = await req.payload.find({
              collection: 'domaines',
              where: { and: [{ commune: { equals: originalDoc.id } }, { langue: { in: retirees } }] },
              limit: 1,
              overrideAccess: true,
              req,
            })
            const d = servis.docs[0]
            if (d) {
              const nom = estCodeLangue(d.langue) ? langueDe(d.langue).nom.toLowerCase() : d.langue
              throw new ValidationError({
                errors: [{
                  path: 'langues',
                  message: `Le ${nom} est servi à la racine de ${d.hostname}. Changez d’abord la langue de ce domaine.`,
                }],
              })
            }
          }
        }
```

(`communes-activation.int.spec.ts` attend le message actuel « …au moins un domaine canonique » : l'y adapter.)

- [ ] **Step 6: Run tests**

Run: `npm run test:unit && npm run test:int && npx tsc --noEmit`
Expected: tout PASS.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/uniqueSlugParCommune.ts src/collections/Domaines.ts src/collections/Communes.ts tests
git commit -m "Multilingue — I15, I16, I6 par langue, langue d'un domaine activée pour la commune"
```

---

### Task 5: Migration de base sans perte (+ script de vérification rejouable)

**Files:**
- Create: `src/migrations/<horodatage>_multilingue.ts` et `.json` (générés), `scripts/instantane-contenu.ts`, `scripts/verifier-migration-multilingue.sh`
- Modify: `src/migrations/index.ts` (généré)

**Interfaces:**
- Consumes: le schéma des tâches 3-4.
- Produces: migration `up` (recopie en `_locale = 'fr'` AVANT toute suppression) et `down` (recopie inverse) ; index unique `domaines_un_canonique_par_langue`.

- [ ] **Step 1: Generate the migration**

Run: `npm run payload -- migrate:create multilingue`
Expected: nouveaux fichiers `src/migrations/2026MMDD_HHMMSS_multilingue.{ts,json}` et `index.ts` mis à jour. **Ne pas toucher au `.json`.**

- [ ] **Step 2: Inventory what the generated `up` does**

Run: `grep -nE 'DROP COLUMN|ADD COLUMN "_locale"|CREATE TABLE' src/migrations/*_multilingue.ts`

Attendu (vérifier ligne à ligne, noter les écarts) :
- `CREATE TABLE` : `pages_locales`, `_pages_v_locales`, `actualites_locales`, `_actualites_v_locales`, `evenements_locales`, `documents_locales`, `alertes_locales`, `media_locales`, `communes_locales`, `menus_items_locales`, `menus_items_enfants_locales`, `communes_langues`.
- `ADD COLUMN "_locale"` (NOT NULL) sur les 20 tables de blocs `pages_blocks_*` et `_pages_v_blocks_*` (champ `blocs` localisé entier, tableaux imbriqués compris).
- `DROP COLUMN` des colonnes déplacées : `pages.titre`, `pages.meta_title`, `pages.meta_description`, `_pages_v.version_titre`, `_pages_v.version_meta_title`, `_pages_v.version_meta_description`, `actualites.titre|resume|contenu`, `_actualites_v.version_titre|version_resume|version_contenu`, `evenements.titre|lieu|description`, `documents.titre`, `alertes.message`, `media.alt`, `communes.nom|horaires`, `menus_items.label`, `menus_items_enfants.label`.
- `ADD COLUMN "langue"` sur `domaines` avec `DEFAULT 'fr' NOT NULL`.

- [ ] **Step 3: Complete `up` by hand**

Règles, dans cet ordre, à appliquer dans le fichier `.ts` :
1. Après chaque `CREATE TABLE "<t>_locales"` et **avant** tout `DROP COLUMN` de `<t>`, recopier :

```sql
INSERT INTO "pages_locales" ("titre", "meta_title", "meta_description", "_locale", "_parent_id")
  SELECT "titre", "meta_title", "meta_description", 'fr', "id" FROM "pages";
INSERT INTO "_pages_v_locales" ("version_titre", "version_meta_title", "version_meta_description", "_locale", "_parent_id")
  SELECT "version_titre", "version_meta_title", "version_meta_description", 'fr', "id" FROM "_pages_v";
INSERT INTO "menus_items_locales" ("label", "_locale", "_parent_id")
  SELECT "label", 'fr', "id" FROM "menus_items";
-- idem : actualites, _actualites_v, evenements, documents, alertes, media, communes, menus_items_enfants
```

   Les noms exacts des colonnes cibles sont ceux des `CREATE TABLE` générés (les recopier, ne pas les deviner). La colonne `traduction` (nouvelle) prend son défaut ; pour les lignes françaises recopiées, la laisser à `'non-traduite'` (sans effet en français).
2. Pour chaque `ADD COLUMN "_locale" … NOT NULL` sans défaut, le remplacer par trois instructions :

```sql
ALTER TABLE "pages_blocks_hero" ADD COLUMN "_locale" "_locales" DEFAULT 'fr';
UPDATE "pages_blocks_hero" SET "_locale" = 'fr';
ALTER TABLE "pages_blocks_hero" ALTER COLUMN "_locale" SET NOT NULL, ALTER COLUMN "_locale" DROP DEFAULT;
```

   (Le type — `"_locales"` enum ou `varchar` — est celui de l'instruction générée : le garder.)
3. Ajouter à la fin :

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "domaines_un_canonique_par_langue"
  ON "domaines" ("commune_id", "langue") WHERE "canonique" = true;
```

4. En tête du fichier, un commentaire : « Complétée à la main (spec multilingue § 6) : Payload déplace les colonnes localisées vers `*_locales` sans recopier les données. Chaque valeur existante est recopiée en `_locale = 'fr'` avant toute suppression de colonne. »

- [ ] **Step 4: Complete `down` by hand**

Le `down` généré recrée les colonnes puis supprime les tables `*_locales` : insérer, **après** la recréation des colonnes et **avant** les `DROP TABLE`, la recopie inverse :

```sql
UPDATE "pages" p SET "titre" = l."titre", "meta_title" = l."meta_title", "meta_description" = l."meta_description"
  FROM "pages_locales" l WHERE l."_parent_id" = p."id" AND l."_locale" = 'fr';
-- idem pour chaque table ; pour les tables de blocs, supprimer d'abord les lignes non françaises :
DELETE FROM "pages_blocks_hero" WHERE "_locale" <> 'fr';
```

puis `DROP INDEX IF EXISTS "domaines_un_canonique_par_langue";`. Les colonnes recréées `NOT NULL` (ex. `pages.titre`) doivent être créées nullables, remplies, puis passées `NOT NULL` — même motif qu'à l'étape 3.

- [ ] **Step 5: Write `scripts/instantane-contenu.ts`**

```ts
/**
 * Instantané du contenu en français, stable et comparable : sert à prouver
 * qu'une migration n'a rien perdu (scripts/verifier-migration-multilingue.sh).
 * Doit tourner sur l'ANCIEN schéma comme sur le nouveau : n'utilise que l'API
 * locale, et retire les champs ajoutés par le multilingue.
 *   npx payload run scripts/instantane-contenu.ts > instantane.json
 */
import config from '@payload-config'
import { getPayload } from 'payload'

const COLLECTIONS = ['communes', 'domaines', 'media', 'pages', 'actualites', 'evenements', 'documents', 'alertes', 'menus'] as const
const NOUVEAUX = new Set(['traduction', 'langues', 'langue'])

function nettoyer(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(nettoyer)
  if (valeur && typeof valeur === 'object') {
    return Object.fromEntries(
      Object.entries(valeur as Record<string, unknown>)
        .filter(([cle]) => !NOUVEAUX.has(cle))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cle, v]) => [cle, nettoyer(v)]),
    )
  }
  return valeur
}

const payload = await getPayload({ config })
const sortie: Record<string, unknown> = {}
for (const collection of COLLECTIONS) {
  const res = await payload.find({ collection, locale: 'fr', depth: 0, pagination: false, sort: 'id', overrideAccess: true } as never)
  sortie[collection] = nettoyer(res.docs)
}
for (const collection of ['pages', 'actualites'] as const) {
  const res = await payload.findVersions({ collection, locale: 'fr', depth: 0, pagination: false, sort: 'id', overrideAccess: true } as never)
  sortie[`${collection}_versions`] = nettoyer(res.docs)
}
process.stdout.write(JSON.stringify(sortie, null, 2) + '\n')
process.exit(0)
```

- [ ] **Step 6: Write `scripts/verifier-migration-multilingue.sh`**

```bash
#!/usr/bin/env bash
# Rejoue la migration multilingue sur une base JETABLE, sans toucher aux autres :
#   1. schéma de `main` par ses propres migrations, contenu de démonstration ;
#   2. instantané du contenu ; 3. migration multilingue ; 4. instantané, comparaison ;
#   5. migrate:down ; 6. instantané avec le code de `main`, comparaison.
# NODE_ENV=production partout : sans lui, Payload « pousse » le schéma en dev et
# masquerait une migration incomplète.
set -euo pipefail

BASE=pdlm_migration_multilingue
URI="postgres://postgres:postgres@127.0.0.1:5432/$BASE"
PSQL=(docker exec -i pdlm-postgres-1 psql -U postgres -v ON_ERROR_STOP=1)
TRAVAIL=$(mktemp -d)
MAIN="$TRAVAIL/main"
ICI=$(pwd)

nettoyer() { git worktree remove --force "$MAIN" 2>/dev/null || true; }
trap nettoyer EXIT

"${PSQL[@]}" -c "DROP DATABASE IF EXISTS $BASE" -c "CREATE DATABASE $BASE"
git worktree add --detach "$MAIN" main >/dev/null
ln -s "$ICI/node_modules" "$MAIN/node_modules"
cp "$ICI/.env" "$MAIN/.env"
cp "$ICI/scripts/instantane-contenu.ts" "$MAIN/scripts/"

export DATABASE_URI="$URI" NODE_ENV=production S3_ENABLED=false
(cd "$MAIN" && npx payload migrate && npx payload run src/seed/index.ts && npx payload run scripts/instantane-contenu.ts) > "$TRAVAIL/avant.json"
npx payload migrate
npx payload run scripts/instantane-contenu.ts > "$TRAVAIL/apres.json"
diff -u "$TRAVAIL/avant.json" "$TRAVAIL/apres.json" && echo "✅ up : contenu français identique"
npx payload migrate:down
(cd "$MAIN" && npx payload run scripts/instantane-contenu.ts) > "$TRAVAIL/retour.json"
diff -u "$TRAVAIL/avant.json" "$TRAVAIL/retour.json" && echo "✅ down : contenu identique à l'origine"
"${PSQL[@]}" -c "DROP DATABASE $BASE"
```

Vérifier dans `package.json` la commande exacte du seed (`npm run seed`) et la reprendre si elle diffère de `payload run src/seed/index.ts`. Les instantanés contiennent `createdAt`/`updatedAt` : `up` ne doit pas les modifier ; si le diff montre seulement ces champs, c'est un défaut de la migration (une recopie qui réécrit la ligne), pas du script.

- [ ] **Step 7: Run it — and make it fail first**

D'abord **sans** les recopies de l'étape 3 (mettre de côté la version complétée : `cp src/migrations/*_multilingue.ts "$TMPDIR/"`, régénérer la migration brute), lancer `bash scripts/verifier-migration-multilingue.sh` : attendu **échec** — soit Postgres refuse `ADD COLUMN "_locale" NOT NULL` sur des tables non vides, soit le diff montre titres et libellés à `null`. Noter la sortie dans le ledger. Remettre la version complétée.

Puis : `bash scripts/verifier-migration-multilingue.sh`
Expected: `✅ up : contenu français identique` puis `✅ down : contenu identique à l'origine`.

- [ ] **Step 8: Commit**

```bash
git add src/migrations scripts/instantane-contenu.ts scripts/verifier-migration-multilingue.sh
git commit -m "Multilingue — migration sans perte (recopie en fr avant suppression), aller et retour vérifiés"
```

---

### Task 6: Lectures publiques par langue (site, contenus, menus, commune, médias)

**Files:**
- Modify: `src/lib/commune.ts` (ajout `siteDuHost`, `resolveSite`), `src/lib/contenu.ts`
- Create: `src/lib/langues-site.ts` (pur : `languesDuSite`), `src/lib/langue-courante.ts` (`server-only`)
- Test: `tests/int/contenu-langue.int.spec.ts`

**Interfaces:**
- Consumes: `choisirLangue`, `cheminSansPrefixe`, `DomaineLangue` (tâche 2) ; `dictionnaire` (tâche 1) ; champs localisés (tâche 3).
- Produces:
  - `interface Site { commune: Commune; langueRacine: CodeLangue }` ; `siteDuHost(host): Promise<Site | null>` ; `resolveSite = cache(() => Promise<Site | null>)` ; `communeDuHost` et `resolveCommune` gardent leur signature.
  - `languesDuSite(commune: Commune): CodeLangue[]` (dans `langues-site.ts`, `fr` en premier ; pur, pour que `contenu.ts` l'importe sans tirer `next/navigation`)
  - `type Traduisible = 'pages' | 'actualites' | 'evenements' | 'documents' | 'alertes'`
  - `interface EnLangue<T> { doc: T; langue: CodeLangue }` — `langue` = langue du contenu affiché
  - `versionEnLangue<C extends Traduisible>(collection: C, docFr, langue): Promise<EnLangue<…>>`
  - `versionsEnLangue<C extends Traduisible>(collection: C, docsFr, langue): Promise<EnLangue<…>[]>`
  - `languesDisponibles(collection: Traduisible, ids, languesSite): Promise<Map<number, CodeLangue[]>>`
  - `interface TexteEnLangue { texte: string; langue: CodeLangue }`
  - `interface ElementMenu { label: TexteEnLangue; href: string; enfants: Array<{ label: TexteEnLangue; href: string }> }`
  - `menuEnLangue(id, langue, pages: Map<number, Page>): Promise<ElementMenu[]>` — `href` sans préfixe (la tâche 7 applique `cheminLangue`)
  - `communeEnLangue(commune, langue): Promise<{ nom: TexteEnLangue; horaires: TexteEnLangue | null }>`
  - `mediaDe(id, ref, langue = 'fr'): Promise<(Media & { langueAlt: CodeLangue }) | null>`
  - `domainesCommune(id): Promise<DomaineLangue[]>` ; `basePlateforme(slug): string`
  - `baseUrlsPubliques(id, slug)` conservée (base canonique française), `domaineCanonique` supprimée (remplacée).
  - `interface ContexteLangue { site: Site; langue: CodeLangue; languesSite: CodeLangue[]; t: Dictionnaire; chemin: string }` — `chemin` = chemin demandé sans préfixe, requête comprise
  - `contexteLangue = cache(async (param: string) => Promise<ContexteLangue | null>)` — appelle `notFound()` / `permanentRedirect()` selon `choisirLangue`.

- [ ] **Step 1: Write the failing test — `tests/int/contenu-langue.int.spec.ts`**

```ts
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { siteDuHost } from '@/lib/commune'
import {
  communeEnLangue,
  languesDisponibles,
  menuEnLangue,
  pageParSlug,
  versionEnLangue,
  versionsEnLangue,
  actualitesCommune,
} from '@/lib/contenu'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let c: { id: number; host: string }
const texte = (t: string) => ({ root: { type: 'root', format: '', indent: 0, version: 1, direction: null,
  children: [{ type: 'paragraph', format: '', indent: 0, version: 1, direction: null,
    children: [{ type: 'text', text: t, format: 0, version: 1, detail: 0, mode: 'normal', style: '' }] }] } })

beforeAll(async () => {
  payload = await getPayloadClient()
  c = await creerCommuneActive(payload, 'contenu-langue')
  await payload.update({ collection: 'communes', id: c.id, data: { langues: ['co'], horaires: 'Lundi 9h-12h' }, overrideAccess: true })
  await payload.update({ collection: 'communes', id: c.id, locale: 'co', data: { nom: 'Paese' }, overrideAccess: true })
  await payload.create({ collection: 'domaines', data: { hostname: `${c.host}.corsica`, commune: c.id, langue: 'co', canonique: true }, overrideAccess: true })

  const traduite = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Marché', slug: 'marche', _status: 'published', blocs: [{ blockType: 'contact', titre: 'Venez' }] } })
  await payload.update({ collection: 'pages', id: traduite.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Mercatu', blocs: [{ blockType: 'contact', titre: 'Venite' }], traduction: 'validee', _status: 'published' } })
  const aRelire = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Démarches', slug: 'demarches', _status: 'published', blocs: [{ blockType: 'contact', titre: 'Mairie' }] } })
  await payload.update({ collection: 'pages', id: aRelire.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Pratiche', blocs: [{ blockType: 'contact', titre: 'Merria' }], traduction: 'a-relire', _status: 'published' } })

  for (const [slug, titre, trad] of [['a1', 'Une', true], ['a2', 'Deux', false]] as const) {
    const a = await payload.create({ collection: 'actualites', overrideAccess: true,
      data: { tenant: c.id, titre, slug, resume: 'r', contenu: texte('t'), _status: 'published', datePublication: new Date(Date.now() - 86_400_000).toISOString() } })
    if (trad) await payload.update({ collection: 'actualites', id: a.id, locale: 'co', overrideAccess: true,
      data: { titre: 'Una', resume: 'r', contenu: texte('t'), traduction: 'validee', _status: 'published' } })
  }

  const menu = await payload.create({ collection: 'menus', overrideAccess: true,
    data: { tenant: c.id, nom: 'Principal', items: [{ label: 'Marché', url: '/marche' }, { label: 'Démarches', url: '/demarches' }] } })
  await payload.update({ collection: 'menus', id: menu.id, locale: 'co', overrideAccess: true,
    data: { items: [{ id: menu.items[0].id, label: 'Mercatu', url: '/marche' }, { id: menu.items[1].id, url: '/demarches' }] } })
})

afterAll(async () => {
  for (const collection of ['pages', 'actualites', 'menus'] as const) {
    await payload.delete({ collection, where: { tenant: { equals: c.id } }, overrideAccess: true })
  }
  await supprimerCommuneTest(payload, c.id)
})

describe('site du host', () => {
  it('donne la langue principale du domaine', async () => {
    expect((await siteDuHost(`${c.host}.corsica`))?.langueRacine).toBe('co')
    expect((await siteDuHost(c.host))?.langueRacine).toBe('fr')
  })
})

describe('règle 1 — page ou fiche', () => {
  it('traduction validée : tout le document en corse', async () => {
    const fr = await pageParSlug(c.id, 'marche')
    const v = await versionEnLangue('pages', fr!, 'co')
    expect(v.langue).toBe('co')
    expect(v.doc.titre).toBe('Mercatu')
    expect(v.doc.blocs?.[0]).toMatchObject({ titre: 'Venite' })
  })

  it('I17 : « à relire » ne s’affiche pas — tout le document en français', async () => {
    const fr = await pageParSlug(c.id, 'demarches')
    const v = await versionEnLangue('pages', fr!, 'co')
    expect(v.langue).toBe('fr')
    expect(v.doc.titre).toBe('Démarches')
    expect(v.doc.blocs?.[0]).toMatchObject({ titre: 'Mairie' })
  })
})

describe('règle 2 — listes', () => {
  it('tous les éléments apparaissent, chacun dans sa langue', async () => {
    const res = await actualitesCommune(c.id)
    const v = await versionsEnLangue('actualites', res.docs, 'co')
    expect(v.map((x) => [x.doc.titre, x.langue])).toEqual(
      expect.arrayContaining([['Una', 'co'], ['Deux', 'fr']]),
    )
    expect(v).toHaveLength(2)
  })
})

describe('règle 3 — petits textes', () => {
  it('libellé de menu non traduit : repli français marqué', async () => {
    const menu = await menuEnLangue(c.id, 'co', new Map())
    expect(menu.map((e) => e.label)).toEqual([
      { texte: 'Mercatu', langue: 'co' },
      { texte: 'Démarches', langue: 'fr' },
    ])
  })

  it('nom traduit, horaires en repli', async () => {
    const commune = await payload.findByID({ collection: 'communes', id: c.id, overrideAccess: true })
    expect(await communeEnLangue(commune, 'co')).toEqual({
      nom: { texte: 'Paese', langue: 'co' },
      horaires: { texte: 'Lundi 9h-12h', langue: 'fr' },
    })
  })
})

describe('langues disponibles (hreflang, sitemap)', () => {
  it('le français toujours, une autre langue seulement validée ET activée', async () => {
    const pages = await payload.find({ collection: 'pages', where: { tenant: { equals: c.id } }, overrideAccess: true })
    const ids = pages.docs.map((p) => p.id)
    const dispo = await languesDisponibles('pages', ids, ['fr', 'co'])
    const parSlug = Object.fromEntries(pages.docs.map((p) => [p.slug, dispo.get(p.id)]))
    expect(parSlug).toEqual({ marche: ['fr', 'co'], demarches: ['fr'] })
    // Commune qui a retiré le corse : plus annoncé, même validé
    const sansCorse = await languesDisponibles('pages', ids, ['fr'])
    expect([...sansCorse.values()].every((l) => l.length === 1 && l[0] === 'fr')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int -- tests/int/contenu-langue.int.spec.ts`
Expected: FAIL — `siteDuHost`, `versionEnLangue`… non exportés.

- [ ] **Step 3: `src/lib/commune.ts` — site et langue du domaine**

Renommer le corps de `communeDuHost` en `siteDuHost` qui renvoie `{ commune, langueRacine }` :
- branche slug (plateforme ou `fallbackDev`) → `langueRacine: FRANCAIS` (les sous-domaines de la plateforme servent toujours le français, spec § 1) ;
- branche domaine → `langueRacine: estCodeLangue(domaine.langue) ? domaine.langue : FRANCAIS`.

```ts
export interface Site {
  commune: Commune
  langueRacine: CodeLangue
}

export async function siteDuHost(hostBrut: string): Promise<Site | null> { /* corps existant adapté */ }

/** Compatibilité : les route handlers n'ont besoin que de la commune. */
export async function communeDuHost(hostBrut: string): Promise<Commune | null> {
  return (await siteDuHost(hostBrut))?.commune ?? null
}

export const resolveSite = cache(async (): Promise<Site | null> => {
  const entetes = await headers()
  return siteDuHost(entetes.get('x-commune-host') ?? '')
})

export const resolveCommune = cache(async (): Promise<Commune | null> => (await resolveSite())?.commune ?? null)
```

- [ ] **Step 4: `src/lib/contenu.ts` — lectures par langue**

Ajouter (en gardant l'en-tête I4 : tout `overrideAccess: true` reste dans ce module) :

```ts
import type { DataFromCollectionSlug } from 'payload'

import type { DomaineLangue } from './adresses'
import { FRANCAIS, type CodeLangue } from './langues'

export type Traduisible = 'pages' | 'actualites' | 'evenements' | 'documents' | 'alertes'

/** `langue` = langue du contenu réellement affiché (pour `lang` et la mention). */
export interface EnLangue<T> {
  doc: T
  langue: CodeLangue
}

/**
 * Règle 1 (spec § 2) : le document entier en L si sa traduction y est
 * « validée », sinon entièrement en français. L'état se lit SANS repli : lu
 * avec repli, `traduction` en L renverrait la valeur française.
 */
export async function versionEnLangue<C extends Traduisible>(
  collection: C,
  docFr: DataFromCollectionSlug<C>,
  langue: CodeLangue,
): Promise<EnLangue<DataFromCollectionSlug<C>>> {
  if (langue === FRANCAIS) return { doc: docFr, langue: FRANCAIS }
  const payload = await getPayloadClient()
  const enL = await payload
    .findByID({ collection, id: docFr.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
    .catch(() => null)
  return (enL as { traduction?: string | null } | null)?.traduction === 'validee'
    ? { doc: enL as DataFromCollectionSlug<C>, langue }
    : { doc: docFr, langue: FRANCAIS }
}

/** Règle 2 : chaque élément d'une liste dans sa langue, en une seule requête. */
export async function versionsEnLangue<C extends Traduisible>(
  collection: C,
  docsFr: DataFromCollectionSlug<C>[],
  langue: CodeLangue,
): Promise<EnLangue<DataFromCollectionSlug<C>>[]> {
  if (langue === FRANCAIS || docsFr.length === 0) return docsFr.map((doc) => ({ doc, langue: FRANCAIS }))
  const payload = await getPayloadClient()
  const res = await payload.find({
    collection,
    where: { id: { in: docsFr.map((d) => d.id) } },
    locale: langue,
    fallbackLocale: false,
    depth: 0,
    limit: docsFr.length,
    overrideAccess: true,
  })
  const valides = new Map(
    res.docs
      .filter((d) => (d as { traduction?: string | null }).traduction === 'validee')
      .map((d) => [d.id, d as DataFromCollectionSlug<C>]),
  )
  return docsFr.map((doc) =>
    valides.has(doc.id) ? { doc: valides.get(doc.id)!, langue } : { doc, langue: FRANCAIS },
  )
}

/** Langues où chaque document est montrable : le français, plus L validée ET activée (I14, I17). */
export async function languesDisponibles(
  collection: Traduisible,
  ids: number[],
  languesSite: readonly CodeLangue[],
): Promise<Map<number, CodeLangue[]>> {
  const resultat = new Map<number, CodeLangue[]>(ids.map((id) => [id, [FRANCAIS]]))
  if (ids.length === 0) return resultat
  const payload = await getPayloadClient()
  for (const langue of languesSite.filter((l) => l !== FRANCAIS)) {
    const res = await payload.find({
      collection,
      where: { and: [{ id: { in: ids } }, { traduction: { equals: 'validee' } }] },
      locale: langue,
      fallbackLocale: false,
      depth: 0,
      limit: ids.length,
      select: { traduction: true },
      overrideAccess: true,
    } as never)
    for (const d of res.docs as Array<{ id: number }>) resultat.get(d.id)?.push(langue)
  }
  return resultat
}

export interface TexteEnLangue {
  texte: string
  langue: CodeLangue
}

/** Règle 3 : petit texte traduit s'il existe, sinon le français, marqué. */
function texteEnLangue(enL: string | null | undefined, fr: string, langue: CodeLangue): TexteEnLangue {
  return enL ? { texte: enL, langue } : { texte: fr, langue: FRANCAIS }
}

export interface ElementMenu {
  label: TexteEnLangue
  href: string
  enfants: Array<{ label: TexteEnLangue; href: string }>
}

/**
 * Menu dans la langue L. `href` SANS préfixe de langue (l'appelant applique
 * `cheminLangue`) ; items « page » résolus par `pages` (I4, pagesDuMenu).
 * Les lignes de tableau sont communes aux langues : on apparie par leur `id`.
 */
export async function menuEnLangue(id: IdCommune, langue: CodeLangue, pages: Map<number, Page>): Promise<ElementMenu[]> {
  const fr = await menuCommune(id)
  if (!fr) return []
  const payload = await getPayloadClient()
  const enL =
    langue === FRANCAIS
      ? fr
      : await payload.findByID({ collection: 'menus', id: fr.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
  const labelsL = new Map<string, string | null | undefined>()
  for (const item of enL.items ?? []) {
    if (item.id) labelsL.set(item.id, item.label)
    for (const e of item.enfants ?? []) if (e.id) labelsL.set(e.id, e.label)
  }
  const href = (page: unknown, url: string | null | undefined) => {
    const p = typeof page === 'number' ? pages.get(page) : null
    return p ? `/${p.slug}` : (url ?? '')
  }
  return (fr.items ?? [])
    .map((item) => ({
      label: texteEnLangue(labelsL.get(item.id ?? ''), item.label ?? '', langue),
      href: href(item.page, item.url),
      enfants: (item.enfants ?? [])
        .map((e) => ({ label: texteEnLangue(labelsL.get(e.id ?? ''), e.label ?? '', langue), href: href(e.page, e.url) }))
        .filter((e) => e.href),
    }))
    .filter((e) => e.href)
}

/** Nom et horaires de la commune dans la langue L (règle 3). */
export async function communeEnLangue(commune: Commune, langue: CodeLangue) {
  const enL =
    langue === FRANCAIS
      ? commune
      : await (await getPayloadClient()).findByID({ collection: 'communes', id: commune.id, locale: langue, fallbackLocale: false, depth: 0, overrideAccess: true })
  return {
    nom: texteEnLangue(enL.nom, commune.nom, langue),
    horaires: commune.horaires ? texteEnLangue(enL.horaires, commune.horaires, langue) : null,
  }
}

/** Domaines de la commune avec leur langue (canoniques, hreflang, sitemap). */
export async function domainesCommune(id: IdCommune): Promise<DomaineLangue[]> {
  const payload = await getPayloadClient()
  const res = await payload.find({ collection: 'domaines', where: { commune: { equals: id } }, depth: 0, limit: 50, overrideAccess: true })
  return res.docs.map((d) => ({ hostname: d.hostname, langue: d.langue ?? FRANCAIS, canonique: d.canonique === true }))
}

/** Sous-domaine de la plateforme (repli quand aucun domaine canonique n'existe). */
export function basePlateforme(slug: string): string {
  const plateforme = process.env.PLATFORM_DOMAIN
  return plateforme ? `https://${slug}.${plateforme}` : ''
}
```

Réécrire `baseUrlsPubliques` avec `baseCanonique(FRANCAIS, await domainesCommune(id), basePlateforme(slug))` et supprimer `domaineCanonique` (seuls `baseUrlsPubliques`, le sitemap et robots l'utilisent — vérifier avec `grep -rn domaineCanonique src`). Étendre `mediaDe(id, ref, langue: CodeLangue = FRANCAIS)` : après le contrôle de commune, si `langue !== FRANCAIS`, relire le média en `locale: langue, fallbackLocale: false` et renvoyer `{ ...media, alt: altL || media.alt, langueAlt: altL ? langue : FRANCAIS }` ; en français, `langueAlt: FRANCAIS`.

- [ ] **Step 5: Write `src/lib/langues-site.ts` and `src/lib/langue-courante.ts`**

`src/lib/langues-site.ts` :

```ts
import type { Commune } from '../payload-types'

import { FRANCAIS, estCodeLangue, type CodeLangue } from './langues'

/** Langues du site : le français (toujours actif) puis celles activées par la commune. */
export function languesDuSite(commune: Commune): CodeLangue[] {
  const regionales = ((commune.langues as string[] | null) ?? []).filter(estCodeLangue).filter((l) => l !== FRANCAIS)
  return [FRANCAIS, ...regionales]
}
```

`src/lib/langue-courante.ts` :

```ts
import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'

import { dictionnaire, type Dictionnaire } from '../i18n'
import { cheminSansPrefixe, choisirLangue } from './adresses'
import { resolveSite, type Site } from './commune'
import { type CodeLangue } from './langues'
import { languesDuSite } from './langues-site'

export { languesDuSite }

export interface ContexteLangue {
  site: Site
  langue: CodeLangue
  languesSite: CodeLangue[]
  t: Dictionnaire
  /** Chemin demandé sans préfixe de langue, requête comprise (sélecteur de langue). */
  chemin: string
}

/**
 * Contexte de langue d'une requête (spec § 3) : mémoïsé par requête, partagé
 * par le layout de [lang], ses pages et leurs generateMetadata. Lève 404
 * (langue non activée, I14) ou 308 (préfixe égal à la langue du domaine).
 */
export const contexteLangue = cache(async (param: string): Promise<ContexteLangue | null> => {
  const site = await resolveSite()
  if (!site) return null
  const languesSite = languesDuSite(site.commune)
  const cheminDemande = (await headers()).get('x-pdlm-chemin') ?? '/'
  const decision = choisirLangue({ param, langueRacine: site.langueRacine, languesSite, cheminDemande })
  if (decision.type === 'introuvable') notFound()
  if (decision.type === 'rediriger') permanentRedirect(decision.vers)
  return {
    site,
    langue: decision.langue,
    languesSite,
    t: dictionnaire(decision.langue),
    chemin: cheminSansPrefixe(cheminDemande).reste,
  }
})
```

- [ ] **Step 6: Run tests**

Run: `npm run test:int && npm run test:unit && npx tsc --noEmit`
Expected: PASS. (Les pages ne sont pas encore sous `[lang]` : `tsc` doit passer car `resolveCommune`, `communeDuHost`, `baseUrlsPubliques` gardent leur signature.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/commune.ts src/lib/contenu.ts src/lib/langues-site.ts src/lib/langue-courante.ts tests/int/contenu-langue.int.spec.ts
git commit -m "Multilingue — lectures publiques par langue (règles d'affichage, I17, langue du domaine)"
```

---

### Task 7: Front public sous `[lang]` — layout, pages, sélecteur, mention « non traduit »

**Files:**
- Move (`git mv`) : `src/app/(frontend)/{layout.tsx,page.tsx,[slug],actualites,agenda,documents,mesure-d-audience}` → `src/app/(frontend)/[lang]/…`
- Stay: `src/app/(frontend)/{styles.css,sitemap.xml,robots.txt,mesure}` (hors `[lang]`)
- Modify: toutes les pages déplacées, `src/components/{Navigation,PiedDePage,BandeauAlerte,MediaImage}.tsx`, `src/app/(frontend)/mesure/opposition/route.ts`, `src/lib/mesure/opposition.ts`
- Create: `src/components/SelecteurLangue.tsx`, `src/components/ContenuEnLangue.tsx`
- Modify: `src/app/(frontend)/styles.css` (styles du sélecteur et de la mention)
- Test: `tests/unit/mesure-opposition.spec.ts` (ajout `cheminRetour`), `tests/e2e/frontend.e2e.spec.ts` (doit rester vert)

**Interfaces:**
- Consumes: `contexteLangue`, `languesDuSite` (tâche 6) ; `cheminLangue` (tâche 2) ; `versionEnLangue`, `versionsEnLangue`, `menuEnLangue`, `communeEnLangue`, `mediaDe` (tâche 6) ; `formaterDate(date, langue, …)` (tâche 1).
- Produces:
  - `<ContenuEnLangue langueContenu langue t>` : rien si `langueContenu === langue` ; sinon mention `<p lang={langue} class="mention-non-traduit">` + `<div lang="fr">`.
  - `<SelecteurLangue ctx>` : `<nav aria-label>` de liens simples, `lang`, `hreflang`, `aria-current`.
  - `cheminRetour(valeur: unknown): string` (opposition, liste blanche).
  - Type des props de page : `{ params: Promise<{ lang: string; slug?: string }>; searchParams?: … }`.

- [ ] **Step 1: Write the failing unit test — `cheminRetour`**

Ajouter à `tests/unit/mesure-opposition.spec.ts` :

```ts
import { cheminRetour } from '@/lib/mesure/opposition'

describe('cheminRetour (formulaire d’opposition)', () => {
  it('garde la page d’information dans sa langue', () => {
    expect(cheminRetour('/mesure-d-audience')).toBe('/mesure-d-audience')
    expect(cheminRetour('/co/mesure-d-audience')).toBe('/co/mesure-d-audience')
  })

  it('refuse tout autre chemin (pas de redirection ouverte)', () => {
    for (const v of ['//evil.fr', 'https://evil.fr', '/co/../admin', '/xx/mesure-d-audience', null, 42]) {
      expect(cheminRetour(v), String(v)).toBe('/mesure-d-audience')
    }
  })
})
```

Run: `npm run test:unit -- tests/unit/mesure-opposition.spec.ts` → FAIL (`cheminRetour` absent).

- [ ] **Step 2: Implement `cheminRetour` and use it in the route**

Dans `src/lib/mesure/opposition.ts` :

```ts
import { CODES_LANGUES } from '../langues'

const RETOUR = new RegExp(`^/(?:(?:${CODES_LANGUES.join('|')})/)?mesure-d-audience$`)

/** Retour après opposition : la page d'information, dans la langue d'où vient le visiteur. */
export function cheminRetour(valeur: unknown): string {
  return typeof valeur === 'string' && RETOUR.test(valeur) ? valeur : '/mesure-d-audience'
}
```

Dans `src/app/(frontend)/mesure/opposition/route.ts` : `Location: cheminRetour(formulaire?.get('retour'))`.

Run: `npm run test:unit` → PASS.

- [ ] **Step 3: Move the routes**

```bash
cd "src/app/(frontend)" && mkdir -p "[lang]" && git mv layout.tsx page.tsx "[slug]" actualites agenda documents mesure-d-audience "[lang]/" && cd -
```

Dans `[lang]/layout.tsx`, l'import devient `import '../styles.css'`.

- [ ] **Step 4: Write the two new components**

`src/components/ContenuEnLangue.tsx` :

```tsx
import type { Dictionnaire } from '@/i18n'
import type { CodeLangue } from '@/lib/langues'

/**
 * Règle 1 : un contenu non traduit s'affiche ENTIER en français, dans un
 * conteneur lang="fr", précédé d'une mention écrite dans la langue affichée
 * (RGAA 8.7 ; l'inverse de l'anti-modèle qui déclare breton du français).
 */
export function ContenuEnLangue({
  langueContenu,
  langue,
  t,
  children,
}: {
  langueContenu: CodeLangue
  langue: CodeLangue
  t: Dictionnaire
  children: React.ReactNode
}) {
  if (langueContenu === langue) return <>{children}</>
  return (
    <>
      <p className="mention-non-traduit" lang={langue}>
        {t.nonTraduit}
      </p>
      <div lang={langueContenu}>{children}</div>
    </>
  )
}
```

`src/components/SelecteurLangue.tsx` :

```tsx
import { cheminLangue } from '@/lib/adresses'
import type { ContexteLangue } from '@/lib/langue-courante'
import { langueDe } from '@/lib/langues'

/** Sélecteur de langue (spec § 4) : liens simples, sans JavaScript ; seulement si 2 langues ou plus. */
export function SelecteurLangue({ ctx }: { ctx: ContexteLangue }) {
  if (ctx.languesSite.length < 2) return null
  return (
    <nav aria-label={ctx.t.selecteurLangue} className="selecteur-langue">
      <ul>
        {ctx.languesSite.map((code) => (
          <li key={code}>
            <a
              href={cheminLangue(ctx.chemin, code, ctx.site.langueRacine)}
              lang={code}
              hrefLang={code}
              aria-current={code === ctx.langue ? 'true' : undefined}
            >
              {langueDe(code).nomNatif}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 5: Rewrite the layout — `src/app/(frontend)/[lang]/layout.tsx`**

```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'

import { BandeauAlerte } from '@/components/BandeauAlerte'
import { Navigation } from '@/components/Navigation'
import { PiedDePage } from '@/components/PiedDePage'
import { SelecteurLangue } from '@/components/SelecteurLangue'
import { cheminLangue } from '@/lib/adresses'
import { alertesActives, communeEnLangue, menuCommune, menuEnLangue, pagesDuMenu, versionsEnLangue } from '@/lib/contenu'
import { contexteLangue } from '@/lib/langue-courante'
import { siteMesure } from '@/lib/mesure/etat'
import { COOKIE_OPPOSITION, estOppose } from '@/lib/mesure/opposition'

import '../styles.css'

interface Props {
  children: React.ReactNode
  params: Promise<{ lang: string }>
}

/** Titre et description par défaut, dans la langue affichée (template : cf. recette Lighthouse J9). */
export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) return { title: 'pdlm' }
  const { nom } = await communeEnLangue(ctx.site.commune, ctx.langue)
  return {
    title: { default: nom.texte, template: `%s — ${nom.texte}` },
    description: ctx.t.descriptionSite(nom.texte),
  }
}

/** Layout public : commune, langue du domaine et langue affichée résolues une fois par requête. */
export default async function LayoutLangue({ children, params }: Props) {
  const ctx = await contexteLangue((await params).lang)
  if (!ctx) notFound()
  const { commune, langueRacine } = ctx.site
  const lien = (chemin: string) => cheminLangue(chemin, ctx.langue, langueRacine)

  const menuFr = await menuCommune(commune.id)
  const idsPages = (menuFr?.items ?? [])
    .flatMap((item) => [item.page, ...(item.enfants ?? []).map((e) => e.page)])
    .filter((v): v is number => typeof v === 'number')
  const pages = await pagesDuMenu(commune.id, idsPages)
  const [alertesFr, elements, identite] = await Promise.all([
    alertesActives(commune.id),
    menuEnLangue(commune.id, ctx.langue, pages),
    communeEnLangue(commune, ctx.langue),
  ])
  const alertes = await versionsEnLangue('alertes', alertesFr, ctx.langue)

  const couleurPrincipale = commune.apparence?.couleurPrincipale || undefined
  const couleurAccent = commune.apparence?.couleurAccent || undefined
  const oppose = estOppose((await cookies()).get(COOKIE_OPPOSITION)?.value)
  const siteUmami = oppose ? null : siteMesure(commune)

  return (
    <html lang={ctx.langue}>
      <body style={{ '--couleur-principale': couleurPrincipale, '--couleur-accent': couleurAccent } as React.CSSProperties}>
        <a href="#contenu" className="lien-evitement">
          {ctx.t.evitement}
        </a>
        <BandeauAlerte alertes={alertes} langue={ctx.langue} />
        <header className="entete-site">
          <div className="entete-site__marque">
            <a href={lien('/')} className="entete-site__titre" lang={identite.nom.langue !== ctx.langue ? identite.nom.langue : undefined}>
              {identite.nom.texte}
            </a>
          </div>
          <SelecteurLangue ctx={ctx} />
          <Navigation elements={elements} ctx={ctx} />
        </header>
        <main id="contenu">{children}</main>
        <PiedDePage commune={commune} identite={identite} ctx={ctx} />
        {siteUmami && (
          <script defer src="/mesure/script.js" data-website-id={siteUmami} data-host-url="/mesure"
            data-exclude-search="true" data-exclude-hash="true" data-do-not-track="true" data-fetch-credentials="same-origin" />
        )}
      </body>
    </html>
  )
}
```

(Garder le commentaire I20 du script de mesure et le commentaire sur les couleurs de l'ancien layout.)

- [ ] **Step 6: Rewrite the components**

- **`Navigation`** : props `{ elements: ElementMenu[]; ctx: ContexteLangue }`. Toutes les entrées en `<a>` (plus de `next/link`, écart n° 6). `href={cheminLangue(e.href, ctx.langue, ctx.site.langueRacine)}` ; libellé `<a lang={e.label.langue !== ctx.langue ? e.label.langue : undefined}>` (idem `<summary>` et enfants) ; rubriques fixes `ctx.t.accueil`, `ctx.t.actualites`, `ctx.t.agenda`, `ctx.t.documents` ; `aria-label={ctx.t.menuPrincipal}`.
- **`PiedDePage`** : props `{ commune; identite: { nom: TexteEnLangue; horaires: TexteEnLangue | null }; ctx }`. Textes fixes depuis `ctx.t` (`horaires`, `contact`, `telephone`, `courriel`, `informations`, `mentionsLegales`, `confidentialite`, `accessibilite`, `mesureAudience`, `propulsePar`, `logicielLibre`) ; liens légaux via `cheminLangue` ; `lang` posé sur le nom et les horaires quand ils sont en repli.
- **`BandeauAlerte`** : props `{ alertes: EnLangue<Alerte>[]; langue: CodeLangue }` ; `<li lang={a.langue !== langue ? a.langue : undefined}>{a.doc.message}</li>`.
- **`MediaImage`** : `lang={'langueAlt' in media && media.langueAlt !== langueAffichee ? media.langueAlt : undefined}` sur `<img>` — ajouter une prop facultative `langueAffichee?: CodeLangue`.

- [ ] **Step 7: Rewrite the pages**

Chaque page lit `params.lang`, appelle `contexteLangue`, choisit la version, enveloppe, et passe par `cheminLangue` pour tout lien. Les deux cas types, complets :

`[lang]/[slug]/page.tsx` :

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ContenuEnLangue } from '@/components/ContenuEnLangue'
import { RenduBlocs } from '@/components/RenduBlocs'
import { adressesAlternatives } from '@/lib/adresses'
import { basePlateforme, domainesCommune, languesDisponibles, pageParSlug, versionEnLangue } from '@/lib/contenu'
import { contexteLangue } from '@/lib/langue-courante'

interface Props {
  params: Promise<{ lang: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) return {}
  const fr = await pageParSlug(ctx.site.commune.id, slug)
  if (!fr) return {}
  const { doc, langue } = await versionEnLangue('pages', fr, ctx.langue)
  const dispo = await languesDisponibles('pages', [fr.id], ctx.languesSite)
  return {
    title: doc.metaTitle || doc.titre,
    description: doc.metaDescription || undefined,
    alternates: adressesAlternatives({
      chemin: fr.slug === 'accueil' ? '/' : `/${fr.slug}`,
      langueContenu: langue,
      languesDisponibles: dispo.get(fr.id) ?? ['fr'],
      domaines: await domainesCommune(ctx.site.commune.id),
      basePlateforme: basePlateforme(ctx.site.commune.slug),
    }),
  }
}

/** Page CMS générique (version publiée), dans la langue affichée si sa traduction est validée. */
export default async function PageGenerique({ params }: Props) {
  const { lang, slug } = await params
  const ctx = await contexteLangue(lang)
  if (!ctx) notFound()
  const fr = await pageParSlug(ctx.site.commune.id, slug)
  if (!fr) notFound()
  const { doc, langue } = await versionEnLangue('pages', fr, ctx.langue)
  return (
    <ContenuEnLangue langueContenu={langue} langue={ctx.langue} t={ctx.t}>
      <RenduBlocs blocs={doc.blocs ?? []} />
    </ContenuEnLangue>
  )
}
```

`[lang]/actualites/page.tsx` (liste, règle 2) — les points qui changent :

```tsx
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const ctx = await contexteLangue((await params).lang)
  return ctx ? { title: ctx.t.actualites, alternates: await alternatesRubrique(ctx, '/actualites') } : {}
}
// …
  const res = await actualitesCommune(ctx.site.commune.id, { page: numeroPage })
  const actus = await versionsEnLangue('actualites', res.docs, ctx.langue)
  const lien = (c: string) => cheminLangue(c, ctx.langue, ctx.site.langueRacine)
  // …
          {actus.map(({ doc: actu, langue }) => (
            <li key={actu.id} className="carte-actu" lang={langue !== ctx.langue ? langue : undefined}>
              <h2><a href={lien(`/actualites/${actu.slug}`)}>{actu.titre}</a></h2>
              {actu.datePublication && (
                <p className="carte-actu__date" lang={ctx.langue}>
                  <time dateTime={actu.datePublication}>{formaterDate(actu.datePublication, ctx.langue, { dateStyle: 'long' })}</time>
                </p>
              )}
              <p>{actu.resume}</p>
            </li>
          ))}
```

(La date est de l'interface : toujours dans la langue affichée, d'où `lang={ctx.langue}` sur son paragraphe même dans un élément en repli.) Pagination : `ctx.t.pagination`, `ctx.t.precedent`, `ctx.t.suivant`, `ctx.t.pageSur(String(n), String(total))`, liens via `lien()`.

Ajouter dans `src/lib/langue-courante.ts` l'aide commune aux rubriques (interface toujours traduite → disponibles dans toutes les langues du site) :

```ts
/** `alternates` d'une rubrique fixe (/actualites, /agenda, /documents, /mesure-d-audience). */
export async function alternatesRubrique(ctx: ContexteLangue, chemin: string) {
  return adressesAlternatives({
    chemin,
    langueContenu: ctx.langue,
    languesDisponibles: ctx.languesSite,
    domaines: await domainesCommune(ctx.site.commune.id),
    basePlateforme: basePlateforme(ctx.site.commune.slug),
  })
}
```

Pages restantes, même motif :
- **`[lang]/page.tsx`** (accueil) : `pageAccueil` + `versionEnLangue('pages', …)` + `ContenuEnLangue` ; sans page d'accueil : `ctx.t.bienvenue(nom)`, `ctx.t.enConstruction`, `ctx.t.consulter` et deux liens `lien('/actualites')`, `lien('/agenda')`. `generateMetadata` : `alternates` de la page `accueil` (chemin `'/'`) si elle existe, sinon `alternatesRubrique(ctx, '/')`.
- **`[lang]/actualites/[slug]/page.tsx`** : `versionEnLangue('actualites', …)` ; l'`<article>` entier dans `ContenuEnLangue` ; image `mediaDe(id, actu.image, ctx.langue)` ; date via `formaterDate(…, ctx.langue, …)` ; `alternates` avec `languesDisponibles('actualites', [id], ctx.languesSite)` et chemin `/actualites/${slug}`.
- **`[lang]/agenda/page.tsx`** : `versionsEnLangue('evenements', …)` ; chaque `<li>` porte `lang` s'il est en repli ; `ctx.t.lieu(lieu)`, `ctx.t.sInscrire`, `ctx.t.aucunEvenement` ; dates dans la langue affichée.
- **`[lang]/documents/page.tsx`** : catégories depuis `ctx.t.categories` (supprimer la constante `CATEGORIES` locale) ; `versionsEnLangue('documents', …)` pour les titres ; `ctx.t.conservation(d)` ; filtres via `lien('/documents?categorie=…')`.
- **`[lang]/mesure-d-audience/page.tsx`** : titre `ctx.t.mesureAudience` ; tout le texte actuel inchangé, enveloppé dans `<ContenuEnLangue langueContenu="fr" …>` (écart n° 7) ; le formulaire ajoute `<input type="hidden" name="retour" value={cheminLangue('/mesure-d-audience', ctx.langue, ctx.site.langueRacine)} />`.

Supprimer tout `import Link from 'next/link'` du front public (`grep -rn "next/link" "src/app/(frontend)" src/components` doit être vide).

- [ ] **Step 8: Styles**

Dans `src/app/(frontend)/styles.css`, ajouter (mêmes variables que l'en-tête ; focus visible déjà global) :

```css
.selecteur-langue ul {
  display: flex;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.selecteur-langue a[aria-current='true'] {
  font-weight: 700;
  text-decoration: none;
}
.mention-non-traduit {
  border-inline-start: 4px solid var(--couleur-accent, currentColor);
  margin: 1rem auto;
  max-width: var(--largeur-texte, 70ch);
  padding: 0.5rem 1rem;
}
```

(Vérifier le nom réel de la variable de largeur dans `styles.css` et reprendre celle qui existe.)

- [ ] **Step 9: Run everything**

```bash
npm run lint -- --ignore-pattern 'docs/recherche/**' && npx tsc --noEmit && npm run test:unit && npm run test:int
DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e npm run seed
DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e npm run test:e2e
```

Expected: lint 0 erreur, tsc 0, unit et int PASS, **e2e existant 14/14** (le site français doit être inchangé pour une commune sans autre langue). Si un e2e casse, c'est une régression de cette tâche : la corriger avant de committer. Vérifier aussi à la main qu'une page française rendue n'a toujours aucun `<script>` ajouté par rapport à `main` (comparer `curl -s http://localhost:3000/ | grep -c '<script'` entre les deux branches).

- [ ] **Step 10: Commit**

```bash
git add -A "src/app/(frontend)" src/components src/lib/langue-courante.ts src/lib/mesure/opposition.ts tests/unit/mesure-opposition.spec.ts
git commit -m "Multilingue — front public sous [lang] : langue affichée, repli marqué, sélecteur de langue"
```

---

### Task 8: Référencement — sitemap et robots par domaine et par langue

**Files:**
- Modify: `src/app/(frontend)/sitemap.xml/route.ts`, `src/app/(frontend)/robots.txt/route.ts`
- Test: `tests/int/sitemap-langues.int.spec.ts`

**Interfaces:**
- Consumes: `sitemapXml`, `baseCanonique` (tâche 2) ; `resolveSite`, `languesDuSite`, `languesDisponibles`, `domainesCommune`, `basePlateforme` (tâche 6).
- Produces: `construireSitemap(site: Site): Promise<string>` exportée depuis `src/lib/contenu.ts` (testable sans en-têtes), utilisée par la route.

- [ ] **Step 1: Write the failing test — `tests/int/sitemap-langues.int.spec.ts`**

```ts
import type { Payload } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { siteDuHost } from '@/lib/commune'
import { construireSitemap } from '@/lib/contenu'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let c: { id: number; host: string }

beforeAll(async () => {
  payload = await getPayloadClient()
  c = await creerCommuneActive(payload, 'sitemap-langues')
  await payload.update({ collection: 'communes', id: c.id, data: { langues: ['co'] }, overrideAccess: true })
  await payload.create({ collection: 'domaines', data: { hostname: `${c.host}.corsica`, commune: c.id, langue: 'co', canonique: true }, overrideAccess: true })
  const p = await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Marché', slug: 'marche', _status: 'published', blocs: [{ blockType: 'contact' }] } })
  await payload.update({ collection: 'pages', id: p.id, locale: 'co', overrideAccess: true,
    data: { titre: 'Mercatu', blocs: [{ blockType: 'contact' }], traduction: 'validee', _status: 'published' } })
  await payload.create({ collection: 'pages', overrideAccess: true,
    data: { tenant: c.id, titre: 'Démarches', slug: 'demarches', _status: 'published', blocs: [{ blockType: 'contact' }] } })
})

afterAll(async () => {
  await payload.delete({ collection: 'pages', where: { tenant: { equals: c.id } }, overrideAccess: true })
  await supprimerCommuneTest(payload, c.id)
})

describe('sitemap par domaine', () => {
  it('domaine français : pages françaises, avec leur version corse en alternative', async () => {
    const xml = await construireSitemap((await siteDuHost(c.host))!)
    expect(xml).toContain(`<loc>https://${c.host}/marche</loc>`)
    expect(xml).toContain(`<loc>https://${c.host}/demarches</loc>`)
    expect(xml).toContain(`hreflang="co" href="https://${c.host}.corsica/marche"`)
    expect(xml).not.toContain(`<loc>https://${c.host}.corsica`)
  })

  it('domaine corse : seulement ce qui existe en corse (rubriques + page validée)', async () => {
    const xml = await construireSitemap((await siteDuHost(`${c.host}.corsica`))!)
    expect(xml).toContain(`<loc>https://${c.host}.corsica/marche</loc>`)
    expect(xml).toContain(`<loc>https://${c.host}.corsica/actualites</loc>`)
    expect(xml).not.toContain('demarches')
  })

  it('I14 : langue retirée → plus rien en corse', async () => {
    await payload.delete({ collection: 'domaines', where: { hostname: { equals: `${c.host}.corsica` } }, overrideAccess: true })
    await payload.update({ collection: 'communes', id: c.id, data: { langues: [] }, overrideAccess: true })
    const xml = await construireSitemap((await siteDuHost(c.host))!)
    expect(xml).not.toContain('hreflang="co"')
    expect(xml).not.toContain('/co/')
  })
})
```

Run: `npm run test:int -- tests/int/sitemap-langues.int.spec.ts` → FAIL (`construireSitemap` absent).

- [ ] **Step 2: Implement `construireSitemap` in `src/lib/contenu.ts`**

```ts
/** Sitemap du domaine d'un site (spec § 3) : pages, actualités et rubriques, par langue disponible. */
export async function construireSitemap(site: Site): Promise<string> {
  const { commune, langueRacine } = site
  const languesSite = languesDuSite(commune)
  const payload = await getPayloadClient()
  const pages = await payload.find({
    collection: 'pages',
    where: { and: [baseCommune(commune.id), { _status: { equals: 'published' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  const actus = await actualitesCommune(commune.id, { limite: 500 })
  const [dispoPages, dispoActus] = await Promise.all([
    languesDisponibles('pages', pages.docs.map((p) => p.id), languesSite),
    languesDisponibles('actualites', actus.docs.map((a) => a.id), languesSite),
  ])
  const accueil = pages.docs.find((p) => p.slug === 'accueil')
  const ressources: RessourceSitemap[] = [
    { chemin: '/', langues: accueil ? (dispoPages.get(accueil.id) ?? ['fr']) : languesSite, priorite: '1.0' },
    ...pages.docs
      .filter((p) => p.slug !== 'accueil')
      .map((p) => ({ chemin: `/${p.slug}`, langues: dispoPages.get(p.id) ?? ['fr'], priorite: '0.7' })),
    { chemin: '/actualites', langues: languesSite, priorite: '0.8' },
    ...actus.docs.map((a) => ({ chemin: `/actualites/${a.slug}`, langues: dispoActus.get(a.id) ?? ['fr'], priorite: '0.6' })),
    { chemin: '/agenda', langues: languesSite, priorite: '0.6' },
    { chemin: '/documents', langues: languesSite, priorite: '0.5' },
  ]
  return sitemapXml(ressources, langueRacine, await domainesCommune(commune.id), basePlateforme(commune.slug))
}
```

Imports à ajouter dans `contenu.ts` : `languesDuSite` depuis `./langues-site`, `type Site` depuis `./commune`, `sitemapXml` et `type RessourceSitemap` depuis `./adresses`.

- [ ] **Step 3: Routes**

`sitemap.xml/route.ts` :

```ts
import { construireSitemap } from '@/lib/contenu'
import { resolveSite } from '@/lib/commune'

export const dynamic = 'force-dynamic'

const VIDE = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'

/** Sitemap par host : les adresses dont le canonique est sur ce domaine (spec multilingue § 3). */
export async function GET() {
  const site = await resolveSite()
  const xml = site ? await construireSitemap(site) : VIDE
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
```

`robots.txt/route.ts` : `Sitemap:` = origine de `baseCanonique(site.langueRacine, await domainesCommune(id), basePlateforme(slug))` + `/sitemap.xml` (origine seule : `https://pigna.fr/co` n'a pas de sitemap propre) ; rien si pas de site.

- [ ] **Step 4: Run tests**

Run: `npm run test:int && npm run test:unit && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contenu.ts "src/app/(frontend)/sitemap.xml" "src/app/(frontend)/robots.txt" tests/int/sitemap-langues.int.spec.ts
git commit -m "Multilingue — sitemap et robots par domaine et par langue (hreflang, I14)"
```

---

### Task 9: Données de démonstration en corse

**Files:**
- Modify: `src/seed/index.ts`, `src/seed/contenu-demo.ts`

**Interfaces:**
- Consumes: champs `langues`, `langue`, `traduction` (tâche 3).
- Produces (données du seed, dont dépend l'e2e de la tâche 10) : Valvert a `langues: ['co']` et un domaine `valvert.corsica` (langue `co`, canonique) ; pages Valvert `accueil` (traduite, `validee`), `marche` (traduite, `validee`), `demarches` (non traduite) ; menu Valvert : « Marché » (libellé corse « Mercatu ») et « Démarches » (non traduit) ; nom corse de la commune : « Valverde ».

- [ ] **Step 1: Extend the seed**

Dans `src/seed/index.ts`, `upsertDomaine` accepte `langue?: string` (défaut `'fr'`) ; après la création des domaines de Valvert :

```ts
  // Multilingue (démo) : Valvert active le corse et reçoit un domaine .corsica
  await payload.update({ collection: 'communes', id: valvert.id, data: { langues: ['co'] }, overrideAccess: true })
  await payload.update({ collection: 'communes', id: valvert.id, locale: 'co', data: { nom: 'Valverde' }, overrideAccess: true })
  await upsertDomaine(payload, { hostname: 'valvert.corsica', commune: valvert.id, canonique: true, langue: 'co' })
```

Dans `src/seed/contenu-demo.ts`, après l'accueil de Valvert : une fonction `traduire(payload, collection, id, data)` qui fait `payload.update({ …, locale: 'co', data: { ...data, traduction: 'validee', _status: 'published' } })` **seulement si** la version corse n'est pas déjà validée (lecture `fallbackLocale: false`) — le seed reste idempotent. Puis :
- accueil Valvert en corse : hero `{ titre: 'Benvenuti à Valverde', sousTitre: 'Situ ufficiale di u cumunu di Valverde.' }` ;
- page `marche` : FR « Marché du samedi » (texte riche « Le marché se tient chaque samedi matin sur la place. »), CO « Mercatu di u sabbatu » (« U mercatu si tene ogni sabbatu matina nant’à a piazza. ») ;
- page `demarches` : FR « Démarches », texte « Pour toute démarche, adressez-vous à la mairie. », jamais traduite ;
- menu Valvert (créé s'il n'existe pas) : items `{ label: 'Marché', page: <marche> }`, `{ label: 'Démarches', page: <demarches> }` ; en corse, seul le premier libellé : « Mercatu ».

Marquer les textes corses « provisoires, à relire » en commentaire.

- [ ] **Step 2: Run the seed twice on the e2e base (idempotence)**

```bash
export DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e
npm run seed && npm run seed
docker exec pdlm-postgres-1 psql -U postgres -d pdlm_e2e -c "select _locale, titre, traduction from pages_locales l join pages p on p.id = l._parent_id where p.slug in ('accueil','marche','demarches') order by 1,2"
```

Expected: 2 passages sans erreur ; lignes `fr` pour les 3 pages de Valvert (et l'accueil de Saint-Ex), `co` validée pour `accueil` et `marche` seulement, aucune ligne en double.

- [ ] **Step 3: Commit**

```bash
git add src/seed
git commit -m "Multilingue — démo : Valvert en corse (page validée, page non traduite, libellé non traduit)"
```

---

### Task 10: Bout en bout — préfixe, domaine propre, `lang`, sélecteur, 404, 308

**Files:**
- Modify: `playwright.config.ts` (résolution de `valvert.corsica`)
- Create: `tests/e2e/multilingue.e2e.spec.ts`

**Interfaces:**
- Consumes: données du seed (tâche 9) ; tout le front (tâches 7-8).

- [ ] **Step 1: Resolve the Corsican domain in Chromium — `playwright.config.ts`**

```ts
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        // Domaine propre de la démo (spec multilingue § 10, point 2) : pas de DNS,
        // pas de Caddy — Chromium résout valvert.corsica sur la boucle locale.
        // *.localhost résout déjà nativement (sous-domaines de la plateforme).
        launchOptions: { args: ['--host-resolver-rules=MAP valvert.corsica 127.0.0.1'] },
      },
    },
```

- [ ] **Step 2: Write the tests — `tests/e2e/multilingue.e2e.spec.ts`**

```ts
import { expect, test } from '@playwright/test'

/**
 * Multilingue, contre `npm run seed` (Valvert : corse activé, valvert.corsica
 * en corse ; `marche` traduite et validée, `demarches` non traduite).
 * valvert.localhost = sous-domaine de la plateforme (français à la racine).
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const FR = `http://valvert.localhost:${PORT}`
const CO = `http://valvert.corsica:${PORT}`

test.describe('Multilingue', () => {
  test('page traduite sous /co/ : tout en corse', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('main')).toContainText('Mercatu di u sabbatu')
    await expect(page.locator('.mention-non-traduit')).toHaveCount(0)
  })

  test('page non traduite sous /co/ : html en corse, contenu français marqué, mention en corse', async ({ page }) => {
    await page.goto(`${FR}/co/demarches`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('.mention-non-traduit')).toHaveAttribute('lang', 'co')
    const contenu = page.locator('main [lang="fr"]')
    await expect(contenu).toContainText('adressez-vous à la mairie')
  })

  test('libellé de menu non traduit : repli marqué lang="fr"', async ({ page }) => {
    await page.goto(`${FR}/co`)
    await expect(page.locator('#menu-principal a', { hasText: 'Mercatu' })).not.toHaveAttribute('lang', /.+/)
    await expect(page.locator('#menu-principal a', { hasText: 'Démarches' })).toHaveAttribute('lang', 'fr')
  })

  test('domaine propre : le corse à la racine, liens sans préfixe', async ({ page }) => {
    await page.goto(`${CO}/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'co')
    await expect(page.locator('main')).toContainText('Mercatu di u sabbatu')
    await expect(page.locator('#menu-principal a', { hasText: 'Mercatu' })).toHaveAttribute('href', '/marche')
  })

  test('sélecteur de langue : liens simples, lang, hreflang, aria-current', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    const nav = page.getByRole('navigation', { name: 'Lingua di u situ' })
    await expect(nav.locator('a[hreflang="fr"]')).toHaveAttribute('href', '/marche')
    await expect(nav.locator('a[hreflang="co"]')).toHaveAttribute('aria-current', 'true')
    await expect(nav.locator('a[hreflang="co"]')).toHaveAttribute('lang', 'co')
    await nav.locator('a[hreflang="fr"]').click()
    await expect(page).toHaveURL(`${FR}/marche`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr')
  })

  test('hreflang et canonique dans le <head>', async ({ page }) => {
    await page.goto(`${FR}/co/marche`)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://valvert.corsica/marche')
    await expect(page.locator('link[rel="alternate"][hreflang="fr"]')).toHaveAttribute('href', 'https://valvert.fr/marche')
    await page.goto(`${FR}/co/demarches`)
    await expect(page.locator('link[rel="alternate"][hreflang="co"]')).toHaveCount(0)
  })

  test('I14 : langue non activée → 404, jamais 500', async ({ request }) => {
    // Saint-Exupéry n'a pas activé le corse (hôte nu : DEFAULT_COMMUNE_SLUG)
    const reponse = await request.get('/co/actualites')
    expect(reponse.status()).toBe(404)
  })

  test('préfixe égal à la langue du domaine → 308 sans préfixe, requête gardée', async ({ request }) => {
    const reponse = await request.get(`${CO}/co/actualites?page=2`, { maxRedirects: 0 })
    expect(reponse.status()).toBe(308)
    expect(reponse.headers()['location']).toMatch(/^(http:\/\/valvert\.corsica:\d+)?\/actualites\?page=2$/)
    const fr = await request.get(`${FR}/fr`, { maxRedirects: 0 })
    expect(fr.status()).toBe(308)
  })

  test('/co sans barre finale : l’accueil corse', async ({ page }) => {
    const reponse = await page.goto(`${FR}/co`)
    expect(reponse?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Benvenuti à Valverde')
  })

  test('aucun JavaScript ajouté pour le multilingue', async ({ page }) => {
    const scripts = async (url: string) => {
      await page.goto(url)
      return page.locator('script[src]').evaluateAll((s) => s.map((e) => (e as HTMLScriptElement).src).filter((src) => !src.includes('/_next/')))
    }
    expect(await scripts(`${FR}/co/marche`)).toEqual(await scripts(`${FR}/marche`))
  })
})
```

`request` de Playwright ne passe pas par Chromium : `valvert.corsica` n'y est pas résolu. Pour les deux tests qui utilisent `request` sur `CO`, poser l'en-tête à la place : `request.get(\`http://127.0.0.1:${PORT}/co/actualites?page=2\`, { headers: { host: \`valvert.corsica:${PORT}\` }, maxRedirects: 0 })`. Ajuster aussi l'attente de `location` en conséquence.

- [ ] **Step 3: Run the e2e suite**

```bash
export DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e
npm run seed && npm run test:e2e
```

Expected: 14 anciens + 10 nouveaux PASS. Si le 308 arrive en 200 avec une balise de redirection (redirection levée après le début du streaming), déplacer l'appel à `contexteLangue` en tête de `generateMetadata` du layout (déjà le cas) et vérifier qu'aucun `Suspense` n'entoure le layout ; consigner le constat. Si les ressources `/_next/` sont bloquées pour `valvert.corsica` en dev (`allowedDevOrigins`), l'ajouter dans `next.config` pour le développement seulement : les tests ne dépendent pas du JavaScript client.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/multilingue.e2e.spec.ts
git commit -m "Multilingue — bout en bout : préfixe, domaine .corsica, lang, sélecteur, 404, 308"
```

---

### Task 11: Recette de la migration sur pile de type production, README

**Files:**
- Modify: `README.md` (section « Langues régionales »)

**Interfaces:**
- Consumes: tout.

- [ ] **Step 1: Recette migration (spec § 6) sur la pile `pdlm-prod`**

La pile de recette de la mesure d'audience (`docker compose -p pdlm-prod`, contenu réel créé à la main les 24-25/09) tourne sur l'image de `main`. Dans l'ordre, en notant chaque sortie dans le ledger :
1. `scripts/backup.sh` (sauvegarde v-main) ; noter le nom du fichier.
2. Instantané avant : `docker compose -p pdlm-prod run --rm --no-deps -v "$PWD/scripts:/app/scripts-recette" app node node_modules/payload/bin.js run scripts-recette/instantane-contenu.ts > avant.json` (si l'image n'embarque pas `tsx`, lancer le script depuis l'hôte avec `DATABASE_URI` pointant sur le Postgres de la pile, `NODE_ENV=production`).
3. Reconstruire les images depuis `multilingue-socle` (`docker compose -p pdlm-prod build`), puis `docker compose -p pdlm-prod up -d` : le service `migrate` applique la migration avant l'application.
4. Instantané après, `diff -u avant.json apres.json` : **vide** attendu.
5. À l'écran, avec l'utilisateur : se connecter, activer le corse sur une commune, lui ajouter un domaine corse, traduire une page, la valider ; la voir en corse sur `/co/…` et sur le domaine corse (Chrome `--host-resolver-rules`, comme le 24/09).
6. Retour arrière : `scripts/restore.sh <sauvegarde>` sur une pile repartie de l'image de `main`, instantané, `diff` avec `avant.json` : **vide** attendu.
7. Vérifier `select slug from pages where slug in ('fr','co','racine')` : aucun résultat (sinon ces pages deviennent inaccessibles, I16 — les renommer avant la mise en production).

- [ ] **Step 2: README**

Ajouter une section « Langues régionales » : activer une langue (fiche commune, « Langues du site ») ; domaine en langue régionale (champ « Langue servie à la racine », un canonique par langue) ; traduire (sélecteur de langue de l'admin, état « Validée ») ; ce que voit le visiteur (repli marqué) ; ajouter une langue au logiciel (ligne dans `src/lib/langues.ts`, dictionnaire, migration) ; limites v1 (slugs en français, statut de publication commun aux langues, liens internes des textes riches non préfixés) ; textes corses provisoires à faire relire ; résultat de la recette de migration (date, commande, résultat).

- [ ] **Step 3: Full verification**

```bash
npm run lint -- --ignore-pattern 'docs/recherche/**' && npx tsc --noEmit && npm run test:unit && npm run test:int
bash scripts/verifier-migration-multilingue.sh
DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e npm run seed && DATABASE_URI=postgres://postgres:postgres@127.0.0.1:5432/pdlm_e2e npm run test:e2e
npm run generate:types && git status --short src/payload-types.ts
```

Expected: tout vert ; `payload-types.ts` inchangé après régénération (sortie brute committée).

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Multilingue — recette de migration sur pile de type production, README"
```

---

## Critère de fin (spec § 9)

Une commune active le corse, traduit une page et la valide ; la page est servie en corse sur `/co/` et sur son domaine `.corsica`, avec `lang` et `hreflang` corrects ; une page non traduite s'affiche en français, correctement marquée ; aucun JavaScript client ajouté ; migration sans perte (script + recette) ; toute la suite existante passe. La **partie 2** (traduction automatique) reste à concevoir : elle s'appuie sur `versionEnLangue`, l'écriture en `locale: L` et `traduction: 'a-relire'`.
