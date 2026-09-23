# Mesure d'audience — projet A : collecte Umami conforme CNIL — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaque commune peut activer une mesure d'audience Umami sans bandeau de consentement, dans les limites de l'exemption CNIL : relais de collecte filtrant dans pdlm, IP tronquée, opposition sans JavaScript, purge à 25 mois.

**Architecture:** Umami 3.4.0 tourne à côté de pdlm (profil Compose `mesure`, base `umami` dans le même Postgres). Le navigateur ne parle qu'au domaine de la commune : `/mesure/script.js` (script Umami servi par pdlm), `/mesure/api/send` (relais qui reconstruit le corps sur liste blanche, tronque l'IP et transmet à Umami sur le réseau interne). pdlm pilote Umami par son API (création du site de la commune, lien de partage, remise à zéro, suppression) depuis les hooks de la collection `communes`.

**Tech Stack:** Next 16.3.3 (App Router, `src/proxy.ts`), Payload 3.90.1 (Postgres), Vitest 4 + Playwright 1.58, Docker Compose, Caddy 2, Umami 3.4.0, Postgres 17.

**Spec:** `docs/superpowers/specs/2026-09-22-umami-collecte-cnil-design.md` (lire avant toute tâche ; la section « Points vérifiés par exécution » donne les comportements réels d'Umami sur lesquels ce plan s'appuie).

## Global Constraints

- **Lire le guide Next** concerné dans `node_modules/next/dist/docs/` avant d'écrire une route ou une page (AGENTS.md : cette version de Next diffère de la mémoire d'entraînement). Route handlers : `01-app/01-getting-started/15-route-handlers.md`.
- Image : `ghcr.io/umami-software/umami:3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367` (index multi-architecture relevé le 23/09).
- Variables lues par pdlm : `UMAMI_URL`, `UMAMI_API_KEY`, `UMAMI_TEAM_ID`, `UMAMI_PUBLIC_URL`. **Sans `UMAMI_URL` (vide ou absente), la fonction n'existe pas** : pas de script, relais en 404, interrupteur grisé, activation refusée.
- Variables lues par Compose seulement : `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET`, `COMPOSE_PROFILES=mesure`. **Jamais `${X:?}`** dans `docker-compose.yml` pour ces variables : vérifié le 23/09, Compose refuse alors toute la pile même quand le profil `mesure` est inactif. Contrôle explicite dans le conteneur à la place.
- `.env` et `.env.example` sont sous règle de refus : ne jamais les lire ni les écrire. Les lignes à ajouter sont données au user (tâche 14), qui les colle lui-même.
- Cookie d'opposition : `pdlm_mesure=refus`, `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` en production, `Max-Age=33696000` (390 jours, sous le plafond de 13 mois).
- Journal (I12) : trois messages exacts, type `commune` : « Mesure d’audience activée — <nom> », « Mesure d’audience désactivée — <nom> », « Historique de mesure effacé — <nom> », plus, autour d'un effacement, « Effacement de l’historique de mesure demandé — <nom> » (écrit et validé AVANT l'appel à Umami) et « Effacement de l’historique de mesure refusé par le service de mesure — <nom> » (apostrophe typographique ’, tiret cadratin —).
- Textes d'interface en français, apostrophe typographique ’, comme le reste du dépôt.
- **Message d'erreur montré à l'agent : `throw new APIError(message, statut, null, true)`** (import `APIError` depuis `payload`). Vérifié dans `payload/dist/utilities/isErrorPublic.js` : une `Error` simple, sans statut, n'est pas publique hors mode debug, et l'admin et l'API de production affichent alors un message générique. Statuts : 400 pour une demande refusée, 503 quand Umami ne répond pas.
- **Tout fichier de test qui appelle `fetch` avec `AbortSignal` commence par `// @vitest-environment node`** : la configuration Vitest globale est `jsdom`, dont l'`AbortSignal` est refusé par le `fetch` de Node.
- Invariants I18 à I22 (spec) : pas de fichier d'invariants dans le dépôt, ils sont cités en commentaire au point du code qui les garantit, comme I6, I7, I12.
- Commits : message en français, préfixe `Mesure d'audience — `, pied `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Ne jamais ajouter `src/payload-types.ts` ni les `.json` de migration **existants** s'ils ne diffèrent que par la mise en forme (voir « Avant de commencer »).

## Review Focus

1. **Enregistrement partiel d'une commune** (PATCH qui ne contient que `nom`, ou formulaire admin qui renvoie tout le groupe `mesure`) : `siteUmami` et `lienPartage` restent intacts et aucun appel à Umami n'est fait. Test : tâche 5, « un enregistrement sans le groupe mesure ne touche à rien ».
2. **Valeur forgée par le client** dans `mesure.siteUmami` ou `mesure.lienPartage` : ignorée, la base garde la valeur écrite par le hook. Test : tâche 5, « siteUmami forgé par le client ignoré ».
3. **Couper puis réactiver** : la réactivation revérifie le site dans Umami (appel idempotent) sans créer de doublon ; si le site a disparu d'Umami (suppression externe réussie puis transaction pdlm annulée), elle le recrée sous le même identifiant avec un nouveau partage. Tests : tâche 4 (« nouvel essai idempotent »), tâche 5 (« couper puis réactiver », « réactivation répare »).
4. **Visiteur sur l'alias `www.`** du domaine d'une commune : la visite est comptée, sous `hostname` = l'hôte demandé. Test : tâche 7, « alias www ».
5. **Umami lent ou arrêté** : le visiteur reçoit 204 en moins de 4 s, jamais d'attente sans fin ni d'erreur 500. Tests : tâche 7, « Umami lent » et « Umami arrêté ».

---

## Avant de commencer

- [ ] **Vérifier la branche et l'arbre de travail**

```bash
git branch --show-current    # attendu : umami-collecte
git status --short
```

Deux fichiers générés sont modifiés sans être commités (`src/payload-types.ts`, `src/migrations/20260921_161136_ajout_instantanes_journal.json`) : un formateur est passé dessus, la différence n'est que de la mise en forme (points-virgules, tableaux sur une ligne). Ne pas les committer tels quels. `src/payload-types.ts` sera régénéré à la tâche 5. Laisser le `.json` de migration en l'état et signaler au user à la fin qu'il peut le restaurer (`git checkout -- <fichier>`) : c'est à lui de décider.

- [ ] **Base de test disponible**

```bash
docker compose -f docker-compose.dev.yml up -d postgres
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='pdlm_test'" | grep -q 1 \
  || docker compose -f docker-compose.dev.yml exec -T postgres createdb -U postgres pdlm_test
npm run test:unit && npm run test:int
```

Attendu : tout passe avant la première modification. Sinon, s'arrêter et le signaler.

## Carte des fichiers

| Fichier                                                      | Rôle                                                                       |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/lib/mesure/ip.ts`                                       | IP du visiteur (valeur de droite de `X-Forwarded-For`) et troncature (I18) |
| `src/lib/mesure/filtre.ts`                                   | Reconstruction du corps d'une visite sur liste blanche (I18, I19)          |
| `src/lib/mesure/opposition.ts`                               | Cookie d'opposition : lecture, en-tête `Set-Cookie` (I20)                  |
| `src/lib/mesure/etat.ts`                                     | `mesureInstallee()`, `siteMesure(commune)` : la commune est-elle mesurée ? |
| `src/lib/mesure/relais.ts`                                   | Le relais : ordre des contrôles, transmission à Umami, délai               |
| `src/lib/umami/uuid.ts`                                      | UUID v5 déterministe du site Umami d'une commune                           |
| `src/lib/umami/client.ts`                                    | Appels à l'API Umami (créer, effacer, supprimer)                           |
| `src/hooks/mesureAudience.ts`                                | Hooks `communes` : activation, journal, suppression du site                |
| `src/endpoints/effacerHistoriqueMesure.ts`                   | `POST /api/communes/:id/mesure/effacer`                                    |
| `src/components/admin/EffacerHistorique.tsx`                 | Bouton « Supprimer l’historique » (composant client de l'admin)            |
| `src/app/(frontend)/mesure/api/send/route.ts`                | Route du relais                                                            |
| `src/app/(frontend)/mesure/script.js/route.ts`               | Script Umami servi depuis le domaine de la commune                         |
| `src/app/(frontend)/mesure/opposition/route.ts`              | Formulaire d'opposition sans JavaScript                                    |
| `src/app/(frontend)/mesure-d-audience/page.tsx`              | Page d'information fixe                                                    |
| `tests/helpers/fauxUmami.ts`                                 | Faux serveur Umami qui imite les comportements vérifiés de la 3.4.0        |
| `tests/helpers/communeTest.ts`                               | Création/suppression d'une commune active avec domaine, pour les tests     |
| `scripts/purge-mesure.sql`, `scripts/tester-purge-mesure.sh` | Purge à 25 mois (I21) et son test contre une vraie base Umami              |

Fichiers modifiés : `src/lib/commune.ts`, `src/collections/Communes.ts`, `src/hooks/journaliser.ts`, `src/hooks/uniqueSlugParCommune.ts`, `src/app/(frontend)/layout.tsx`, `src/components/PiedDePage.tsx`, `src/seed/contenu-demo.ts`, `docker-compose.yml`, `docker-compose.dev.yml`, `Caddyfile`, `Caddyfile.dev`, `scripts/backup.sh`, `scripts/restore.sh`, `playwright.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/trivy-rescan.yml`, `README.md`.

---

### Task 1: IP du visiteur et troncature

**Files:**

- Create: `src/lib/mesure/ip.ts`
- Test: `tests/unit/mesure-ip.spec.ts`

**Interfaces:**

- Produces: `ipVisiteur(xff: string | null): string | null` ; `tronquerIp(ip: string): string | null`

- [ ] **Step 1: Write the failing test**

```ts
import { isIP } from 'node:net'

import { describe, expect, it } from 'vitest'

import { ipVisiteur, tronquerIp } from '@/lib/mesure/ip'

/**
 * I18 — aucune adresse IP complète ne sort de pdlm vers Umami.
 * Caddy est le seul mandataire : la valeur la plus à droite de
 * X-Forwarded-For est la sienne ; tout ce qui est à gauche vient du client
 * et peut être forgé.
 */
describe('ipVisiteur', () => {
  it('prend la valeur la plus à droite, jamais celle forgée à gauche', () => {
    expect(ipVisiteur('1.2.3.4, 90.84.235.17')).toBe('90.84.235.17')
    expect(ipVisiteur('90.84.235.17')).toBe('90.84.235.17')
    expect(ipVisiteur('8.8.8.8,2a01:cb00:1234:5600::1')).toBe('2a01:cb00:1234:5600::1')
  })

  it('aucune IP sans en-tête, avec une valeur illisible ou une adresse locale', () => {
    expect(ipVisiteur(null)).toBeNull()
    expect(ipVisiteur('')).toBeNull()
    expect(ipVisiteur('1.2.3.4, faux')).toBeNull()
    expect(ipVisiteur('1.2.3.4, 127.0.0.1')).toBeNull()
    expect(ipVisiteur('::1')).toBeNull()
    expect(ipVisiteur('::ffff:10.0.0.3')).toBeNull()
    expect(ipVisiteur('172.18.0.5')).toBeNull()
    expect(ipVisiteur('192.168.1.10')).toBeNull()
    expect(ipVisiteur('fd12:3456::1')).toBeNull()
  })
})

describe('tronquerIp', () => {
  it('IPv4 : dernier octet à zéro', () => {
    expect(tronquerIp('90.84.235.17')).toBe('90.84.235.0')
  })

  it('IPv6 : garde les 48 premiers bits', () => {
    expect(tronquerIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe('2001:db8:85a3::')
    const court = tronquerIp('2001:db8::1')
    expect(court).toBe('2001:db8:0::')
    expect(isIP(court ?? '')).toBe(6)
  })

  it('IPv4 encapsulée dans IPv6, notation pointée ou hexadécimale : règle IPv4', () => {
    expect(tronquerIp('::ffff:90.84.235.17')).toBe('90.84.235.0')
    expect(tronquerIp('::ffff:5a54:eb11')).toBe('90.84.235.0')
    expect(ipVisiteur('::ffff:a00:3')).toBeNull() // 10.0.0.3
  })

  it('valeur illisible : rien', () => {
    expect(tronquerIp('pas-une-ip')).toBeNull()
    expect(tronquerIp('')).toBeNull()
    expect(tronquerIp('999.1.1.1')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-ip.spec.ts`
Expected: FAIL (`Failed to resolve import "@/lib/mesure/ip"`)

- [ ] **Step 3: Write minimal implementation**

`src/lib/mesure/ip.ts` :

```ts
import { isIP } from 'node:net'

const V4_ENCAPSULEE = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i

/** IPv4 encapsulée dans IPv6, en notation pointée (`::ffff:1.2.3.4`) ou hexadécimale (`::ffff:102:304`). */
function sansEncapsulation(ip: string): string {
  const pointee = ip.match(V4_ENCAPSULEE)?.[1]
  if (pointee) return pointee
  if (isIP(ip) !== 6) return ip
  const g = groupesIpv6(ip)
  if (!g || g.slice(0, 5).some((x) => x !== '0') || g[5] !== 'ffff') return ip
  const haut = parseInt(g[6], 16)
  const bas = parseInt(g[7], 16)
  return `${haut >> 8}.${haut & 255}.${bas >> 8}.${bas & 255}`
}

/** Boucle locale, réseaux privés, lien local : jamais l'adresse d'un visiteur. */
function estLocale(ip: string): boolean {
  const v = sansEncapsulation(ip)
  if (isIP(v) === 4) {
    const [a, b] = v.split('.').map(Number)
    return (
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    )
  }
  const bas = v.toLowerCase()
  return bas === '::1' || /^f[cd]/.test(bas) || /^fe[89ab]/.test(bas)
}

/**
 * IP du visiteur : la valeur la plus à droite de X-Forwarded-For, celle
 * qu'écrit Caddy, seul mandataire. Umami, lui, lirait la plus à gauche, que
 * le client peut forger. Next n'ajoute l'en-tête que s'il est absent
 * (`??=`, base-server.js) : en développement, sans Caddy, c'est l'adresse
 * locale, écartée ici — Umami ne localise pas, rien de plus.
 */
export function ipVisiteur(xff: string | null): string | null {
  const derniere = (xff ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .at(-1)
  if (!derniere || isIP(derniere) === 0 || estLocale(derniere)) return null
  return derniere
}

/** Les huit groupes d'une IPv6, développés et sans zéros de tête. */
function groupesIpv6(ip: string): string[] | null {
  let texte = ip.toLowerCase().split('%')[0]
  const v4 = texte.match(/(\d{1,3}(?:\.\d{1,3}){3})$/)
  if (v4) {
    const o = v4[1].split('.').map(Number)
    texte = `${texte.slice(0, -v4[1].length)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const [gauche, droite] = texte.split('::')
  const g = gauche ? gauche.split(':') : []
  const d = droite ? droite.split(':') : []
  const groupes = texte.includes('::')
    ? [...g, ...Array<string>(8 - g.length - d.length).fill('0'), ...d]
    : g
  return groupes.length === 8 ? groupes.map((x) => x.replace(/^0+(?=.)/, '')) : null
}

/** I18 : dernier octet à zéro en IPv4 ; en IPv6, le /48 gardé, les 80 bits suivants à zéro. */
export function tronquerIp(ip: string): string | null {
  const v = sansEncapsulation(ip)
  if (isIP(v) === 4) {
    const o = v.split('.')
    return `${o[0]}.${o[1]}.${o[2]}.0`
  }
  if (isIP(v) !== 6) return null
  const g = groupesIpv6(v)
  return g ? `${g.slice(0, 3).join(':')}::` : null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-ip.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mesure/ip.ts tests/unit/mesure-ip.spec.ts
git commit -m "Mesure d'audience — IP du visiteur et troncature (I18)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Filtrage du corps d'une visite

**Files:**

- Create: `src/lib/mesure/filtre.ts`
- Test: `tests/unit/mesure-filtre.spec.ts`

**Interfaces:**

- Produces:
  ```ts
  interface VisiteFiltree {
    type: 'event'
    payload: { website: string; hostname: string; url: string; referrer?: string; title?: string; screen?: string; language?: string }
  }
  filtrerVisite(brut: unknown, contexte: { host: string; siteUmami: string }): VisiteFiltree | null
  ```
  `null` = rien ne doit être transmis.

Rappel (vérifié dans `src/tracker/index.ts` d'Umami 3.4.0) : le script envoie `{ type: 'event', payload: { website, screen, language, title, hostname, url, referrer, tag, id } }`, où `url` est l'**URL absolue** de la page et `referrer` un chemin si interne, une URL absolue sinon. Un `ip` dans le corps **l'emporte** sur l'en-tête d'IP (vérifié par exécution : `ip: 8.8.8.8` a localisé la visite aux États-Unis malgré l'en-tête tronqué français).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'

import { filtrerVisite } from '@/lib/mesure/filtre'

const CONTEXTE = { host: 'mairie-exemple.fr', siteUmami: '11111111-1111-5111-8111-111111111111' }

const pageVue = (payload: Record<string, unknown>) => ({ type: 'event', payload })

describe('filtrerVisite — liste blanche (I18)', () => {
  it('retire chaque champ hors liste blanche', () => {
    const resultat = filtrerVisite(
      pageVue({
        website: 'autre-site',
        hostname: 'ailleurs.fr',
        url: 'https://mairie-exemple.fr/actualites?utm_source=x#haut',
        referrer: 'https://www.moteur.fr/recherche?q=mairie#r',
        title: 'Actualités',
        screen: '1280x720',
        language: 'fr-FR',
        ip: '8.8.8.8',
        id: 'visiteur-identifie',
        userAgent: 'Faux/1.0',
        timestamp: 1,
        data: { a: 1 },
        tag: 'campagne',
        browser: 'chrome',
        os: 'Mac OS',
        device: 'desktop',
        link: 'x',
        pixel: 'y',
        lcp: 1200,
      }),
      CONTEXTE,
    )
    expect(resultat).toEqual({
      type: 'event',
      payload: {
        website: CONTEXTE.siteUmami,
        hostname: 'mairie-exemple.fr',
        url: '/actualites',
        referrer: 'https://www.moteur.fr/recherche',
        title: 'Actualités',
        screen: '1280x720',
        language: 'fr-FR',
      },
    })
  })

  it('website et hostname viennent du domaine demandé, jamais du client (I19)', () => {
    const r = filtrerVisite(pageVue({ website: 'x', hostname: 'y', url: '/' }), CONTEXTE)
    expect(r?.payload.website).toBe(CONTEXTE.siteUmami)
    expect(r?.payload.hostname).toBe('mairie-exemple.fr')
  })

  it('référent interne : chemin seul', () => {
    const r = filtrerVisite(
      pageVue({ url: '/agenda', referrer: 'https://mairie-exemple.fr/actualites?page=2' }),
      CONTEXTE,
    )
    expect(r?.payload.referrer).toBe('/actualites')
    const relatif = filtrerVisite(
      pageVue({ url: '/agenda', referrer: '/documents?x=1#y' }),
      CONTEXTE,
    )
    expect(relatif?.payload.referrer).toBe('/documents')
  })

  it('titre tronqué à 500 caractères ; écran et langue gardés seulement s’ils sont bien formés', () => {
    const r = filtrerVisite(
      pageVue({
        url: '/',
        title: 'a'.repeat(600),
        screen: '1280x720; DROP',
        language: 'fr-FR-x'.repeat(10),
      }),
      CONTEXTE,
    )
    expect(r?.payload.title).toHaveLength(500)
    expect(r?.payload.screen).toBeUndefined()
    expect(r?.payload.language).toBeUndefined()
  })

  it('seules les pages vues passent', () => {
    expect(filtrerVisite({ type: 'identify', payload: { url: '/' } }, CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({ url: '/', name: 'clic-bouton' }), CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({}), CONTEXTE)).toBeNull()
    expect(filtrerVisite(pageVue({ url: 'javascript:alert(1)' }), CONTEXTE)).toBeNull()
    expect(filtrerVisite('texte', CONTEXTE)).toBeNull()
    expect(filtrerVisite(null, CONTEXTE)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-filtre.spec.ts`
Expected: FAIL (import introuvable)

- [ ] **Step 3: Write minimal implementation**

`src/lib/mesure/filtre.ts` :

```ts
/**
 * I18 / I19 — le corps transmis à Umami est reconstruit, jamais recopié.
 * Umami 3.4.0 accepte dans le corps `ip` (prioritaire sur les en-têtes),
 * `id` (identification d'un visiteur), `userAgent`, `timestamp`, etc. : seul
 * ce qui figure ici sort de pdlm, et `website`/`hostname` viennent du domaine
 * demandé, jamais du client.
 */
export interface VisiteFiltree {
  type: 'event'
  payload: {
    website: string
    hostname: string
    url: string
    referrer?: string
    title?: string
    screen?: string
    language?: string
  }
}

const RE_ECRAN = /^\d{1,5}x\d{1,5}$/
const RE_LANGUE = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8})*$/
const LONGUEUR_MAX = 500

function urlWeb(valeur: string, host: string): URL | null {
  try {
    const u = new URL(valeur, `https://${host}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null
  } catch {
    return null
  }
}

export function filtrerVisite(
  brut: unknown,
  { host, siteUmami }: { host: string; siteUmami: string },
): VisiteFiltree | null {
  if (typeof brut !== 'object' || brut === null) return null
  const { type, payload } = brut as { type?: unknown; payload?: unknown }
  if (type !== 'event' || typeof payload !== 'object' || payload === null) return null
  const p = payload as Record<string, unknown>
  // Événement nommé (clic, téléchargement) : hors périmètre, seules les pages vues passent.
  if (p.name !== undefined) return null
  if (typeof p.url !== 'string') return null
  const url = urlWeb(p.url, host)
  if (!url) return null

  const sortie: VisiteFiltree['payload'] = {
    website: siteUmami,
    hostname: host,
    url: url.pathname.slice(0, LONGUEUR_MAX),
  }
  if (typeof p.referrer === 'string' && p.referrer !== '') {
    const ref = urlWeb(p.referrer, host)
    if (ref) {
      const valeur = ref.hostname === host ? ref.pathname : `${ref.origin}${ref.pathname}`
      sortie.referrer = valeur.slice(0, LONGUEUR_MAX)
    }
  }
  if (typeof p.title === 'string' && p.title !== '') sortie.title = p.title.slice(0, LONGUEUR_MAX)
  if (typeof p.screen === 'string' && RE_ECRAN.test(p.screen)) sortie.screen = p.screen
  if (typeof p.language === 'string' && p.language.length <= 35 && RE_LANGUE.test(p.language)) {
    sortie.language = p.language
  }
  return { type: 'event', payload: sortie }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-filtre.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mesure/filtre.ts tests/unit/mesure-filtre.spec.ts
git commit -m "Mesure d'audience — corps d'une visite reconstruit sur liste blanche (I18, I19)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Opposition et état de la mesure

**Files:**

- Create: `src/lib/mesure/opposition.ts`, `src/lib/mesure/etat.ts`
- Test: `tests/unit/mesure-opposition.spec.ts`

**Interfaces:**

- Produces:

  ```ts
  // opposition.ts
  const COOKIE_OPPOSITION = 'pdlm_mesure'
  const DUREE_OPPOSITION_S = 33_696_000
  lireCookie(entete: string | null, nom: string): string | undefined
  estOppose(valeur: string | undefined): boolean
  enteteCookieOpposition(choix: 'refus' | 'accepte', production: boolean): string
  soumissionIntersite(entetes: Headers, hoteAttendu: string): boolean   // hôte:port de la requête
  // etat.ts
  interface CommuneMesurable { mesure?: { active?: boolean | null; siteUmami?: string | null } | null }
  mesureInstallee(): boolean
  siteMesure(commune: CommuneMesurable | null | undefined): string | null
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from 'vitest'

import { mesureInstallee, siteMesure } from '@/lib/mesure/etat'
import {
  COOKIE_OPPOSITION,
  enteteCookieOpposition,
  estOppose,
  lireCookie,
  soumissionIntersite,
} from '@/lib/mesure/opposition'

describe('cookie d’opposition (I20)', () => {
  it('se lit parmi d’autres cookies', () => {
    expect(lireCookie('a=1; pdlm_mesure=refus; b=2', COOKIE_OPPOSITION)).toBe('refus')
    expect(lireCookie('a=1', COOKIE_OPPOSITION)).toBeUndefined()
    expect(lireCookie(null, COOKIE_OPPOSITION)).toBeUndefined()
    expect(estOppose('refus')).toBe(true)
    expect(estOppose('')).toBe(false)
    expect(estOppose(undefined)).toBe(false)
  })

  it('refus : 390 jours, HttpOnly, SameSite=Lax, Secure en production seulement', () => {
    expect(enteteCookieOpposition('refus', true)).toBe(
      'pdlm_mesure=refus; Max-Age=33696000; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
    expect(enteteCookieOpposition('refus', false)).not.toContain('Secure')
  })

  it('acceptation : le cookie est effacé', () => {
    expect(enteteCookieOpposition('accepte', true)).toBe(
      'pdlm_mesure=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure',
    )
  })
})

describe('formulaire soumis depuis un autre site', () => {
  const h = (e: Record<string, string>) => new Headers(e)
  it('refusé : autre origine, origine « null », Sec-Fetch-Site intersite', () => {
    expect(soumissionIntersite(h({ origin: 'https://hostile.example' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ origin: 'null' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'cross-site' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'same-site' }), 'mairie.fr')).toBe(true)
    expect(soumissionIntersite(h({ origin: 'https://mairie.fr:8443' }), 'mairie.fr')).toBe(true)
  })
  it('accepté : même origine, ou en-têtes absents', () => {
    expect(soumissionIntersite(h({ origin: 'https://mairie.fr' }), 'mairie.fr')).toBe(false)
    expect(soumissionIntersite(h({ origin: 'http://localhost:3000' }), 'localhost')).toBe(false)
    expect(soumissionIntersite(h({ 'sec-fetch-site': 'same-origin' }), 'mairie.fr')).toBe(false)
    expect(soumissionIntersite(h({}), 'mairie.fr')).toBe(false)
  })
})

describe('état de la mesure', () => {
  const avant = process.env.UMAMI_URL
  afterEach(() => {
    if (avant === undefined) delete process.env.UMAMI_URL
    else process.env.UMAMI_URL = avant
  })

  it('sans UMAMI_URL, rien n’est mesuré', () => {
    delete process.env.UMAMI_URL
    expect(mesureInstallee()).toBe(false)
    expect(siteMesure({ mesure: { active: true, siteUmami: 'abc' } })).toBeNull()
    process.env.UMAMI_URL = ''
    expect(mesureInstallee()).toBe(false)
  })

  it('mesurée seulement si active ET dotée d’un site', () => {
    process.env.UMAMI_URL = 'http://umami:3000'
    expect(siteMesure({ mesure: { active: true, siteUmami: 'abc' } })).toBe('abc')
    expect(siteMesure({ mesure: { active: false, siteUmami: 'abc' } })).toBeNull()
    expect(siteMesure({ mesure: { active: true, siteUmami: null } })).toBeNull()
    expect(siteMesure({})).toBeNull()
    expect(siteMesure(null)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-opposition.spec.ts`
Expected: FAIL (imports introuvables)

- [ ] **Step 3: Write minimal implementation**

`src/lib/mesure/opposition.ts` :

```ts
/**
 * I20 — un visiteur qui s'est opposé n'est plus mesuré. Ce cookie ne sert
 * qu'à respecter l'opposition : il est lui-même exempté de consentement.
 */
export const COOKIE_OPPOSITION = 'pdlm_mesure'

/** 390 jours : sous le plafond de 13 mois fixé aux traceurs par la CNIL. */
export const DUREE_OPPOSITION_S = 390 * 24 * 60 * 60

export function lireCookie(entete: string | null, nom: string): string | undefined {
  for (const morceau of (entete ?? '').split(';')) {
    const [cle, ...valeur] = morceau.trim().split('=')
    if (cle === nom) return valeur.join('=')
  }
  return undefined
}

export function estOppose(valeur: string | undefined): boolean {
  return valeur === 'refus'
}

export function enteteCookieOpposition(choix: 'refus' | 'accepte', production: boolean): string {
  const attributs = ['Path=/', 'HttpOnly', 'SameSite=Lax', ...(production ? ['Secure'] : [])]
  return choix === 'refus'
    ? [`${COOKIE_OPPOSITION}=refus`, `Max-Age=${DUREE_OPPOSITION_S}`, ...attributs].join('; ')
    : [`${COOKIE_OPPOSITION}=`, 'Max-Age=0', ...attributs].join('; ')
}

/**
 * Vrai si le formulaire d'opposition a été soumis depuis une autre origine :
 * `SameSite=Lax` n'empêche pas une réponse d'effacer le cookie. Sans
 * JavaScript, le navigateur envoie quand même `Origin` (et `Sec-Fetch-Site`)
 * sur un POST de formulaire. `hoteAttendu` : hôte ET port de la requête
 * (`new URL(request.url).host`). Le schéma n'est pas comparé : derrière Caddy,
 * Next peut voir `http` quand le navigateur voit `https`, et le HTTP est
 * redirigé vers HTTPS par Caddy. En-têtes absents (vieux client, curl) : accepté.
 */
export function soumissionIntersite(entetes: Headers, hoteAttendu: string): boolean {
  const site = entetes.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return true
  const origine = entetes.get('origin')
  if (origine === null) return false
  try {
    return new URL(origine).host.toLowerCase() !== hoteAttendu.toLowerCase()
  } catch {
    return true // « null » ou valeur illisible
  }
}
```

`src/lib/mesure/etat.ts` :

```ts
/** Forme minimale d'une commune pour décider de la mesure (compatible avec `Commune`). */
export interface CommuneMesurable {
  mesure?: { active?: boolean | null; siteUmami?: string | null } | null
}

/** Sans UMAMI_URL, la mesure d'audience n'existe pas sur cette plateforme. */
export function mesureInstallee(): boolean {
  return Boolean(process.env.UMAMI_URL)
}

/** Identifiant du site Umami de la commune, ou null si rien ne doit être mesuré. */
export function siteMesure(commune: CommuneMesurable | null | undefined): string | null {
  if (!mesureInstallee() || commune?.mesure?.active !== true) return null
  return commune.mesure.siteUmami || null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/mesure-opposition.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/mesure/opposition.ts src/lib/mesure/etat.ts tests/unit/mesure-opposition.spec.ts
git commit -m "Mesure d'audience — cookie d'opposition et état de la mesure (I20)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Faux Umami et client de l'API Umami

**Files:**

- Create: `tests/helpers/fauxUmami.ts`, `src/lib/umami/uuid.ts`, `src/lib/umami/client.ts`
- Test: `tests/unit/umami-uuid.spec.ts`, `tests/unit/umami-client.spec.ts`

**Interfaces:**

- Produces:
  ```ts
  // tests/helpers/fauxUmami.ts
  const CLE_TEST: string; const EQUIPE_TEST: string; const PUBLIC_TEST = 'https://stats.pdlm.test'
  interface RequeteRecue { methode: string; chemin: string; entetes: IncomingHttpHeaders; corps: string }
  interface FauxUmami {
    url: string; recues: RequeteRecue[]
    sites: Map<string, { teamId: string; name: string; domain: string }>
    partages: Map<string, Array<{ id: string; slug: string; name: string; parameters: unknown }>>
    reglages: { panne: boolean; delaiEnvoiMs: number; horsEquipe: boolean }
    vider(): void; fermer(): Promise<void>
  const SCRIPT_FAUX: string   // mini-script de mesure qui poste une page vue au relais (tests de bout en bout)
  }
  demarrerFauxUmami(port?: number): Promise<FauxUmami>
  configurerUmami(url: string): void   // pose UMAMI_URL, UMAMI_API_KEY, UMAMI_TEAM_ID, UMAMI_PUBLIC_URL
  // src/lib/umami/uuid.ts
  const ESPACE_PDLM = '521e2d21-9c59-4092-a51d-dbb0d72f1827'
  uuidV5(nom: string, espace: string): string
  identifiantSite(communeId: number | string): string
  // src/lib/umami/client.ts
  class UmamiIndisponible extends Error { readonly sansReponse: boolean }  // true : réseau ou délai, l'action a peut-être eu lieu
  creerSiteCommune(c: { id: number; nom: string; domaine: string }): Promise<{ siteUmami: string; lienPartage: string }>
  effacerHistorique(siteUmami: string): Promise<void>
  supprimerSite(siteUmami: string): Promise<void>
  ```

Comportements réels d'Umami 3.4.0, **vérifiés par exécution le 23/09**, que le faux serveur reproduit et que le client doit gérer :

| Appel                                                 | Réponse réelle                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `POST /api/websites` avec un `id` neuf                | 200, le site                                                                                     |
| `POST /api/websites` avec un `id` déjà pris           | **500, corps vide**                                                                              |
| `GET /api/websites/:id` d'un site absent              | **401** (pas 404)                                                                                |
| `DELETE /api/websites/:id`                            | 200, suppression **définitive** (le partage aussi) ; recréer le même `id` fonctionne             |
| `DELETE` d'un site déjà supprimé                      | 401                                                                                              |
| `GET /api/me` avec la clé                             | 200 ; clé fausse : 401 ; **compte retiré de l'équipe : encore 200**                              |
| `GET /api/teams/:id`                                  | 200 pour un membre ; **401 une fois le compte retiré de l'équipe** (seule preuve d'appartenance) |
| Site d'une autre équipe, ou compte retiré de l'équipe | 401, comme un site absent                                                                        |
| `GET /api/websites/:id/shares`                        | `{ data: [...], count, page, pageSize }`                                                         |
| `POST /api/websites/:id/reset`                        | 200 `{ok:true}` ; efface visites et sessions, garde le site et le partage                        |
| Authentification                                      | `Authorization: Bearer umami_…` (clé d'API, active hors `CLOUD_MODE`)                            |
| Rôle d'équipe du compte `pdlm`                        | `team-member` suffit pour créer, partager, remettre à zéro, supprimer ; `team-view-only` : 401   |

- [ ] **Step 1: Write the fake server**

`tests/helpers/fauxUmami.ts` :

```ts
import { randomBytes, randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * Faux serveur Umami : reproduit les réponses d'Umami 3.4.0 relevées par
 * exécution le 23/09 (voir la spec, « Points vérifiés par exécution ») et
 * enregistre tout ce qu'il reçoit. `reglages.panne` coupe la connexion comme
 * un conteneur arrêté ; `reglages.delaiEnvoiMs` ralentit /api/send ;
 * `reglages.horsEquipe` imite un compte `pdlm` retiré de l'équipe (clé
 * valide, mais équipe et sites en 401).
 */
export const CLE_TEST = 'umami_clefauxumamipourlestests0000'
export const EQUIPE_TEST = '820bdb78-5430-4fcf-8840-47971ea98a9e'
export const PUBLIC_TEST = 'https://stats.pdlm.test'

export interface RequeteRecue {
  methode: string
  chemin: string
  entetes: IncomingHttpHeaders
  corps: string
}

export interface FauxUmami {
  url: string
  recues: RequeteRecue[]
  sites: Map<string, { teamId: string; name: string; domain: string }>
  partages: Map<string, Array<{ id: string; slug: string; name: string; parameters: unknown }>>
  reglages: { panne: boolean; delaiEnvoiMs: number; horsEquipe: boolean }
  vider(): void
  fermer(): Promise<void>
}

export function configurerUmami(url: string): void {
  process.env.UMAMI_URL = url
  process.env.UMAMI_API_KEY = CLE_TEST
  process.env.UMAMI_TEAM_ID = EQUIPE_TEST
  process.env.UMAMI_PUBLIC_URL = PUBLIC_TEST
}

function lireCorps(req: IncomingMessage): Promise<string> {
  return new Promise((ok, ko) => {
    let texte = ''
    req.setEncoding('utf8')
    req.on('data', (morceau: string) => (texte += morceau))
    req.on('end', () => ok(texte))
    req.on('error', ko)
  })
}

function json(res: ServerResponse, statut: number, corps?: unknown): void {
  res.writeHead(statut, { 'content-type': 'application/json' })
  res.end(corps === undefined ? '' : JSON.stringify(corps))
}

const NON_AUTORISE = { error: { message: 'Unauthorized', code: 'unauthorized', status: 401 } }

/**
 * Script de mesure minimal : lit la balise comme le vrai (data-website-id,
 * data-host-url) et poste une page vue au relais. Il éprouve la chaîne
 * balise → relais → Umami dans les tests de bout en bout ; le vrai script
 * d'Umami est éprouvé à la recette (tâche 15).
 */
export const SCRIPT_FAUX = `(function () {
  var s = document.currentScript; if (!s) return;
  fetch((s.getAttribute('data-host-url') || '') + '/api/send', {
    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'event', payload: { website: s.getAttribute('data-website-id'),
      hostname: location.hostname, url: location.href, referrer: document.referrer,
      title: document.title, screen: screen.width + 'x' + screen.height, language: navigator.language } })
  });
})();`

export async function demarrerFauxUmami(port = 0): Promise<FauxUmami> {
  const recues: RequeteRecue[] = []
  const sites: FauxUmami['sites'] = new Map()
  const partages: FauxUmami['partages'] = new Map()
  const reglages = { panne: false, delaiEnvoiMs: 0, horsEquipe: false }

  const serveur = createServer(async (req, res) => {
    const corps = await lireCorps(req)
    const chemin = (req.url ?? '/').split('?')[0]
    const methode = req.method ?? 'GET'
    recues.push({ methode, chemin, entetes: req.headers, corps })
    if (reglages.panne) {
      req.socket.destroy()
      return
    }

    if (methode === 'GET' && chemin === '/script.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' })
      res.end(SCRIPT_FAUX)
      return
    }
    if (methode === 'POST' && chemin === '/api/send') {
      await new Promise((r) => setTimeout(r, reglages.delaiEnvoiMs))
      if (!res.destroyed) json(res, 200, { cache: 'jeton-faux', sessionId: 's', visitId: 'v' })
      return
    }
    if (req.headers.authorization !== `Bearer ${CLE_TEST}`) return json(res, 401, NON_AUTORISE)
    if (methode === 'GET' && chemin === '/api/me')
      return json(res, 200, { user: { username: 'pdlm' } })
    if (methode === 'GET' && chemin === `/api/teams/${EQUIPE_TEST}`) {
      return reglages.horsEquipe
        ? json(res, 401, NON_AUTORISE)
        : json(res, 200, { id: EQUIPE_TEST })
    }
    if (methode === 'POST' && chemin === '/api/websites') {
      const d = JSON.parse(corps) as { id: string; name: string; domain: string; teamId: string }
      if (sites.has(d.id)) return json(res, 500) // 3.4.0 : identifiant déjà pris → 500 sans corps
      sites.set(d.id, { teamId: d.teamId, name: d.name, domain: d.domain })
      return json(res, 200, { id: d.id, name: d.name, domain: d.domain, teamId: d.teamId })
    }
    const m = chemin.match(/^\/api\/websites\/([0-9a-f-]{36})(\/shares|\/reset)?$/)
    if (m) {
      const [, id, suite] = m
      const site = sites.get(id)
      // 3.4.0 : site absent, ou hors de portée du compte → 401
      if (!site || reglages.horsEquipe) return json(res, 401, NON_AUTORISE)
      if (!suite && methode === 'GET') return json(res, 200, { id, ...site })
      if (!suite && methode === 'DELETE') {
        sites.delete(id)
        partages.delete(id)
        return json(res, 200, { ok: true })
      }
      if (suite === '/reset' && methode === 'POST') return json(res, 200, { ok: true })
      if (suite === '/shares' && methode === 'GET') {
        const data = partages.get(id) ?? []
        return json(res, 200, { data, count: data.length, page: 1, pageSize: 10 })
      }
      if (suite === '/shares' && methode === 'POST') {
        const d = JSON.parse(corps) as { name: string; parameters?: unknown }
        const partage = {
          id: randomUUID(),
          slug: randomBytes(8).toString('hex'),
          name: d.name,
          parameters: d.parameters ?? {},
        }
        partages.set(id, [...(partages.get(id) ?? []), partage])
        return json(res, 200, { ...partage, entityId: id, shareType: 1 })
      }
    }
    json(res, 404)
  })

  await new Promise<void>((ok) => serveur.listen(port, '127.0.0.1', ok))
  const { port: portReel } = serveur.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${portReel}`,
    recues,
    sites,
    partages,
    reglages,
    vider: () => {
      recues.length = 0
    },
    fermer: () =>
      new Promise<void>((ok) => {
        serveur.closeAllConnections()
        serveur.close(() => ok())
      }),
  }
}
```

- [ ] **Step 2: Write the failing tests**

`tests/unit/umami-uuid.spec.ts` :

```ts
import { afterEach, describe, expect, it } from 'vitest'

import { identifiantSite, uuidV5 } from '@/lib/umami/uuid'

describe('uuidV5', () => {
  it('vecteur de référence RFC 4122 (espace DNS)', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    )
  })
})

describe('identifiantSite', () => {
  const avant = process.env.PLATFORM_DOMAIN
  afterEach(() => {
    if (avant === undefined) delete process.env.PLATFORM_DOMAIN
    else process.env.PLATFORM_DOMAIN = avant
  })

  it('stable pour une même commune, distinct d’une commune à l’autre et d’une plateforme à l’autre', () => {
    process.env.PLATFORM_DOMAIN = 'pdlm.example.fr'
    const a = identifiantSite(12)
    expect(identifiantSite(12)).toBe(a)
    expect(identifiantSite('12')).toBe(a)
    expect(identifiantSite(13)).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    process.env.PLATFORM_DOMAIN = 'autre.example.fr'
    expect(identifiantSite(12)).not.toBe(a)
  })
})
```

`tests/unit/umami-client.spec.ts` :

```ts
// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  creerSiteCommune,
  effacerHistorique,
  supprimerSite,
  UmamiIndisponible,
} from '@/lib/umami/client'
import { identifiantSite } from '@/lib/umami/uuid'

import {
  CLE_TEST,
  configurerUmami,
  demarrerFauxUmami,
  EQUIPE_TEST,
  type FauxUmami,
} from '../helpers/fauxUmami'

let umami: FauxUmami

beforeAll(async () => {
  umami = await demarrerFauxUmami()
})
afterAll(async () => {
  await umami.fermer()
})
beforeEach(() => {
  configurerUmami(umami.url)
  umami.vider()
  umami.sites.clear()
  umami.partages.clear()
  umami.reglages.panne = false
  umami.reglages.horsEquipe = false
})

const appels = (methode: string, chemin: string) =>
  umami.recues.filter((r) => r.methode === methode && r.chemin === chemin)

describe('creerSiteCommune', () => {
  it('crée le site sous un identifiant déterministe, dans l’équipe, avec un partage « vue d’ensemble » seul', async () => {
    const id = identifiantSite(7)
    const r = await creerSiteCommune({ id: 7, nom: 'Valvert', domaine: 'valvert.fr' })
    expect(r.siteUmami).toBe(id)
    expect(r.lienPartage).toMatch(/^https:\/\/stats\.pdlm\.test\/share\/[0-9a-f]{16}$/)
    const creation = JSON.parse(appels('POST', '/api/websites')[0].corps)
    expect(creation).toEqual({ id, name: 'Valvert', domain: 'valvert.fr', teamId: EQUIPE_TEST })
    const partage = JSON.parse(appels('POST', `/api/websites/${id}/shares`)[0].corps)
    expect(partage.parameters).toEqual({ overview: true })
    expect(appels('POST', '/api/websites')[0].entetes.authorization).toBe(`Bearer ${CLE_TEST}`)
  })

  it('nouvel essai idempotent : site et partage existants réutilisés', async () => {
    const premier = await creerSiteCommune({ id: 8, nom: 'X', domaine: 'x.fr' })
    umami.vider()
    const second = await creerSiteCommune({ id: 8, nom: 'X', domaine: 'x.fr' })
    expect(second).toEqual(premier)
    expect(appels('GET', `/api/websites/${premier.siteUmami}`)).toHaveLength(1)
    expect(appels('POST', `/api/websites/${premier.siteUmami}/shares`)).toHaveLength(0)
  })

  it('refuse un site existant hors de l’équipe', async () => {
    umami.sites.set(identifiantSite(9), { teamId: 'autre-equipe', name: 'X', domain: 'x.fr' })
    await expect(creerSiteCommune({ id: 9, nom: 'X', domaine: 'x.fr' })).rejects.toBeInstanceOf(
      UmamiIndisponible,
    )
  })

  it('Umami arrêté : UmamiIndisponible', async () => {
    umami.reglages.panne = true
    await expect(creerSiteCommune({ id: 10, nom: 'X', domaine: 'x.fr' })).rejects.toBeInstanceOf(
      UmamiIndisponible,
    )
  })

  it('configuration incomplète : UmamiIndisponible, aucun appel', async () => {
    delete process.env.UMAMI_API_KEY
    await expect(creerSiteCommune({ id: 11, nom: 'X', domaine: 'x.fr' })).rejects.toBeInstanceOf(
      UmamiIndisponible,
    )
    expect(umami.recues).toHaveLength(0)
  })
})

describe('effacerHistorique et supprimerSite', () => {
  it('remise à zéro', async () => {
    const { siteUmami } = await creerSiteCommune({ id: 20, nom: 'X', domaine: 'x.fr' })
    await effacerHistorique(siteUmami)
    expect(appels('POST', `/api/websites/${siteUmami}/reset`)).toHaveLength(1)
  })

  it('suppression, et site déjà absent considéré comme supprimé', async () => {
    const { siteUmami } = await creerSiteCommune({ id: 21, nom: 'X', domaine: 'x.fr' })
    await supprimerSite(siteUmami)
    expect(umami.sites.has(siteUmami)).toBe(false)
    await expect(supprimerSite(siteUmami)).resolves.toBeUndefined()
  })

  it('clé refusée : la suppression échoue au lieu de passer pour « déjà absent »', async () => {
    const { siteUmami } = await creerSiteCommune({ id: 22, nom: 'X', domaine: 'x.fr' })
    process.env.UMAMI_API_KEY = 'umami_mauvaisecle00000000000000000000'
    await expect(supprimerSite(siteUmami)).rejects.toBeInstanceOf(UmamiIndisponible)
    expect(umami.sites.has(siteUmami)).toBe(true)
  })

  it('compte retiré de l’équipe (clé valide, /api/me à 200) : la suppression échoue', async () => {
    const { siteUmami } = await creerSiteCommune({ id: 23, nom: 'X', domaine: 'x.fr' })
    umami.reglages.horsEquipe = true
    await expect(supprimerSite(siteUmami)).rejects.toBeInstanceOf(UmamiIndisponible)
    umami.reglages.horsEquipe = false
    expect(umami.sites.has(siteUmami)).toBe(true)
  })

  it('Umami arrêté : erreur marquée « sans réponse »', async () => {
    umami.reglages.panne = true
    await expect(effacerHistorique('00000000-0000-5000-8000-000000000000')).rejects.toMatchObject({
      sansReponse: true,
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/umami-uuid.spec.ts tests/unit/umami-client.spec.ts`
Expected: FAIL (imports introuvables)

- [ ] **Step 4: Write the implementation**

`src/lib/umami/uuid.ts` :

```ts
import { createHash } from 'node:crypto'

/**
 * Espace de noms pdlm des sites Umami, tiré une fois pour toutes. Ne jamais
 * le changer : l'identifiant du site de chaque commune en dépend, et c'est
 * lui qui fait retomber un nouvel essai sur le même site au lieu d'un orphelin.
 */
export const ESPACE_PDLM = '521e2d21-9c59-4092-a51d-dbb0d72f1827'

/** UUID version 5 (RFC 4122, SHA-1). */
export function uuidV5(nom: string, espace: string): string {
  const h = createHash('sha1')
    .update(Buffer.from(espace.replace(/-/g, ''), 'hex'))
    .update(nom, 'utf8')
    .digest()
  h[6] = (h[6] & 0x0f) | 0x50
  h[8] = (h[8] & 0x3f) | 0x80
  const x = h.subarray(0, 16).toString('hex')
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`
}

/** Identifiant du site Umami d'une commune, déterministe par plateforme. */
export function identifiantSite(communeId: number | string): string {
  const plateforme = (process.env.PLATFORM_DOMAIN ?? '').toLowerCase()
  return uuidV5(`${plateforme}/communes/${communeId}`, ESPACE_PDLM)
}
```

`src/lib/umami/client.ts` :

```ts
import { identifiantSite } from './uuid'

/**
 * Umami ne répond pas, refuse, ou la configuration manque. Le message est
 * technique (journaux du serveur) : l'appelant choisit celui montré à l'agent.
 */
export class UmamiIndisponible extends Error {
  /** Vrai quand Umami n'a pas répondu (réseau, délai) : l'action a peut-être eu lieu. */
  readonly sansReponse: boolean

  constructor(detail: string, sansReponse = false) {
    super(`Umami : ${detail}`)
    this.name = 'UmamiIndisponible'
    this.sansReponse = sansReponse
  }
}

interface ConfigUmami {
  url: string
  cle: string
  equipe: string
  publique: string
}

function configUmami(): ConfigUmami {
  const { UMAMI_URL, UMAMI_API_KEY, UMAMI_TEAM_ID, UMAMI_PUBLIC_URL } = process.env
  if (!UMAMI_URL || !UMAMI_API_KEY || !UMAMI_TEAM_ID || !UMAMI_PUBLIC_URL) {
    throw new UmamiIndisponible(
      'configuration incomplète (UMAMI_URL, UMAMI_API_KEY, UMAMI_TEAM_ID, UMAMI_PUBLIC_URL)',
    )
  }
  return {
    url: UMAMI_URL.replace(/\/$/, ''),
    cle: UMAMI_API_KEY,
    equipe: UMAMI_TEAM_ID,
    publique: UMAMI_PUBLIC_URL.replace(/\/$/, ''),
  }
}

async function appeler(chemin: string, methode = 'GET', corps?: unknown): Promise<Response> {
  const { url, cle } = configUmami()
  try {
    return await fetch(`${url}${chemin}`, {
      method: methode,
      headers: {
        authorization: `Bearer ${cle}`,
        ...(corps !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
      signal: AbortSignal.timeout(5000),
    })
  } catch (erreur) {
    throw new UmamiIndisponible(
      `${methode} ${chemin} sans réponse (${(erreur as Error).message})`,
      true,
    )
  }
}

function exiger(reponse: Response, quoi: string): void {
  if (!reponse.ok) throw new UmamiIndisponible(`${quoi} refusé (${reponse.status})`)
}

interface Partage {
  slug: string
  parameters?: unknown
}

/**
 * Lu dans le code d'Umami et vérifié par exécution : dès que `events`,
 * `realtime` ou `revenue` est permis, un lien de partage ouvre le détail des
 * sessions. Seule la vue d'ensemble est donc acceptée.
 */
function estVueEnsembleSeule(parametres: unknown): boolean {
  return (
    typeof parametres === 'object' &&
    parametres !== null &&
    Object.keys(parametres).length === 1 &&
    (parametres as { overview?: unknown }).overview === true
  )
}

/**
 * Crée (ou retrouve) le site Umami d'une commune et son lien de partage.
 * Idempotent : l'identifiant est déterministe, et Umami 3.4.0 répond 500 sans
 * corps quand il est déjà pris — c'est la lecture du site qui tranche.
 */
export async function creerSiteCommune(commune: {
  id: number
  nom: string
  domaine: string
}): Promise<{ siteUmami: string; lienPartage: string }> {
  const { equipe, publique } = configUmami()
  const id = identifiantSite(commune.id)

  const creation = await appeler('/api/websites', 'POST', {
    id,
    name: commune.nom,
    domain: commune.domaine,
    teamId: equipe,
  })
  if (!creation.ok) {
    const lecture = await appeler(`/api/websites/${id}`)
    exiger(lecture, 'création du site')
    const site = (await lecture.json()) as { teamId?: string }
    if (site.teamId !== equipe) {
      throw new UmamiIndisponible(`le site ${id} existe hors de l’équipe UMAMI_TEAM_ID`)
    }
  }

  const liste = await appeler(`/api/websites/${id}/shares`)
  exiger(liste, 'lecture des partages')
  const { data } = (await liste.json()) as { data: Partage[] }
  let partage = data.find((p) => estVueEnsembleSeule(p.parameters))
  if (!partage) {
    const nouveau = await appeler(`/api/websites/${id}/shares`, 'POST', {
      name: 'Vue d’ensemble (maire)',
      parameters: { overview: true },
    })
    exiger(nouveau, 'création du lien de partage')
    partage = (await nouveau.json()) as Partage
  }
  return { siteUmami: id, lienPartage: `${publique}/share/${partage.slug}` }
}

/** Efface visites et sessions ; le site et son lien de partage restent (vérifié le 23/09). */
export async function effacerHistorique(siteUmami: string): Promise<void> {
  exiger(await appeler(`/api/websites/${siteUmami}/reset`, 'POST'), 'remise à zéro')
}

/**
 * Supprime définitivement le site (et son partage). Umami répond 401 aussi
 * bien pour un site absent que pour un compte qui a perdu ses droits.
 * Vérifié le 23/09 : un compte retiré de l'équipe garde `/api/me` à 200 mais
 * perd `GET /api/teams/:id`. Seul un membre de l'équipe qui ne voit pas le
 * site prouve son absence ; sinon, c'est un vrai refus.
 */
export async function supprimerSite(siteUmami: string): Promise<void> {
  const reponse = await appeler(`/api/websites/${siteUmami}`, 'DELETE')
  if (reponse.ok) return
  if (reponse.status === 401) {
    const equipe = await appeler(`/api/teams/${configUmami().equipe}`)
    if (equipe.ok && (await appeler(`/api/websites/${siteUmami}`)).status === 401) return
  }
  throw new UmamiIndisponible(`suppression du site refusée (${reponse.status})`)
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/umami-uuid.spec.ts tests/unit/umami-client.spec.ts`
Expected: PASS (2 + 10 tests)

- [ ] **Step 6: Commit**

```bash
git add tests/helpers/fauxUmami.ts src/lib/umami tests/unit/umami-uuid.spec.ts tests/unit/umami-client.spec.ts
git commit -m "Mesure d'audience — client de l'API Umami et faux Umami de test

Comportements d'Umami 3.4.0 relevés par exécution : 500 sans corps sur un
identifiant pris, 401 pour un site absent, suppression définitive.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Champs « Mesure d'audience » de la commune, activation, journal

**Files:**

- Create: `src/hooks/mesureAudience.ts`, `tests/int/mesure-activation.int.spec.ts`, `tests/unit/hostnames-reserves.spec.ts`
- Modify: `src/collections/Communes.ts` (fonction `hostnamesReserves`, `hooks`, `fields`), `src/hooks/journaliser.ts` (exporter `ecrire`)
- Generated: `src/migrations/<horodatage>_mesure_audience.ts` + `.json`, `src/migrations/index.ts`, `src/payload-types.ts`

**Interfaces:**

- Consumes: `creerSiteCommune`, `UmamiIndisponible` (tâche 4) ; `mesureInstallee` (tâche 3) ; `identifiantSite` (tâche 4)
- Produces:
  ```ts
  // src/hooks/journaliser.ts — désormais exporté, signature inchangée
  export async function ecrire(
    req,
    type: TypeJournal,
    message: string,
    commune?: number,
    communeNom?: string,
  ): Promise<void>
  // src/hooks/mesureAudience.ts
  export const MESSAGES_MESURE: {
    activee: 'Mesure d’audience activée'
    desactivee: 'Mesure d’audience désactivée'
    effacee: 'Historique de mesure effacé'
    effacementDemande: 'Effacement de l’historique de mesure demandé'
    effacementRefuse: 'Effacement de l’historique de mesure refusé par le service de mesure'
  }
  export const preparerMesure: CollectionBeforeChangeHook
  export const journaliserMesure: CollectionAfterChangeHook
  // Commune (payload-types) : mesure?: { active?: boolean | null; siteUmami?: string | null; lienPartage?: string | null }
  ```
  Colonnes Postgres attendues : `communes.mesure_active`, `communes.mesure_site_umami`, `communes.mesure_lien_partage`.

Note : `siteUmami` et `lienPartage` n'ont **pas** d'`access.update: () => false`. Dans Payload 3, le parcours des champs `beforeChange` passe **après** les hooks de collection et remettrait la valeur d'origine sur un champ refusé, ce qui effacerait l'écriture du hook. La protection est donc dans le hook, qui remplace toujours ces deux valeurs par celles de la base (Review Focus 2).

- [ ] **Step 1: Write the failing tests**

`tests/unit/hostnames-reserves.spec.ts` :

```ts
import { afterEach, describe, expect, it } from 'vitest'

import { hostnamesReserves } from '@/collections/Communes'

describe('I6 élargi — le nom de l’interface Umami est réservé', () => {
  const avant = process.env.UMAMI_PUBLIC_URL
  afterEach(() => {
    if (avant === undefined) delete process.env.UMAMI_PUBLIC_URL
    else process.env.UMAMI_PUBLIC_URL = avant
  })

  it('stats.<plateforme> ne peut pas devenir le domaine d’une commune', () => {
    process.env.UMAMI_PUBLIC_URL = 'https://stats.pdlm.example.fr'
    expect(hostnamesReserves()).toContain('stats.pdlm.example.fr')
  })

  it('sans UMAMI_PUBLIC_URL, rien de plus', () => {
    delete process.env.UMAMI_PUBLIC_URL
    expect(hostnamesReserves().some((h) => h.startsWith('stats.'))).toBe(false)
  })
})
```

`tests/int/mesure-activation.int.spec.ts` :

```ts
// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { MESSAGES_MESURE } from '@/hooks/mesureAudience'
import { getPayloadClient } from '@/lib/payload'
import { identifiantSite } from '@/lib/umami/uuid'
import type { User } from '@/payload-types'

import {
  configurerUmami,
  demarrerFauxUmami,
  EQUIPE_TEST,
  type FauxUmami,
} from '../helpers/fauxUmami'

/**
 * Activation de la mesure d'audience d'une commune (spec, section 2), contre
 * un faux Umami. Domaine d'e-mail propre à ce fichier : les suites tournent
 * en parallèle et nettoient leurs comptes par domaine.
 */
const DOMAINE_EMAIL = '@mesure-activation.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')
const S = `${Date.now()}`

let payload: Payload
let umami: FauxUmami
let communeA: number
let communeB: number
let communeC: number
let adminA: User
let adminB: User
let redacteurA: User

const appels = (methode: string, chemin: string) =>
  umami.recues.filter((r) => r.methode === methode && r.chemin === chemin)

async function messagesJournal(commune: number): Promise<string[]> {
  const res = await payload.find({
    collection: 'journal',
    where: { commune: { equals: commune } },
    sort: 'createdAt',
    limit: 100,
    overrideAccess: true,
  })
  return res.docs.map((d) => d.message)
}

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  const mk = async (lettre: string) =>
    (
      await payload.create({
        collection: 'communes',
        data: { nom: `Mesure ${lettre} ${S}`, slug: `mesure-act-${lettre}-${S}`, actif: false },
        overrideAccess: true,
      })
    ).id
  communeA = await mk('a')
  communeB = await mk('b')
  communeC = await mk('c')
  const mkUser = async (nom: string, tenants: User['tenants']) =>
    await payload.create({
      collection: 'users',
      data: { email: `${nom}-${S}${DOMAINE_EMAIL}`, password: MDP_TEST, name: nom, tenants },
      overrideAccess: true,
    })
  adminA = await mkUser('admin-a', [{ tenant: communeA, roles: ['admin'] }])
  adminB = await mkUser('admin-b', [{ tenant: communeB, roles: ['admin'] }])
  redacteurA = await mkUser('redacteur-a', [{ tenant: communeA, roles: ['redacteur'] }])
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: DOMAINE_EMAIL } },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: `mesure-act-` } },
    overrideAccess: true,
  })
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.vider()
})

describe('droits', () => {
  it('l’admin d’une autre commune ne peut pas activer', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { mesure: { active: true } },
        user: adminB,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    expect(appels('POST', '/api/websites')).toHaveLength(0)
  })

  it('le rédacteur ne peut pas activer', async () => {
    await expect(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { mesure: { active: true } },
        user: redacteurA,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('l’admin de la commune active : site déterministe, partage « vue d’ensemble » seul, journal', async () => {
    const doc = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true } },
      user: adminA,
      overrideAccess: false,
    })
    expect(doc.mesure?.active).toBe(true)
    expect(doc.mesure?.siteUmami).toBe(identifiantSite(communeA))
    expect(doc.mesure?.lienPartage).toMatch(/^https:\/\/stats\.pdlm\.test\/share\/[0-9a-f]{16}$/)
    const creation = JSON.parse(appels('POST', '/api/websites')[0].corps)
    expect(creation.teamId).toBe(EQUIPE_TEST)
    // Sans domaine canonique, le domaine informatif est le sous-domaine de plateforme.
    expect(creation.domain).toBe(`mesure-act-a-${S}.${process.env.PLATFORM_DOMAIN ?? 'localhost'}`)
    const partage = JSON.parse(
      appels('POST', `/api/websites/${identifiantSite(communeA)}/shares`)[0].corps,
    )
    expect(partage.parameters).toEqual({ overview: true })
    expect(await messagesJournal(communeA)).toContain(`${MESSAGES_MESURE.activee} — Mesure a ${S}`)
  })
})

describe('protection des champs écrits par le hook', () => {
  it('un enregistrement sans le groupe mesure ne touche à rien', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    const doc = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { horaires: 'Lundi 9 h – 12 h' },
      overrideAccess: true,
    })
    expect(doc.mesure).toEqual(avant.mesure)
    expect(umami.recues).toHaveLength(0)
  })

  it('siteUmami forgé par le client ignoré', async () => {
    const doc = await payload.update({
      collection: 'communes',
      id: communeB,
      data: { mesure: { siteUmami: 'forge', lienPartage: 'https://ailleurs/' } },
      overrideAccess: true,
    })
    expect(doc.mesure?.siteUmami ?? null).toBeNull()
    expect(doc.mesure?.lienPartage ?? null).toBeNull()
    const surA = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true, siteUmami: identifiantSite(communeB) } },
      overrideAccess: true,
    })
    expect(surA.mesure?.siteUmami).toBe(identifiantSite(communeA))
  })

  it('mesure: null ou lienPartage seul sur une commune active : champs du hook conservés', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: null } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { lienPartage: 'https://ailleurs/' } },
      overrideAccess: true,
    })
    const apres = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    expect(apres.mesure?.active).toBe(true)
    expect(apres.mesure?.siteUmami).toBe(avant.mesure?.siteUmami)
    expect(apres.mesure?.lienPartage).toBe(avant.mesure?.lienPartage)
  })
})

describe('couper puis réactiver', () => {
  const couper = () =>
    payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: false } },
      overrideAccess: true,
    })
  const reactiver = () =>
    payload.update({
      collection: 'communes',
      id: communeA,
      data: { mesure: { active: true } },
      overrideAccess: true,
    })

  it('couper n’appelle pas Umami ; réactiver revérifie sans rien créer ; deux entrées de journal', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
    })
    const coupe = await couper()
    expect(coupe.mesure?.siteUmami).toBe(identifiantSite(communeA))
    expect(umami.recues).toHaveLength(0)
    const reactive = await reactiver()
    expect(reactive.mesure?.lienPartage).toBe(avant.mesure?.lienPartage)
    expect(umami.sites.size).toBeGreaterThan(0)
    expect(appels('POST', `/api/websites/${identifiantSite(communeA)}/shares`)).toHaveLength(0)
    const messages = await messagesJournal(communeA)
    expect(messages).toContain(`${MESSAGES_MESURE.desactivee} — Mesure a ${S}`)
    expect(messages.filter((m) => m.startsWith(MESSAGES_MESURE.activee))).toHaveLength(2)
  })

  it('réactivation répare un site disparu d’Umami (même identifiant, nouveau partage)', async () => {
    const id = identifiantSite(communeA)
    await couper()
    umami.sites.delete(id)
    umami.partages.delete(id)
    const reactive = await reactiver()
    expect(reactive.mesure?.siteUmami).toBe(id)
    expect(umami.sites.has(id)).toBe(true)
    expect(appels('POST', `/api/websites/${id}/shares`)).toHaveLength(1)
    expect(reactive.mesure?.lienPartage).toBe(
      `https://stats.pdlm.test/share/${umami.partages.get(id)?.[0].slug}`,
    )
  })

  it('réactivation refusée quand Umami n’est plus installé, même avec un site existant', async () => {
    await couper()
    delete process.env.UMAMI_URL
    await expect(reactiver()).rejects.toThrow(/non installée/)
  })
})

describe('refus', () => {
  it('activation à la création', async () => {
    await expect(
      payload.create({
        collection: 'communes',
        data: {
          nom: `Mesure d ${S}`,
          slug: `mesure-act-d-${S}`,
          actif: false,
          mesure: { active: true },
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/une fois la commune créée/)
  })

  it('Umami arrêté : refus clair, la mesure reste coupée', async () => {
    umami.reglages.panne = true
    await expect(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { mesure: { active: true } },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({
      status: 503,
      isPublic: true,
      message: expect.stringMatching(/ne répond pas ; la mesure reste coupée/),
    })
    const b = await payload.findByID({ collection: 'communes', id: communeB, overrideAccess: true })
    expect(b.mesure?.active ?? false).toBe(false)
  })

  it('Umami non installé : refus', async () => {
    delete process.env.UMAMI_URL
    await expect(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { mesure: { active: true } },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/non installée/)
  })
})

describe('nouvel essai après un échec côté pdlm', () => {
  it('retombe sur le site et le partage déjà créés dans Umami', async () => {
    const id = identifiantSite(communeC)
    umami.sites.set(id, { teamId: EQUIPE_TEST, name: 'C', domain: 'c.fr' })
    umami.partages.set(id, [
      { id: 'p', slug: 'abcdef0123456789', name: 'x', parameters: { overview: true } },
    ])
    const doc = await payload.update({
      collection: 'communes',
      id: communeC,
      data: { mesure: { active: true } },
      overrideAccess: true,
    })
    expect(doc.mesure?.lienPartage).toBe('https://stats.pdlm.test/share/abcdef0123456789')
    expect(appels('POST', `/api/websites/${id}/shares`)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/hostnames-reserves.spec.ts tests/int/mesure-activation.int.spec.ts`
Expected: FAIL (`@/hooks/mesureAudience` introuvable ; `stats.pdlm.example.fr` absent)

- [ ] **Step 3: Export `ecrire`**

Dans `src/hooks/journaliser.ts`, remplacer `async function ecrire(` par :

```ts
/** Écrit une entrée de journal dans la transaction de `req` (I12). Exportée pour les messages propres à la mesure d'audience. */
export async function ecrire(
```

- [ ] **Step 4: Write the hooks**

`src/hooks/mesureAudience.ts` :

```ts
import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type PayloadRequest,
} from 'payload'

import { mesureInstallee } from '../lib/mesure/etat'
import { creerSiteCommune } from '../lib/umami/client'
import { ecrire } from './journaliser'

/** I12 élargi : messages explicites, au lieu du seul « Modification — <commune> ». */
export const MESSAGES_MESURE = {
  activee: 'Mesure d’audience activée',
  desactivee: 'Mesure d’audience désactivée',
  effacee: 'Historique de mesure effacé',
  effacementDemande: 'Effacement de l’historique de mesure demandé',
  effacementRefuse: 'Effacement de l’historique de mesure refusé par le service de mesure',
} as const

interface Mesure {
  active?: boolean | null
  siteUmami?: string | null
  lienPartage?: string | null
}

const mesureDe = (doc: unknown): Mesure | undefined =>
  (doc as { mesure?: Mesure | null } | undefined)?.mesure ?? undefined

/** Domaine informatif du site Umami : le domaine canonique, sinon le sous-domaine de plateforme. */
async function domaineInformatif(
  req: PayloadRequest,
  communeId: number,
  slug: string,
): Promise<string> {
  const res = await req.payload.find({
    collection: 'domaines',
    where: { and: [{ commune: { equals: communeId } }, { canonique: { equals: true } }] },
    limit: 1,
    overrideAccess: true,
    req,
  })
  return res.docs[0]?.hostname ?? `${slug}.${process.env.PLATFORM_DOMAIN ?? 'localhost'}`
}

/**
 * `siteUmami` et `lienPartage` ne sont écrits que par ce hook : la valeur
 * reçue du client est toujours remplacée par celle de la base, y compris
 * quand le client envoie `mesure: null`.
 *
 * Chaque passage de « coupée » à « active » vérifie le site dans Umami, même
 * s'il existe déjà : l'appel est idempotent (identifiant déterministe,
 * partage réutilisé) et répare le cas où le site a disparu d'Umami — par
 * exemple une suppression de commune dont Umami a exécuté le DELETE avant que
 * la transaction pdlm soit annulée. Un échec refuse l'enregistrement, la
 * mesure reste coupée.
 */
export const preparerMesure: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (data?.mesure === undefined) return data
  const avant = mesureDe(originalDoc)
  const mesure: Mesure = {
    // `mesure: null` n'est pas une demande de coupure : l'état actuel est gardé.
    ...(data.mesure ?? { active: avant?.active ?? false }),
    siteUmami: avant?.siteUmami ?? null,
    lienPartage: avant?.lienPartage ?? null,
  }
  data.mesure = mesure
  const activation = mesure.active === true && avant?.active !== true
  if (!activation) return data

  // À la création, la commune n'a pas encore d'identifiant (même piège que I6).
  if (operation === 'create') {
    throw new APIError('Activez la mesure d’audience une fois la commune créée.', 400, null, true)
  }
  if (!mesureInstallee()) {
    throw new APIError('Mesure d’audience non installée sur cette plateforme.', 400, null, true)
  }
  const id = Number(originalDoc.id)
  try {
    const site = await creerSiteCommune({
      id,
      nom: String(data.nom ?? originalDoc.nom),
      domaine: await domaineInformatif(req, id, String(originalDoc.slug)),
    })
    mesure.siteUmami = site.siteUmami
    mesure.lienPartage = site.lienPartage
  } catch (erreur) {
    req.payload.logger.error({ err: erreur }, 'Activation de la mesure d’audience impossible')
    throw new APIError(
      'Le service de mesure d’audience ne répond pas ; la mesure reste coupée. Réessayez plus tard.',
      503,
      null,
      true,
    )
  }
  return data
}

/** Journalise l'activation et la désactivation (I12). */
export const journaliserMesure: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update') return doc
  const avant = mesureDe(previousDoc)?.active === true
  const apres = mesureDe(doc)?.active === true
  if (avant !== apres) {
    const nom = String((doc as { nom?: unknown }).nom)
    await ecrire(
      req,
      'commune',
      `${apres ? MESSAGES_MESURE.activee : MESSAGES_MESURE.desactivee} — ${nom}`,
      Number(doc.id),
      nom,
    )
  }
  return doc
}
```

- [ ] **Step 5: Wire fields, hooks and reserved hostname in `src/collections/Communes.ts`**

Import, en tête :

```ts
import { journaliserMesure, preparerMesure } from '../hooks/mesureAudience'
```

Dans `hostnamesReserves()`, juste avant `return [...liste]` :

```ts
// I6 élargi : l'interface Umami (stats.<plateforme>) n'est pas un domaine communal.
if (process.env.UMAMI_PUBLIC_URL) liste.add(new URL(process.env.UMAMI_PUBLIC_URL).hostname)
```

Dans `hooks.beforeChange`, **en dernier** (après `validerRelationsTenant(...)`, pour ne rien créer dans Umami si une autre validation échoue) :

```ts
      preparerMesure,
```

Remplacer `afterChange: [journaliser('commune')],` par :

```ts
    afterChange: [journaliser('commune'), journaliserMesure],
```

À la fin de `fields`, après le groupe `apparence` :

```ts
    {
      name: 'mesure',
      type: 'group',
      label: 'Mesure d’audience',
      admin: {
        description:
          'Sans cookie ni bandeau, dans l’exemption de la CNIL. Page d’information publique : /mesure-d-audience.',
      },
      fields: [
        {
          name: 'active',
          type: 'checkbox',
          defaultValue: false,
          label: 'Mesurer l’audience du site public',
          admin: {
            // Lu au démarrage du serveur : sans UMAMI_URL, la fonction n'existe pas.
            readOnly: !process.env.UMAMI_URL,
            description: process.env.UMAMI_URL
              ? 'Couper n’efface rien : l’historique reste jusqu’à sa purge à 25 mois.'
              : 'Mesure d’audience non installée sur cette plateforme',
          },
        },
        {
          name: 'siteUmami',
          type: 'text',
          label: 'Identifiant du site de mesure',
          admin: { readOnly: true },
        },
        {
          name: 'lienPartage',
          type: 'text',
          label: 'Lien de partage',
          admin: {
            readOnly: true,
            description: 'À transmettre au maire : vue d’ensemble, sans le détail des visites',
          },
        },
      ],
    },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --config ./vitest.config.mts tests/unit/hostnames-reserves.spec.ts tests/int/mesure-activation.int.spec.ts`
Expected: PASS (2 + 13 tests). La base de test est créée par `push` : pas de migration nécessaire ici.

- [ ] **Step 7: Generate migration, types**

```bash
docker compose -f docker-compose.dev.yml up -d postgres
npm run payload migrate:status          # la base de dev doit être à jour avant de générer
npm run payload migrate:create mesure_audience
npm run generate:types
```

Vérifier le SQL généré (`src/migrations/*_mesure_audience.ts`) : il ajoute exactement `mesure_active` (boolean, défaut false), `mesure_site_umami` (varchar), `mesure_lien_partage` (varchar) à `communes`, et rien d'autre. S'il touche à une autre table, s'arrêter et le signaler. Puis :

```bash
npm run payload migrate
npm run typecheck
```

Expected: migration appliquée ; `typecheck` sans erreur.

- [ ] **Step 8: Run the full unit and integration suites**

Run: `npm run test:unit && npm run test:int`
Expected: PASS, y compris `journal.int.spec.ts` et `communes-*.int.spec.ts` (non-régression d'I6 et I12).

- [ ] **Step 9: Commit**

```bash
git add src/hooks/mesureAudience.ts src/hooks/journaliser.ts src/collections/Communes.ts \
  src/migrations/*_mesure_audience.* src/migrations/index.ts src/payload-types.ts \
  tests/int/mesure-activation.int.spec.ts tests/unit/hostnames-reserves.spec.ts
git commit -m "Mesure d'audience — interrupteur par commune, création du site Umami, journal

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Suppression d'une commune et effacement de l'historique

**Files:**

- Create: `src/endpoints/effacerHistoriqueMesure.ts`, `src/components/admin/EffacerHistorique.tsx`, `tests/int/mesure-historique.int.spec.ts`
- Modify: `src/hooks/mesureAudience.ts` (ajout `supprimerSiteMesure`), `src/collections/Communes.ts` (`endpoints`, `afterDelete`, champ `ui`)
- Generated: `src/app/(payload)/admin/importMap.js`

**Interfaces:**

- Consumes: `effacerHistorique`, `supprimerSite` (tâche 4) ; `ecrire`, `MESSAGES_MESURE` (tâche 5) ; `isOperateur`, `aRoleSur` (`src/access/roles.ts`)
- Produces:

  ```ts
  export const supprimerSiteMesure: CollectionAfterDeleteHook // src/hooks/mesureAudience.ts
  export const effacerHistoriqueMesure: Endpoint // POST /api/communes/:id/mesure/effacer
  // Réponses JSON { message: string } : 200 effacé, 403 droits, 404 pas d'historique,
  // 500 journal refusé (rien tenté), 503 Umami refuse, 504 Umami sans réponse (effacement incertain)
  ```

- [ ] **Step 1: Write the failing test**

`tests/int/mesure-historique.int.spec.ts` :

```ts
// @vitest-environment node
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { effacerHistoriqueMesure } from '@/endpoints/effacerHistoriqueMesure'
import { MESSAGES_MESURE } from '@/hooks/mesureAudience'
import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'

import { configurerUmami, demarrerFauxUmami, type FauxUmami } from '../helpers/fauxUmami'

const DOMAINE_EMAIL = '@mesure-historique.pdlm.invalid'
const MDP_TEST = ['motdepasse', '1234'].join('-')
const S = `${Date.now()}`

let payload: Payload
let umami: FauxUmami
let communeA: number
let siteA: string
let adminA: User
let adminB: User
let redacteurA: User
let operateur: User

/** Requête Payload complète (transactions comprises), comme celle que reçoit le vrai point d'accès. */
async function requete(
  user: User | null,
  id: number,
  journalEnPanne = false,
): Promise<PayloadRequest> {
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { id: String(id) }
  if (!user) req.user = null
  if (journalEnPanne) {
    req.payload = Object.create(payload, {
      create: { value: () => Promise.reject(new Error('écriture du journal refusée')) },
    }) as Payload
  }
  return req
}

const effacer = async (user: User | null, id: number, journalEnPanne = false) =>
  effacerHistoriqueMesure.handler(await requete(user, id, journalEnPanne))

async function creerCommuneMesuree(lettre: string): Promise<{ id: number; site: string }> {
  const { id } = await payload.create({
    collection: 'communes',
    data: { nom: `Historique ${lettre} ${S}`, slug: `mesure-hist-${lettre}-${S}`, actif: false },
    overrideAccess: true,
  })
  const doc = await payload.update({
    collection: 'communes',
    id,
    data: { mesure: { active: true } },
    overrideAccess: true,
  })
  return { id, site: String(doc.mesure?.siteUmami) }
}

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  ;({ id: communeA, site: siteA } = await creerCommuneMesuree('a'))
  const communeB = (
    await payload.create({
      collection: 'communes',
      data: { nom: `Historique b ${S}`, slug: `mesure-hist-b-${S}`, actif: false },
      overrideAccess: true,
    })
  ).id
  const mkUser = async (nom: string, data: Partial<User>) =>
    await payload.create({
      collection: 'users',
      data: {
        email: `${nom}-${S}${DOMAINE_EMAIL}`,
        password: MDP_TEST,
        name: nom,
        ...data,
      } as User,
      overrideAccess: true,
    })
  adminA = await mkUser('admin-a', { tenants: [{ tenant: communeA, roles: ['admin'] }] })
  adminB = await mkUser('admin-b', { tenants: [{ tenant: communeB, roles: ['admin'] }] })
  redacteurA = await mkUser('redacteur-a', {
    tenants: [{ tenant: communeA, roles: ['redacteur'] }],
  })
  operateur = await mkUser('operateur', { role: 'operateur' })
})

afterAll(async () => {
  await payload.delete({
    collection: 'users',
    where: { email: { like: DOMAINE_EMAIL } },
    overrideAccess: true,
  })
  umami.reglages.panne = false
  await payload.delete({
    collection: 'communes',
    where: { slug: { like: 'mesure-hist-' } },
    overrideAccess: true,
  })
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.reglages.horsEquipe = false
  umami.vider()
})

const remisesAZero = () => umami.recues.filter((r) => r.chemin === `/api/websites/${siteA}/reset`)

async function journalEffacement(commune: number, message: string = MESSAGES_MESURE.effacee) {
  const res = await payload.count({
    collection: 'journal',
    where: { and: [{ commune: { equals: commune } }, { message: { like: message } }] },
    overrideAccess: true,
  })
  return res.totalDocs
}

describe('« Supprimer l’historique »', () => {
  it('refusé à l’admin d’une autre commune, au rédacteur, à l’anonyme', async () => {
    for (const user of [adminB, redacteurA, null]) {
      const r = await effacer(user, communeA)
      expect(r.status).toBe(403)
    }
    expect(remisesAZero()).toHaveLength(0)
  })

  it('l’admin de la commune efface : demande au journal, remise à zéro, puis « effacé »', async () => {
    const r = await effacer(adminA, communeA)
    expect(r.status).toBe(200)
    expect(remisesAZero()).toHaveLength(1)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(1)
    expect(await journalEffacement(communeA)).toBe(1)
  })

  it('l’opérateur aussi', async () => {
    expect((await effacer(operateur, communeA)).status).toBe(200)
  })

  it('Umami refuse : 503 ; au journal, la demande et le refus', async () => {
    const effacees = await journalEffacement(communeA)
    const demandes = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    umami.reglages.horsEquipe = true
    const r = await effacer(operateur, communeA)
    expect(r.status).toBe(503)
    expect((await r.json()).message).toMatch(/rien n’a été effacé/)
    expect(await journalEffacement(communeA)).toBe(effacees)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(demandes + 1)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementRefuse)).toBe(1)
  })

  it('Umami ne répond pas : 504, état incertain annoncé ; la demande reste au journal', async () => {
    const effacees = await journalEffacement(communeA)
    const demandes = await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)
    umami.reglages.panne = true
    const r = await effacer(operateur, communeA)
    expect(r.status).toBe(504)
    expect((await r.json()).message).toMatch(/a peut-être eu lieu/)
    expect(await journalEffacement(communeA)).toBe(effacees)
    expect(await journalEffacement(communeA, MESSAGES_MESURE.effacementDemande)).toBe(demandes + 1)
  })

  it('journal en panne : Umami n’est pas appelé, rien n’est effacé', async () => {
    const r = await effacer(operateur, communeA, true)
    expect(r.status).toBe(500)
    expect(remisesAZero()).toHaveLength(0)
  })

  it('commune sans site de mesure : 404', async () => {
    const { id } = await payload.create({
      collection: 'communes',
      data: { nom: `Historique c ${S}`, slug: `mesure-hist-c-${S}`, actif: false },
      overrideAccess: true,
    })
    expect((await effacer(operateur, id)).status).toBe(404)
  })
})

describe('suppression d’une commune', () => {
  it('supprime son site Umami', async () => {
    const { id, site } = await creerCommuneMesuree('d')
    await payload.delete({ collection: 'communes', id, overrideAccess: true })
    expect(
      umami.recues.some((r) => r.methode === 'DELETE' && r.chemin === `/api/websites/${site}`),
    ).toBe(true)
    expect(umami.sites.has(site)).toBe(false)
  })

  it('Umami arrêté : la suppression est refusée, la commune reste', async () => {
    const { id } = await creerCommuneMesuree('e')
    umami.reglages.panne = true
    await expect(
      payload.delete({ collection: 'communes', id, overrideAccess: true }),
    ).rejects.toThrow(/n’a pas été supprimée/)
    umami.reglages.panne = false
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(1)
  })

  it('suppression sans UMAMI_URL : refusée, sauf désinstallation déclarée', async () => {
    const { id, site } = await creerCommuneMesuree('g')
    delete process.env.UMAMI_URL
    await expect(
      payload.delete({ collection: 'communes', id, overrideAccess: true }),
    ).rejects.toThrow(/n’est pas configuré/)
    expect(umami.sites.has(site)).toBe(true)
    process.env.UMAMI_DESINSTALLE = '1'
    try {
      await payload.delete({ collection: 'communes', id, overrideAccess: true })
    } finally {
      delete process.env.UMAMI_DESINSTALLE
    }
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(0)
  })

  it('site déjà absent d’Umami : la suppression passe', async () => {
    const { id, site } = await creerCommuneMesuree('f')
    umami.sites.delete(site)
    await payload.delete({ collection: 'communes', id, overrideAccess: true })
    const reste = await payload.count({
      collection: 'communes',
      where: { id: { equals: id } },
      overrideAccess: true,
    })
    expect(reste.totalDocs).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-historique.int.spec.ts`
Expected: FAIL (`@/endpoints/effacerHistoriqueMesure` introuvable)

- [ ] **Step 3: Write the deletion hook**

Ajouter à `src/hooks/mesureAudience.ts` (compléter les imports : `CollectionAfterDeleteHook` depuis `payload`, `supprimerSite` depuis `../lib/umami/client`) :

```ts
/**
 * Suppression d'une commune : son site Umami est supprimé dans la
 * transaction, en DERNIER (après le journal) : si Umami refuse, tout est
 * annulé, journal compris ; si le journal échoue, Umami n'est jamais appelé.
 * Reste un cas : Umami a supprimé, puis la validation de la transaction
 * échoue — la commune garde son `siteUmami`, et la prochaine activation
 * recrée le site sous le même identifiant (`preparerMesure` revérifie le site
 * à chaque activation ; vérifié : Umami accepte de recréer l'identifiant).
 *
 * Sans UMAMI_URL, la suppression est refusée : une variable perdue au
 * redéploiement ne prouve pas que les données de mesure ont disparu. Seule une
 * désinstallation déclarée (`UMAMI_DESINSTALLE=1`, après suppression de la
 * base `umami`, README) laisse passer, avec un avertissement.
 */
export const supprimerSiteMesure: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const site = mesureDe(doc)?.siteUmami
  if (!site) return doc
  if (!mesureInstallee()) {
    if (process.env.UMAMI_DESINSTALLE === '1') {
      req.payload.logger.warn(`Mesure d’audience désinstallée : site Umami ${site} non supprimé`)
      return doc
    }
    throw new APIError(
      'Cette commune a un historique de mesure d’audience, mais le service de mesure n’est pas configuré (UMAMI_URL) : la commune n’a pas été supprimée.',
      400,
      null,
      true,
    )
  }
  try {
    await supprimerSite(site)
  } catch (erreur) {
    req.payload.logger.error({ err: erreur }, 'Suppression du site de mesure impossible')
    throw new APIError(
      'Le service de mesure d’audience ne répond pas ; la commune n’a pas été supprimée. Réessayez plus tard.',
      503,
      null,
      true,
    )
  }
  return doc
}
```

- [ ] **Step 4: Write the endpoint**

`src/endpoints/effacerHistoriqueMesure.ts` :

```ts
import type { Endpoint } from 'payload'

import { aRoleSur, isOperateur } from '../access/roles'
import { ecrire } from '../hooks/journaliser'
import { MESSAGES_MESURE } from '../hooks/mesureAudience'
import { effacerHistorique, UmamiIndisponible } from '../lib/umami/client'

/**
 * POST /api/communes/:id/mesure/effacer — réservé à l'admin de la commune et
 * à l'opérateur.
 *
 * I12 face à une action externe irréversible : l'intention est journalisée
 * et VALIDÉE avant l'appel à Umami (hors transaction : `req` d'un point
 * d'accès n'en ouvre pas), puis le résultat est journalisé. Un journal refusé
 * empêche l'effacement. Quoi qu'il arrive ensuite (Umami sans réponse, panne
 * de pdlm, réponse perdue par le navigateur), l'entrée « demandé » reste : une
 * demande sans entrée « effacé » ni « refusé » signale un état incertain.
 */
export const effacerHistoriqueMesure: Endpoint = {
  path: '/:id/mesure/effacer',
  method: 'post',
  handler: async (req) => {
    const id = Number(req.routeParams?.id)
    if (!req.user || !(isOperateur(req.user) || aRoleSur(req.user, id, 'admin'))) {
      return Response.json(
        { message: 'Action réservée à l’administrateur de la commune.' },
        { status: 403 },
      )
    }
    const commune = await req.payload
      .findByID({ collection: 'communes', id, overrideAccess: true, req })
      .catch(() => null)
    const site = commune?.mesure?.siteUmami
    if (!commune || !site) {
      return Response.json(
        { message: 'Cette commune n’a pas d’historique de mesure.' },
        { status: 404 },
      )
    }
    const journaliser = (message: string) =>
      ecrire(req, 'commune', `${message} — ${commune.nom}`, commune.id, commune.nom)

    try {
      await journaliser(MESSAGES_MESURE.effacementDemande)
    } catch (erreur) {
      req.payload.logger.error({ err: erreur }, 'Journal refusé : effacement non tenté')
      return Response.json(
        { message: 'Le journal n’a pas pu être écrit ; rien n’a été effacé.' },
        { status: 500 },
      )
    }

    try {
      await effacerHistorique(site)
    } catch (erreur) {
      req.payload.logger.error({ err: erreur }, 'Effacement de l’historique de mesure impossible')
      if (erreur instanceof UmamiIndisponible && erreur.sansReponse) {
        return Response.json(
          {
            message:
              'Le service de mesure d’audience n’a pas confirmé l’effacement ; il a peut-être eu lieu. Réessayez : un nouvel effacement est sans effet s’il est déjà fait.',
          },
          { status: 504 },
        )
      }
      await journaliser(MESSAGES_MESURE.effacementRefuse)
      return Response.json(
        {
          message:
            'Le service de mesure d’audience a refusé l’effacement ; rien n’a été effacé. Réessayez plus tard.',
        },
        { status: 503 },
      )
    }

    await journaliser(MESSAGES_MESURE.effacee)
    return Response.json({ message: 'Historique effacé.' })
  },
}
```

- [ ] **Step 5: Write the admin button**

Lire d'abord la documentation Payload des composants personnalisés (`node_modules/payload/dist/admin/…` ou https://payloadcms.com/docs/custom-components/overview) pour confirmer : chemin relatif à `admin.importMap.baseDir` (ici `src/`), export nommé après `#`.

`src/components/admin/EffacerHistorique.tsx` :

```tsx
'use client'

import { Button, useConfig, useDocumentInfo } from '@payloadcms/ui'
import { useState } from 'react'

type Etape = 'repos' | 'confirmation' | 'envoi' | 'fait' | 'erreur'

/**
 * « Supprimer l’historique » : confirmation en deux temps qui dit ce qui sera
 * effacé, puis appel du point d'accès (les droits y sont vérifiés, pas ici).
 */
export function EffacerHistorique() {
  const { id } = useDocumentInfo()
  const { config } = useConfig()
  const [etape, setEtape] = useState<Etape>('repos')
  const [message, setMessage] = useState('')

  async function effacer() {
    setEtape('envoi')
    try {
      const reponse = await fetch(
        `${config.serverURL ?? ''}${config.routes.api}/communes/${id}/mesure/effacer`,
        { method: 'POST', credentials: 'include' },
      )
      const corps = (await reponse.json().catch(() => ({}))) as { message?: string }
      setMessage(corps.message ?? '')
      setEtape(reponse.ok ? 'fait' : 'erreur')
    } catch {
      // La demande a pu partir : ne jamais affirmer que rien n'a été effacé.
      setMessage('Le serveur n’a pas répondu ; l’effacement a peut-être eu lieu. Consultez le journal ou réessayez.')
      setEtape('erreur')
    }
  }

  return (
    <div className="field-type">
      <p className="field-label">Historique de mesure d’audience</p>
      {etape === 'repos' && (
        <Button buttonStyle="secondary" onClick={() => setEtape('confirmation')}>
          Supprimer l’historique
        </Button>
      )}
      {etape === 'confirmation' && (
        <div role="alert">
          <p>
            Toutes les visites enregistrées pour cette commune seront effacées définitivement. Le
            site de mesure et le lien de partage du maire sont conservés.
          </p>
          <Button onClick={effacer}>Confirmer l’effacement</Button>{' '}
          <Button buttonStyle="secondary" onClick={() => setEtape('repos')}>
            Annuler
          </Button>
        </div>
      )}
      {etape === 'envoi' && <p aria-live="polite">Effacement en cours…</p>}
      {(etape === 'fait' || etape === 'erreur') && <p role="status">{message}</p>}
    </div>
  )
}
```

- [ ] **Step 6: Wire into `src/collections/Communes.ts`**

Imports (les deux lignes existantes qui importent `../access/roles` sont remplacées par la première ci-dessous) :

```ts
import { aRoleSur, communesAvecRole, idDe, isOperateur } from '../access/roles'
import { effacerHistoriqueMesure } from '../endpoints/effacerHistoriqueMesure'
import { journaliserMesure, preparerMesure, supprimerSiteMesure } from '../hooks/mesureAudience'
```

Au niveau de la collection, après `access` :

```ts
  endpoints: [effacerHistoriqueMesure],
```

Remplacer `afterDelete: [journaliserSuppression('commune')],` par :

```ts
    // Umami en dernier : s'il refuse, tout est annulé, journal compris ; si le
    // journal échoue, Umami n'est jamais appelé.
    afterDelete: [journaliserSuppression('commune'), supprimerSiteMesure],
```

Dans le groupe `mesure`, après `lienPartage` :

```ts
        {
          name: 'effacerHistorique',
          type: 'ui',
          admin: {
            // Montré seulement à qui peut effacer (le point d'accès revérifie).
            condition: (data, siblingData, { user }) =>
              Boolean(siblingData?.siteUmami) &&
              (isOperateur(user) || aRoleSur(user, data?.id, 'admin')),
            components: { Field: '/components/admin/EffacerHistorique#EffacerHistorique' },
          },
        },
```

Puis :

```bash
npm run generate:importmap
grep -n "EffacerHistorique" "src/app/(payload)/admin/importMap.js"
```

Expected: une ligne d'import et une entrée de table pour `EffacerHistorique`.

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-historique.int.spec.ts && npm run test:int && npm run typecheck`
Expected: PASS (11 tests) ; suite complète et typecheck verts. Si `typecheck` refuse `user` dans `condition` (type `TypedUser` contre `UtilisateurAcces`), le convertir explicitement (`user as UtilisateurAcces`), sans changer la logique.

- [ ] **Step 8: Check the button by hand**

```bash
npm run dev
```

Dans l'admin, sur une commune dont la mesure est active (nécessite la pile de la tâche 11, sinon la vérification est faite à la tâche 15) : le bouton est visible ; « Supprimer l’historique » affiche la confirmation ; « Annuler » revient ; le bouton est absent sur une commune sans `siteUmami`.

- [ ] **Step 9: Commit**

```bash
git add src/hooks/mesureAudience.ts src/endpoints/effacerHistoriqueMesure.ts \
  src/components/admin/EffacerHistorique.tsx src/collections/Communes.ts \
  "src/app/(payload)/admin/importMap.js" tests/int/mesure-historique.int.spec.ts
git commit -m "Mesure d'audience — effacement de l'historique et suppression du site Umami

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Le relais de collecte

**Files:**

- Create: `src/lib/mesure/relais.ts`, `src/app/(frontend)/mesure/api/send/route.ts`, `tests/helpers/communeTest.ts`, `tests/int/mesure-relais.int.spec.ts`
- Modify: `src/lib/commune.ts` (extraction de `communeDuHost`), `tests/unit/proxy.spec.ts` (frontière de confiance de `x-commune-host`)

**Interfaces:**

- Consumes: `filtrerVisite` (2), `ipVisiteur`, `tronquerIp` (1), `COOKIE_OPPOSITION`, `estOppose`, `lireCookie` (3), `siteMesure`, `CommuneMesurable` (3)
- Produces:

  ```ts
  // src/lib/commune.ts
  export async function communeDuHost(hostBrut: string): Promise<Commune | null> // non mémoïsée
  export const resolveCommune // inchangée pour les appelants : cache(() => communeDuHost(x-commune-host))
  // src/lib/mesure/relais.ts
  export const TAILLE_MAX_OCTETS = 4096
  export const DELAI_UMAMI_MS = 3000
  export async function relayer(
    requete: Request,
    commune: CommuneMesurable | null,
    host: string,
  ): Promise<Response>
  // route : POST /mesure/api/send
  // tests/helpers/communeTest.ts
  export async function creerCommuneActive(
    payload: Payload,
    prefixe: string,
  ): Promise<{ id: number; host: string }>
  export async function supprimerCommuneTest(payload: Payload, id: number): Promise<void>
  ```

- [ ] **Step 1: Write the test helper**

`tests/helpers/communeTest.ts` :

```ts
import type { Payload } from 'payload'

/**
 * Commune active avec un domaine propre canonique : c'est ce qui la rend
 * résoluble par `communeDuHost` (I6 exige le domaine avant l'activation).
 */
export async function creerCommuneActive(
  payload: Payload,
  prefixe: string,
): Promise<{ id: number; host: string }> {
  const suffixe = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
  const host = `${prefixe}-${suffixe}.test`
  const { id } = await payload.create({
    collection: 'communes',
    data: { nom: `${prefixe} ${suffixe}`, slug: `${prefixe}-${suffixe}`, actif: false },
    overrideAccess: true,
  })
  await payload.create({
    collection: 'domaines',
    data: { hostname: host, commune: id, canonique: true },
    overrideAccess: true,
  })
  await payload.update({ collection: 'communes', id, data: { actif: true }, overrideAccess: true })
  return { id, host }
}

/** Domaines d'abord : une commune encore rattachée ne se supprime pas (décision f). */
export async function supprimerCommuneTest(payload: Payload, id: number): Promise<void> {
  await payload.delete({
    collection: 'domaines',
    where: { commune: { equals: id } },
    overrideAccess: true,
  })
  await payload.delete({ collection: 'communes', id, overrideAccess: true })
}
```

Si la collection `domaines` exige d'autres champs obligatoires que `hostname`, `commune`, `canonique`, les ajouter ici (lire `src/collections/Domaines.ts`).

- [ ] **Step 2: Write the failing test**

`tests/int/mesure-relais.int.spec.ts` :

```ts
// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { POST } from '@/app/(frontend)/mesure/api/send/route'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { configurerUmami, demarrerFauxUmami, type FauxUmami } from '../helpers/fauxUmami'

/**
 * I18 — rien d'autre que la liste blanche et l'IP tronquée ne sort vers Umami.
 * I19 — Umami ne reçoit que les visites d'une commune mesurée, sous son site.
 * I20 — un visiteur opposé n'est pas transmis.
 */
let payload: Payload
let umami: FauxUmami
let a: { id: number; host: string }
let b: { id: number; host: string }
let siteA: string

const PAGE_VUE = {
  type: 'event',
  payload: { website: 'x', hostname: 'x', url: 'https://ignore/actualites', title: 'Actus' },
}

function envoyer(host: string, corps: unknown, entetes: Record<string, string> = {}) {
  return POST(
    new Request('http://interne/mesure/api/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
        'x-commune-host': host,
        ...entetes,
      },
      body: typeof corps === 'string' ? corps : JSON.stringify(corps),
    }),
  )
}

const envois = () => umami.recues.filter((r) => r.chemin === '/api/send')

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  configurerUmami(umami.url)
  payload = await getPayloadClient()
  a = await creerCommuneActive(payload, 'relais-a')
  b = await creerCommuneActive(payload, 'relais-b')
  const doc = await payload.update({
    collection: 'communes',
    id: a.id,
    data: { mesure: { active: true } },
    overrideAccess: true,
  })
  siteA = String(doc.mesure?.siteUmami)
})

afterAll(async () => {
  await supprimerCommuneTest(payload, a.id)
  await supprimerCommuneTest(payload, b.id)
  await umami.fermer()
})

beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.reglages.delaiEnvoiMs = 0
  umami.vider()
})

describe('I18 — ce qui sort vers Umami', () => {
  it('liste blanche, IP de droite tronquée, en-têtes limités, réponse d’Umami renvoyée', async () => {
    const reponse = await envoyer(
      a.host,
      {
        type: 'event',
        payload: {
          website: 'autre',
          hostname: 'ailleurs.fr',
          url: `https://${a.host}/actualites?utm_source=x#haut`,
          referrer: 'https://moteur.fr/recherche?q=mairie',
          screen: '1280x720',
          language: 'fr-FR',
          ip: '8.8.8.8',
          id: 'visiteur',
          userAgent: 'Faux/1.0',
          data: { a: 1 },
        },
      },
      {
        'x-forwarded-for': '1.2.3.4, 90.84.235.17',
        'cf-ipcity': 'Paris',
        'cf-ipcountry': 'FR',
        'x-umami-cache': 'jeton-precedent',
        cookie: 'autre=1',
      },
    )
    expect(reponse.status).toBe(200)
    expect(await reponse.json()).toEqual({ cache: 'jeton-faux', sessionId: 's', visitId: 'v' })

    const [recu] = envois()
    expect(JSON.parse(recu.corps)).toEqual({
      type: 'event',
      payload: {
        website: siteA,
        hostname: a.host,
        url: '/actualites',
        referrer: 'https://moteur.fr/recherche',
        screen: '1280x720',
        language: 'fr-FR',
      },
    })
    expect(recu.entetes['x-pdlm-ip']).toBe('90.84.235.0')
    expect(recu.entetes['user-agent']).toBe('Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0')
    expect(recu.entetes['x-umami-cache']).toBe('jeton-precedent')
    for (const interdit of [
      'x-forwarded-for',
      'cf-ipcity',
      'cf-ipcountry',
      'cookie',
      'x-commune-host',
    ]) {
      expect(recu.entetes[interdit], interdit).toBeUndefined()
    }
  })

  it('sans X-Forwarded-For (développement) : pas d’en-tête d’IP', async () => {
    await envoyer(a.host, PAGE_VUE)
    expect(envois()[0].entetes['x-pdlm-ip']).toBeUndefined()
  })

  it('alias www : comptée, sous l’hôte demandé', async () => {
    const r = await envoyer(`www.${a.host}`, PAGE_VUE)
    expect(r.status).toBe(200)
    expect(JSON.parse(envois()[0].corps).payload.hostname).toBe(`www.${a.host}`)
  })
})

describe('I19 / I20 — ce qui n’est pas transmis', () => {
  it('domaine d’une autre commune (mesure coupée), même avec le site de A dans le corps', async () => {
    const r = await envoyer(b.host, {
      ...PAGE_VUE,
      payload: { ...PAGE_VUE.payload, website: siteA },
    })
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('domaine de la plateforme', async () => {
    const r = await envoyer(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`, PAGE_VUE)
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('cookie d’opposition présent', async () => {
    const r = await envoyer(a.host, PAGE_VUE, { cookie: 'x=1; pdlm_mesure=refus' })
    expect(r.status).toBe(204)
    expect(envois()).toHaveLength(0)
  })

  it('événement nommé, identification, corps illisible, corps trop gros', async () => {
    expect(
      (await envoyer(a.host, { ...PAGE_VUE, payload: { ...PAGE_VUE.payload, name: 'clic' } }))
        .status,
    ).toBe(204)
    expect((await envoyer(a.host, { type: 'identify', payload: { url: '/' } })).status).toBe(204)
    expect((await envoyer(a.host, '{pas du json')).status).toBe(400)
    expect((await envoyer(a.host, 'x'.repeat(4097))).status).toBe(413)
    expect(envois()).toHaveLength(0)
  })

  it('corps fragmenté sans Content-Length : coupé à la limite (413)', async () => {
    let envoyes = 0
    const flux = new ReadableStream<Uint8Array>({
      pull(controleur) {
        envoyes += 1
        if (envoyes > 1000)
          controleur.close() // ~2 Mo si rien ne coupait la lecture
        else controleur.enqueue(new Uint8Array(2000).fill(120))
      },
    })
    const r = await POST(
      new Request('http://interne/mesure/api/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-commune-host': a.host },
        body: flux,
        duplex: 'half',
      } as RequestInit),
    )
    expect(r.status).toBe(413)
    expect(envoyes).toBeLessThan(10)
    expect(envois()).toHaveLength(0)
  })

  it('mesure non installée : 404', async () => {
    delete process.env.UMAMI_URL
    expect((await envoyer(a.host, PAGE_VUE)).status).toBe(404)
  })
})

describe('Umami lent ou arrêté', () => {
  it('Umami arrêté : 204 au visiteur', async () => {
    umami.reglages.panne = true
    expect((await envoyer(a.host, PAGE_VUE)).status).toBe(204)
  })

  it('Umami lent : 204 en moins de 4 s', async () => {
    umami.reglages.delaiEnvoiMs = 10_000
    const debut = Date.now()
    const r = await envoyer(a.host, PAGE_VUE)
    expect(r.status).toBe(204)
    expect(Date.now() - debut).toBeLessThan(4000)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-relais.int.spec.ts`
Expected: FAIL (route introuvable)

- [ ] **Step 4: Extract `communeDuHost` in `src/lib/commune.ts`**

Remplacer toute la déclaration actuelle de `resolveCommune` (bloc de commentaire compris) par une fonction qui prend le host, puis une version mémoïsée qui la réutilise. Le corps de la résolution est inchangé ; seul le host vient du paramètre au lieu de `headers()`.

```ts
/**
 * Résolution host → commune (D5), sans mémoïsation : pour les route handlers
 * qui lisent `x-commune-host` sur la requête. Le host doit venir de cet
 * en-tête, écrasé par le proxy (I7) — jamais de `Host` directement.
 */
export async function communeDuHost(hostBrut: string): Promise<Commune | null> {
  const candidat = candidatCommune(hostBrut)
  if (!candidat) return null

  const payload = await getPayloadClient()

  if (candidat.slugPlateforme || candidat.fallbackDev) {
    const slug = candidat.slugPlateforme ?? candidat.fallbackDev
    const res = await payload.find({
      collection: 'communes',
      where: { and: [{ slug: { equals: slug } }, { actif: { equals: true } }] },
      limit: 1,
      overrideAccess: true,
    })
    return res.docs[0] ?? null
  }

  if (candidat.domaine) {
    // Le host (sans www.) doit correspondre à un domaine de la commune :
    // le www est un alias explicite, on cherche donc le host ET sa variante
    // canonique (I6 — comparaison exacte, jamais contains).
    const variantes = [candidat.domaine]
    if (candidat.domaine.startsWith('www.')) variantes.push(candidat.domaine.slice(4))
    else variantes.push(`www.${candidat.domaine}`)
    const res = await payload.find({
      collection: 'domaines',
      where: { hostname: { in: variantes } },
      limit: 1,
      overrideAccess: true,
      depth: 1,
    })
    const domaine = res.docs[0]
    if (!domaine) return null
    const communeId =
      typeof domaine.commune === 'object' && domaine.commune !== null
        ? domaine.commune.id
        : domaine.commune
    if (communeId === undefined || communeId === null) return null
    const commune = await payload.findByID({
      collection: 'communes',
      id: communeId,
      overrideAccess: true,
    })
    return commune.actif ? commune : null
  }

  return null
}

/** Résolution host → commune (D5). Mémoïsée par requête via React.cache. */
export const resolveCommune = cache(async (): Promise<Commune | null> => {
  const entetes = await headers()
  return communeDuHost(entetes.get('x-commune-host') ?? '')
})
```

Run: `npm run test:unit -- host` puis `npm run typecheck` — Expected: PASS (non-régression de la résolution).

- [ ] **Step 4b: Prove the proxy overwrites a forged `x-commune-host` on the new paths**

Les tests du relais appellent la route directement avec `x-commune-host` : ils supposent que le proxy (I7) a écrasé cet en-tête. Ce test le prouve pour les chemins `/mesure/…`. Ajouter à `tests/unit/proxy.spec.ts`, en suivant le style du fichier (fonction de requête existante, `proxy` importé) :

```ts
describe('I7 / I19 — chemins de la mesure d’audience', () => {
  it.each(['/mesure/api/send', '/mesure/script.js', '/mesure/opposition'])(
    '%s : un x-commune-host forgé par le client est écrasé par le host réel',
    (chemin) => {
      const reponse = proxy(
        new NextRequest(`https://mairie-a.fr${chemin}`, {
          method: 'POST',
          headers: { host: 'mairie-a.fr', 'x-commune-host': 'mairie-b.fr' },
        }),
      )
      // NextResponse.next({ request: { headers } }) transmet l'en-tête réécrit
      // sous ce nom (next/dist/server/web/spec-extension/response.js).
      expect(reponse.headers.get('x-middleware-request-x-commune-host')).toBe('mairie-a.fr')
    },
  )
})
```

Run: `npm run test:unit -- proxy` — Expected: PASS. (Le `matcher` du proxy couvre tous les chemins sauf `_next/static`, `_next/image` et `favicon.ico` : `/mesure/…` y passe.)

- [ ] **Step 5: Write the relay**

`src/lib/mesure/relais.ts` :

```ts
import { siteMesure, type CommuneMesurable } from './etat'
import { filtrerVisite } from './filtre'
import { ipVisiteur, tronquerIp } from './ip'
import { COOKIE_OPPOSITION, estOppose, lireCookie } from './opposition'

export const TAILLE_MAX_OCTETS = 4096
export const DELAI_UMAMI_MS = 3000

let dernierAvertissement = 0

/** Une panne d'Umami ne doit pas noyer les journaux : une ligne par minute au plus. */
function avertir(message: string): void {
  const maintenant = Date.now()
  if (maintenant - dernierAvertissement < 60_000) return
  dernierAvertissement = maintenant
  console.warn(`[mesure d’audience] ${message}`)
}

const rienTransmis = () => new Response(null, { status: 204 })

/**
 * Lit le corps en comptant les octets : un envoi fragmenté sans
 * Content-Length est coupé dès la limite, sans tout charger en mémoire.
 * Null : limite dépassée.
 */
async function lireBorne(requete: Request, max: number): Promise<string | null> {
  if (!requete.body) return ''
  const lecteur = requete.body.getReader()
  const morceaux: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lecteur.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await lecteur.cancel().catch(() => undefined)
      return null
    }
    morceaux.push(value)
  }
  return Buffer.concat(morceaux).toString('utf8')
}

/**
 * Relais de collecte (spec, section 3). Garanties :
 * I18 — aucune IP complète ni aucun champ hors liste blanche ne sort vers Umami ;
 * I19 — seule une commune mesurée est transmise, sous son propre site ;
 * I20 — un visiteur opposé n'est pas transmis.
 */
export async function relayer(
  requete: Request,
  commune: CommuneMesurable | null,
  host: string,
): Promise<Response> {
  const umami = process.env.UMAMI_URL
  if (!umami) return new Response(null, { status: 404 })

  if (Number(requete.headers.get('content-length') ?? 0) > TAILLE_MAX_OCTETS) {
    return new Response(null, { status: 413 })
  }
  let texte: string | null
  try {
    texte = await lireBorne(requete, TAILLE_MAX_OCTETS)
  } catch {
    return new Response(null, { status: 400 }) // flux interrompu
  }
  if (texte === null) return new Response(null, { status: 413 })

  const site = siteMesure(commune)
  if (!site || estOppose(lireCookie(requete.headers.get('cookie'), COOKIE_OPPOSITION))) {
    return rienTransmis()
  }

  let brut: unknown
  try {
    brut = JSON.parse(texte)
  } catch {
    return new Response(null, { status: 400 })
  }
  const visite = filtrerVisite(brut, { host, siteUmami: site })
  if (!visite) return rienTransmis()

  // En-têtes transmis, et eux seuls.
  const entetes: Record<string, string> = { 'content-type': 'application/json' }
  const agent = requete.headers.get('user-agent')
  if (agent) entetes['user-agent'] = agent
  const ip = tronquerIp(ipVisiteur(requete.headers.get('x-forwarded-for')) ?? '')
  if (ip) entetes['x-pdlm-ip'] = ip
  const jeton = requete.headers.get('x-umami-cache')
  if (jeton) entetes['x-umami-cache'] = jeton

  try {
    const reponse = await fetch(`${umami.replace(/\/$/, '')}/api/send`, {
      method: 'POST',
      headers: entetes,
      body: JSON.stringify(visite),
      signal: AbortSignal.timeout(DELAI_UMAMI_MS),
    })
    return new Response(await reponse.text(), {
      status: reponse.status,
      headers: { 'content-type': reponse.headers.get('content-type') ?? 'application/json' },
    })
  } catch (erreur) {
    avertir(`Umami ne répond pas (${(erreur as Error).message}) : visites non comptées`)
    return rienTransmis()
  }
}
```

`src/app/(frontend)/mesure/api/send/route.ts` :

```ts
import { communeDuHost, normaliserHost } from '@/lib/commune'
import { mesureInstallee } from '@/lib/mesure/etat'
import { relayer } from '@/lib/mesure/relais'

export const dynamic = 'force-dynamic'

/**
 * Relais de collecte de la mesure d'audience. Le chemin ne commence pas par
 * /api : le proxy (I7) le traite comme le front public et pose x-commune-host.
 */
export async function POST(request: Request) {
  const host = normaliserHost(request.headers.get('x-commune-host') ?? '')
  const commune = mesureInstallee() ? await communeDuHost(host) : null
  return relayer(request, commune, host)
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-relais.int.spec.ts && npm run test:int && npm run typecheck`
Expected: PASS (12 tests), suite complète verte.

- [ ] **Step 7: Commit**

```bash
git add src/lib/commune.ts src/lib/mesure/relais.ts "src/app/(frontend)/mesure/api/send/route.ts" \
  tests/helpers/communeTest.ts tests/int/mesure-relais.int.spec.ts tests/unit/proxy.spec.ts
git commit -m "Mesure d'audience — relais de collecte sur le domaine de la commune (I18, I19, I20)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Script Umami servi par pdlm, balise, slugs réservés

**Files:**

- Create: `src/lib/mesure/script.ts`, `src/app/(frontend)/mesure/script.js/route.ts`, `tests/int/mesure-script.int.spec.ts`
- Modify: `src/app/(frontend)/layout.tsx`, `src/hooks/uniqueSlugParCommune.ts`

**Interfaces:**

- Consumes: `communeDuHost` (7), `siteMesure` (3), `COOKIE_OPPOSITION`, `estOppose` (3), helpers de test (4, 7)
- Produces: `GET /mesure/script.js` ; `src/lib/mesure/script.ts` : `scriptUmami(): Promise<string | null>` et `viderCacheScript(): void` (hors du fichier de route : Next n'accepte dans un `route.ts` que les méthodes HTTP et les options de segment) ; `SLUGS_RESERVES` contient `mesure` et `mesure-d-audience`

- [ ] **Step 1: Write the failing test**

`tests/int/mesure-script.int.spec.ts` :

```ts
// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { GET } from '@/app/(frontend)/mesure/script.js/route'
import { viderCacheScript } from '@/lib/mesure/script'
import { SLUGS_RESERVES } from '@/hooks/uniqueSlugParCommune'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import {
  configurerUmami,
  demarrerFauxUmami,
  SCRIPT_FAUX,
  type FauxUmami,
} from '../helpers/fauxUmami'

let payload: Payload
let umami: FauxUmami
let commune: { id: number; host: string }

const script = (host: string) =>
  GET(new Request('http://interne/mesure/script.js', { headers: { 'x-commune-host': host } }))

beforeAll(async () => {
  umami = await demarrerFauxUmami()
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'script')
})
afterAll(async () => {
  await supprimerCommuneTest(payload, commune.id)
  await umami.fermer()
})
beforeEach(() => {
  configurerUmami(umami.url)
  umami.reglages.panne = false
  umami.vider()
  viderCacheScript()
})

describe('/mesure/script.js', () => {
  it('sert le script d’Umami, mis en cache une heure', async () => {
    const r = await script(commune.host)
    expect(r.status).toBe(200)
    expect(await r.text()).toBe(SCRIPT_FAUX)
    expect(r.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(r.headers.get('content-type')).toMatch(/javascript/)
    await script(commune.host)
    expect(umami.recues.filter((q) => q.chemin === '/script.js')).toHaveLength(1)
  })

  it('Umami arrêté sans copie en mémoire : 503', async () => {
    umami.reglages.panne = true
    expect((await script(commune.host)).status).toBe(503)
  })

  it('domaine de la plateforme ou mesure non installée : 404', async () => {
    expect((await script(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`)).status).toBe(404)
    delete process.env.UMAMI_URL
    expect((await script(commune.host)).status).toBe(404)
  })
})

describe('slugs réservés', () => {
  it('mesure et mesure-d-audience ne peuvent pas être des slugs de page', () => {
    expect(SLUGS_RESERVES).toEqual(expect.arrayContaining(['mesure', 'mesure-d-audience']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-script.int.spec.ts`
Expected: FAIL (route introuvable)

- [ ] **Step 3: Write the script route**

`src/lib/mesure/script.ts` :

```ts
const UNE_HEURE_MS = 3_600_000

/** Copie en mémoire du script d'Umami : il suit la version installée, sans copie dans le dépôt. */
let copie: { texte: string; expire: number } | null = null

/** Pour les tests. */
export function viderCacheScript(): void {
  copie = null
}

/** Le script d'Umami, gardé une heure ; une copie périmée vaut mieux que rien. Null : indisponible. */
export async function scriptUmami(): Promise<string | null> {
  const umami = process.env.UMAMI_URL
  if (!umami) return null
  if (!copie || copie.expire < Date.now()) {
    try {
      const reponse = await fetch(`${umami.replace(/\/$/, '')}/script.js`, {
        signal: AbortSignal.timeout(3000),
      })
      if (!reponse.ok) throw new Error(`statut ${reponse.status}`)
      copie = { texte: await reponse.text(), expire: Date.now() + UNE_HEURE_MS }
    } catch {
      if (!copie) return null
    }
  }
  return copie.texte
}
```

`src/app/(frontend)/mesure/script.js/route.ts` :

```ts
import { communeDuHost } from '@/lib/commune'
import { mesureInstallee } from '@/lib/mesure/etat'
import { scriptUmami } from '@/lib/mesure/script'

export const dynamic = 'force-dynamic'

/**
 * Script de mesure servi depuis le domaine de la commune : la CSP
 * (`script-src 'self'`) ne change pas.
 */
export async function GET(request: Request) {
  if (!mesureInstallee()) return new Response(null, { status: 404 })
  const commune = await communeDuHost(request.headers.get('x-commune-host') ?? '')
  if (!commune) return new Response(null, { status: 404 })
  const texte = await scriptUmami()
  if (texte === null) return new Response(null, { status: 503 })
  return new Response(texte, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
```

- [ ] **Step 4: Reserve the slugs**

Dans `src/hooks/uniqueSlugParCommune.ts` :

```ts
export const SLUGS_RESERVES = [
  'actualites',
  'agenda',
  'documents',
  'admin',
  'api',
  'mesure',
  'mesure-d-audience',
]
```

- [ ] **Step 5: Add the tag to the layout**

Dans `src/app/(frontend)/layout.tsx`, imports :

```ts
import { cookies } from 'next/headers'

import { siteMesure } from '@/lib/mesure/etat'
import { COOKIE_OPPOSITION, estOppose } from '@/lib/mesure/opposition'
```

Dans `LayoutFront`, après le calcul de `couleurAccent` :

```ts
// I20 : pas de script pour un visiteur qui s'est opposé.
const oppose = estOppose((await cookies()).get(COOKIE_OPPOSITION)?.value)
const siteUmami = oppose ? null : siteMesure(commune)
```

Dans le JSX, juste après `<PiedDePage commune={commune} />` :

```tsx
{
  siteUmami && (
    <script
      defer
      src="/mesure/script.js"
      data-website-id={siteUmami}
      data-host-url="/mesure"
      data-exclude-search="true"
      data-exclude-hash="true"
      data-do-not-track="true"
      data-fetch-credentials="same-origin"
    />
  )
}
```

`data-host-url="/mesure"` fait poster le script à `/mesure/api/send` ; `data-fetch-credentials="same-origin"` fait suivre le cookie d'opposition jusqu'au relais.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-script.int.spec.ts && npm run typecheck && npm run lint`
Expected: PASS (4 tests), typecheck et lint verts. La balise elle-même est vérifiée à la tâche 10 (bout en bout).

- [ ] **Step 7: Commit**

```bash
git add src/lib/mesure/script.ts "src/app/(frontend)/mesure/script.js/route.ts" "src/app/(frontend)/layout.tsx" \
  src/hooks/uniqueSlugParCommune.ts tests/int/mesure-script.int.spec.ts
git commit -m "Mesure d'audience — script Umami servi par pdlm et balise dans la mise en page

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Page d'information et opposition sans JavaScript

**Files:**

- Create: `src/app/(frontend)/mesure/opposition/route.ts`, `src/app/(frontend)/mesure-d-audience/page.tsx`, `tests/int/mesure-opposition.int.spec.ts`
- Modify: `src/components/PiedDePage.tsx`, `src/seed/contenu-demo.ts`

**Interfaces:**

- Consumes: `communeDuHost`, `resolveCommune` (7), `enteteCookieOpposition`, `COOKIE_OPPOSITION`, `estOppose` (3), `siteMesure` (3)
- Produces: `POST /mesure/opposition` (formulaire `choix=refus|accepte` → 303 `/mesure-d-audience`) ; page `/mesure-d-audience`

- [ ] **Step 1: Write the failing test**

`tests/int/mesure-opposition.int.spec.ts` :

```ts
// @vitest-environment node
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { POST } from '@/app/(frontend)/mesure/opposition/route'
import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let commune: { id: number; host: string }

const choisir = (host: string, choix: string, entetes: Record<string, string> = {}) =>
  POST(
    new Request(`https://${host}/mesure/opposition`, {
      method: 'POST',
      headers: {
        'x-commune-host': host,
        'content-type': 'application/x-www-form-urlencoded',
        ...entetes,
      },
      body: new URLSearchParams({ choix }).toString(),
    }),
  )

beforeAll(async () => {
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'opposition')
})
afterAll(async () => {
  await supprimerCommuneTest(payload, commune.id)
})

describe('POST /mesure/opposition (I20)', () => {
  it('refus : cookie posé, retour à la page d’information', async () => {
    const r = await choisir(commune.host, 'refus')
    expect(r.status).toBe(303)
    expect(r.headers.get('location')).toBe('/mesure-d-audience')
    const cookie = r.headers.get('set-cookie') ?? ''
    expect(cookie).toMatch(/^pdlm_mesure=refus; Max-Age=33696000; Path=\/; HttpOnly; SameSite=Lax/)
  })

  it('acceptation : cookie effacé', async () => {
    const r = await choisir(commune.host, 'accepte')
    expect(r.status).toBe(303)
    expect(r.headers.get('set-cookie')).toMatch(/^pdlm_mesure=; Max-Age=0;/)
  })

  it('formulaire soumis depuis un autre site : 403, cookie intact', async () => {
    for (const entetes of [
      { origin: 'https://site-hostile.example' },
      { origin: 'null' },
      { origin: `https://${commune.host}:8443` },
      { 'sec-fetch-site': 'cross-site' },
    ]) {
      const r = await choisir(commune.host, 'accepte', entetes)
      expect(r.status, JSON.stringify(entetes)).toBe(403)
      expect(r.headers.get('set-cookie')).toBeNull()
    }
  })

  it('formulaire de la page elle-même : accepté', async () => {
    const r = await choisir(commune.host, 'refus', {
      origin: `https://${commune.host}`,
      'sec-fetch-site': 'same-origin',
    })
    expect(r.status).toBe(303)
  })

  it('choix invalide : 400 ; domaine de la plateforme : 404', async () => {
    expect((await choisir(commune.host, 'autre')).status).toBe(400)
    expect(
      (await choisir(`admin.${process.env.PLATFORM_DOMAIN || 'localhost'}`, 'refus')).status,
    ).toBe(404)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-opposition.int.spec.ts`
Expected: FAIL (route introuvable)

- [ ] **Step 3: Write the opposition route**

`src/app/(frontend)/mesure/opposition/route.ts` :

```ts
import { communeDuHost, normaliserHost } from '@/lib/commune'
import { enteteCookieOpposition, soumissionIntersite } from '@/lib/mesure/opposition'

export const dynamic = 'force-dynamic'

/** I20 — opposition sans JavaScript : formulaire classique, réponse 303. */
export async function POST(request: Request) {
  const host = normaliserHost(request.headers.get('x-commune-host') ?? '')
  const commune = await communeDuHost(host)
  if (!commune) return new Response(null, { status: 404 })
  // Un site tiers ne doit pas pouvoir lever l'opposition d'un visiteur.
  if (soumissionIntersite(request.headers, new URL(request.url).host)) {
    return new Response('Origine refusée', { status: 403 })
  }
  const formulaire = await request.formData().catch(() => null)
  const choix = formulaire?.get('choix')
  if (choix !== 'refus' && choix !== 'accepte') {
    return new Response('Choix invalide', { status: 400 })
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: '/mesure-d-audience',
      'Set-Cookie': enteteCookieOpposition(choix, process.env.NODE_ENV === 'production'),
    },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --config ./vitest.config.mts tests/int/mesure-opposition.int.spec.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the information page**

`src/app/(frontend)/mesure-d-audience/page.tsx` :

```tsx
import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import { resolveCommune } from '@/lib/commune'
import { siteMesure } from '@/lib/mesure/etat'
import { COOKIE_OPPOSITION, estOppose } from '@/lib/mesure/opposition'

export const metadata: Metadata = {
  title: 'Mesure d’audience',
}

/**
 * Page fixe, rendue depuis la fiche commune : l'agent n'a rien à rédiger et
 * rien ne peut la casser. Texte à valider par l'opérateur et son délégué à la
 * protection des données (ce n'est pas un avis juridique).
 */
export default async function PageMesureAudience() {
  const commune = await resolveCommune()
  if (!commune) return null
  const mesuree = siteMesure(commune) !== null
  const oppose = estOppose((await cookies()).get(COOKIE_OPPOSITION)?.value)

  return (
    <section className="bloc bloc-texte">
      <h1>Mesure d’audience</h1>
      {!mesuree ? (
        <p>Ce site ne mesure pas son audience.</p>
      ) : (
        <>
          <h2>Qui mesure, et pourquoi</h2>
          <p>
            La commune de {commune.nom}, responsable du traitement, compte les visites de ce site
            pour connaître la fréquentation de ses pages et l’améliorer. L’hébergeur du site agit
            pour son compte, comme sous-traitant.
          </p>
          <h2>Ce qui est collecté</h2>
          <ul>
            <li>la page vue et la page d’origine ;</li>
            <li>le navigateur, le système, le type d’appareil, la taille d’écran et la langue ;</li>
            <li>
              le pays, la région et la ville approximatifs, déduits d’une adresse IP tronquée avant
              tout enregistrement.
            </li>
          </ul>
          <h2>Ce qui ne l’est pas</h2>
          <p>
            Ni votre adresse IP complète, ni cookie de mesure, ni identifiant durable, ni suivi d’un
            site à l’autre, ni enregistrement de vos gestes sur la page.
          </p>
          <h2>Durée de conservation</h2>
          <p>Les données de mesure sont supprimées au bout de 25 mois.</p>
          <h2>Votre choix</h2>
          <p role="status">
            {oppose
              ? 'Vous vous êtes opposé à la mesure : vos visites ne sont pas comptées.'
              : 'Vos visites sont comptées de façon anonyme.'}
          </p>
          <form method="post" action="/mesure/opposition">
            <input type="hidden" name="choix" value={oppose ? 'accepte' : 'refus'} />
            <button type="submit" className="bouton bouton--primaire">
              {oppose ? 'Accepter la mesure' : 'Refuser la mesure'}
            </button>
          </form>
          <p>
            Votre choix est gardé par un cookie qui ne sert qu’à cela, pendant 13 mois au plus. Le
            signal « Ne pas me suivre » de votre navigateur est aussi respecté.
          </p>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 6: Footer link and seed text**

Dans `src/components/PiedDePage.tsx`, import :

```ts
import { siteMesure } from '@/lib/mesure/etat'
```

Dans la liste « Informations », après le lien « Accessibilité » :

```tsx
{
  siteMesure(commune) && (
    <li>
      <Link href="/mesure-d-audience">Mesure d’audience</Link>
    </li>
  )
}
```

Dans `src/seed/contenu-demo.ts`, page `confidentialite`, remplacer le premier paragraphe :

```ts
          'Le site ne dépose aucun cookie de mesure d’audience. Si la commune mesure la fréquentation de ses pages, elle le fait sans cookie et de façon anonyme : la page « Mesure d’audience » (/mesure-d-audience) détaille ce qui est collecté et permet de s’y opposer.',
```

- [ ] **Step 7: Check the page by hand**

```bash
npm run dev
```

Ouvrir `http://localhost:3000/mesure-d-audience` : sans `UMAMI_URL`, « Ce site ne mesure pas son audience. » ; le lien n'est pas dans le pied de page. Le parcours complet (refus, acceptation, clavier) est automatisé à la tâche 10.

- [ ] **Step 8: Run suites and commit**

Run: `npm run test:int && npm run typecheck && npm run lint`
Expected: PASS

```bash
git add "src/app/(frontend)/mesure/opposition/route.ts" "src/app/(frontend)/mesure-d-audience/page.tsx" \
  src/components/PiedDePage.tsx src/seed/contenu-demo.ts tests/int/mesure-opposition.int.spec.ts
git commit -m "Mesure d'audience — page d'information et opposition sans JavaScript (I20)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Tests de bout en bout

**Files:**

- Create: `tests/e2e/global-setup.ts`, `tests/e2e/mesure.e2e.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

- Consumes: `demarrerFauxUmami`, `CLE_TEST`, `EQUIPE_TEST` (4) ; comptes du seed (`operateur@pdlm.dev` / `demo1234`), commune `saint-ex` résolue sur `localhost` (`DEFAULT_COMMUNE_SLUG`)

- [ ] **Step 1: Fake Umami for the e2e server**

`tests/e2e/global-setup.ts` :

```ts
import { demarrerFauxUmami } from '../helpers/fauxUmami'

/** Faux Umami sur un port fixe, celui que le serveur de développement reçoit dans UMAMI_URL. */
export const PORT_FAUX_UMAMI = 3998

export default async function globalSetup() {
  const umami = await demarrerFauxUmami(PORT_FAUX_UMAMI)
  return async () => {
    await umami.fermer()
  }
}
```

Dans `playwright.config.ts`, imports :

```ts
import { CLE_TEST, EQUIPE_TEST } from './tests/helpers/fauxUmami'
```

Dans `defineConfig({...})`, ajouter `globalSetup: './tests/e2e/global-setup.ts',` et, dans `webServer` :

```ts
    // Mesure d'audience contre le faux Umami de global-setup.ts. Un serveur
    // réutilisé (reuseExistingServer, en local) ne reçoit PAS ces variables :
    // mesure.e2e.spec.ts se signale alors au lieu d'échouer sans explication.
    env: {
      UMAMI_URL: 'http://127.0.0.1:3998',
      UMAMI_API_KEY: CLE_TEST,
      UMAMI_TEAM_ID: EQUIPE_TEST,
      UMAMI_PUBLIC_URL: 'http://stats.localhost',
    },
```

- [ ] **Step 2: Write the e2e test**

`tests/e2e/mesure.e2e.spec.ts` :

```ts
import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * Mesure d'audience, contre les données de `npm run seed` et le faux Umami
 * de global-setup.ts. La commune `saint-ex` est activée par l'API REST avec
 * le compte opérateur de démonstration, puis coupée à la fin.
 */
const OPERATEUR = { email: 'operateur@pdlm.dev', password: 'demo1234' }
const BALISE = 'script[src="/mesure/script.js"]'

let jeton = ''
let communeId = 0

async function basculer(request: APIRequestContext, active: boolean) {
  const r = await request.patch(`/api/communes/${communeId}`, {
    headers: { Authorization: `JWT ${jeton}` },
    data: { mesure: { active } },
  })
  expect(r.ok(), await r.text()).toBe(true)
}

test.describe('Mesure d’audience', () => {
  test.beforeAll(async ({ request }) => {
    const script = await request.get('/mesure/script.js')
    if (script.status() === 404) {
      // Serveur réutilisé sans UMAMI_URL : en CI, c'est une erreur ; en local, un signalement.
      expect(
        process.env.CI,
        'le serveur e2e doit recevoir UMAMI_URL (playwright.config.ts)',
      ).toBeFalsy()
      test.skip(
        true,
        'serveur de développement réutilisé sans UMAMI_URL — arrêter `next dev` et relancer',
      )
    }
    const connexion = await request.post('/api/users/login', { data: OPERATEUR })
    jeton = (await connexion.json()).token
    const communes = await request.get('/api/communes?where[slug][equals]=saint-ex&limit=1', {
      headers: { Authorization: `JWT ${jeton}` },
    })
    communeId = (await communes.json()).docs[0].id
    await basculer(request, true)
  })

  test.afterAll(async ({ request }) => {
    if (jeton) await basculer(request, false)
  })

  // Le faux Umami sert SCRIPT_FAUX, qui poste comme le vrai script : ce test prouve la chaîne
  // balise → relais ; le vrai script d'Umami est éprouvé à la recette (tâche 15).
  test('une commune mesurée porte la balise, qui poste au relais du domaine', async ({ page }) => {
    const envoi = page.waitForRequest(
      (r) => r.url().endsWith('/mesure/api/send') && r.method() === 'POST',
    )
    await page.goto('/')
    const balise = page.locator(BALISE)
    await expect(balise).toHaveCount(1)
    await expect(balise).toHaveAttribute('data-website-id', /^[0-9a-f-]{36}$/)
    await expect(balise).toHaveAttribute('data-host-url', '/mesure')
    await envoi
  })

  test.describe('sans JavaScript', () => {
    // L'opposition doit fonctionner sans JavaScript (spec, section 4).
    // `test.use` garde la baseURL de la configuration (un browser.newContext() nu la perdrait).
    test.use({ javaScriptEnabled: false })

    test('refuser par le formulaire retire la balise ; accepter la remet', async ({ page }) => {
      await page.goto('/mesure-d-audience')
      await page.getByRole('button', { name: 'Refuser la mesure' }).click()
      await expect(page).toHaveURL(/\/mesure-d-audience$/)
      await expect(page.getByRole('status')).toContainText('Vous vous êtes opposé')
      await page.goto('/')
      await expect(page.locator(BALISE)).toHaveCount(0)

      await page.goto('/mesure-d-audience')
      await page.getByRole('button', { name: 'Accepter la mesure' }).click()
      await page.goto('/')
      await expect(page.locator(BALISE)).toHaveCount(1)
    })
  })

  test('la page est atteinte depuis le pied de page et utilisable au clavier', async ({ page }) => {
    await page.goto('/')
    const lien = page.locator('footer').getByRole('link', { name: 'Mesure d’audience' })
    await lien.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/mesure-d-audience$/)
    await expect(page.locator('h1')).toHaveText('Mesure d’audience')

    const bouton = page.getByRole('button', { name: 'Refuser la mesure' })
    await bouton.focus()
    await expect(bouton).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Accepter la mesure' })).toBeVisible()
    // Remise dans l'état initial pour les autres tests
    await page.getByRole('button', { name: 'Accepter la mesure' }).click()
  })
})
```

- [ ] **Step 3: Run the e2e suite**

Arrêter tout `next dev` de ce dépôt (sinon Playwright réutilise un serveur sans `UMAMI_URL`), puis :

```bash
npm run seed
npm run test:e2e
```

Expected: PASS, y compris `admin`, `focus`, `frontend` (non-régression). Si `mesure.e2e.spec.ts` est ignoré, c'est qu'un serveur a été réutilisé : l'arrêter et relancer.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/global-setup.ts tests/e2e/mesure.e2e.spec.ts playwright.config.ts
git commit -m "Mesure d'audience — tests de bout en bout (balise, opposition, clavier)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Services Docker et Caddy

**Files:**

- Modify: `docker-compose.yml`, `docker-compose.dev.yml`, `Caddyfile`, `Caddyfile.dev`

**Interfaces:**

- Produces : profil Compose `mesure` avec les services `init-umami`, `umami`, `purge-mesure` (production) et `init-umami`, `umami` (développement) ; Umami de dev joignable sur `http://127.0.0.1:3002`.

- [ ] **Step 1: Production compose**

Dans `docker-compose.yml`, service `app`, ajouter à `environment` :

```yaml
# Mesure d'audience (profil « mesure ») : sans UMAMI_URL, la fonction n'existe pas.
UMAMI_URL: ${UMAMI_URL:-}
UMAMI_API_KEY: ${UMAMI_API_KEY:-}
UMAMI_TEAM_ID: ${UMAMI_TEAM_ID:-}
UMAMI_PUBLIC_URL: ${UMAMI_PUBLIC_URL:-}
```

Ajouter, après `app` (avant `caddy`) :

```yaml
# --- Mesure d'audience (profil « mesure », COMPOSE_PROFILES=mesure dans .env) ---
# Jamais ${X:?} ici : Compose refuse alors toute la pile, même profil
# inactif (vérifié le 23/09). Les variables manquantes sont refusées par
# les conteneurs eux-mêmes.

init-umami:
  # Rôle et base `umami`, idempotent. Les scripts d'initialisation de
  # Postgres ne tournent que sur un volume vide : sans ce service, une
  # installation existante n'aurait jamais la base.
  image: postgres:17-alpine
  profiles: [mesure]
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    PGHOST: postgres
    PGUSER: ${POSTGRES_USER:-postgres}
    PGPASSWORD: ${POSTGRES_PASSWORD:-postgres}
    PGDATABASE: ${POSTGRES_DB:-pdlm}
    UMAMI_DB_PASSWORD: ${UMAMI_DB_PASSWORD:-}
  entrypoint:
    - /bin/sh
    - -c
    - |
      set -e
      [ -n "$$UMAMI_DB_PASSWORD" ] || { echo "UMAMI_DB_PASSWORD requis dans .env" >&2; exit 1; }
      psql -v ON_ERROR_STOP=1 -v mdp="$$UMAMI_DB_PASSWORD" <<'SQL'
      SELECT 'CREATE ROLE umami LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami')\gexec
      ALTER ROLE umami WITH LOGIN PASSWORD :'mdp';
      SELECT 'CREATE DATABASE umami OWNER umami' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec
      SQL
      echo "rôle et base umami : prêts"

umami:
  # Épinglé par digest (reproductibilité + scan Trivy) — Umami 3.4.0.
  image: ghcr.io/umami-software/umami:3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367
  profiles: [mesure]
  restart: unless-stopped
  depends_on:
    init-umami:
      condition: service_completed_successfully
  environment:
    DATABASE_URL: postgresql://umami:${UMAMI_DB_PASSWORD:-}@postgres:5432/umami
    APP_SECRET: ${UMAMI_APP_SECRET:-}
    DISABLE_TELEMETRY: '1'
    DISABLE_UPDATES: '1'
    # IP déjà tronquée par le relais de pdlm (I18) ; géolocalisation par
    # en-têtes du client ignorée.
    CLIENT_IP_HEADER: x-pdlm-ip
    SKIP_LOCATION_HEADERS: '1'
  command:
    - sh
    - -c
    - '[ -n "$$APP_SECRET" ] || { echo "UMAMI_APP_SECRET requis dans .env" >&2; exit 1; }; exec sh scripts/start-docker.sh'
  healthcheck:
    test: ['CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:3000/api/heartbeat']
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 30s
  # I22 : aucun port publié ; la collecte ne passe que par le relais de pdlm.

purge-mesure:
  # I21 : aucune donnée de mesure de plus de 25 mois. Pas de tâche dans
  # l'application : pdlm n'a pas, et ne doit pas avoir, les identifiants de
  # la base `umami`.
  image: postgres:17-alpine
  profiles: [mesure]
  restart: unless-stopped
  depends_on:
    umami:
      condition: service_healthy
  environment:
    PGHOST: postgres
    PGUSER: umami
    PGDATABASE: umami
    PGPASSWORD: ${UMAMI_DB_PASSWORD:-}
  volumes:
    - ./scripts/purge-mesure.sql:/purge-mesure.sql:ro
  entrypoint:
    - /bin/sh
    - -c
    - |
      while true; do
        psql -v ON_ERROR_STOP=1 -f /purge-mesure.sql || echo "ÉCHEC de la purge de la mesure d'audience (I21)" >&2
        sleep 86400
      done
```

Le fichier `scripts/purge-mesure.sql` est créé à la tâche 12 : jusque-là, ne pas démarrer `purge-mesure`.

La commande enveloppée d'`umami` (contrôle du secret, puis `exec sh scripts/start-docker.sh`, la commande d'origine de l'image) a été vérifiée le 23/09 sur l'image épinglée : Umami démarre (`/api/heartbeat` → `{"ok":true}`) et un secret vide arrête le conteneur avec le code 1 et le message attendu. La tâche 15 la redémarre dans la pile de production.

- [ ] **Step 2: Development compose**

Dans `docker-compose.dev.yml`, ajouter :

```yaml
# Mesure d'audience : docker compose -f docker-compose.dev.yml --profile mesure up -d
# puis, dans .env : UMAMI_URL=http://127.0.0.1:3002 (+ clé et équipe, README).
init-umami:
  image: postgres:17-alpine
  profiles: [mesure]
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    PGHOST: postgres
    PGUSER: postgres
    PGPASSWORD: postgres
    PGDATABASE: pdlm
  entrypoint:
    - /bin/sh
    - -c
    - |
      set -e
      psql -v ON_ERROR_STOP=1 <<'SQL'
      SELECT 'CREATE ROLE umami LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami')\gexec
      ALTER ROLE umami WITH LOGIN PASSWORD 'umami';
      SELECT 'CREATE DATABASE umami OWNER umami' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec
      SQL

umami:
  image: ghcr.io/umami-software/umami:3.4.0@sha256:85909afc45bdcda1917394594a087421fdbb05610fded0fa9f6fb861abb2f367
  profiles: [mesure]
  depends_on:
    init-umami:
      condition: service_completed_successfully
  environment:
    DATABASE_URL: postgresql://umami:umami@postgres:5432/umami
    APP_SECRET: umami-dev-secret-sans-valeur
    DISABLE_TELEMETRY: '1'
    DISABLE_UPDATES: '1'
    CLIENT_IP_HEADER: x-pdlm-ip
    SKIP_LOCATION_HEADERS: '1'
  ports:
    - '127.0.0.1:3002:3000'
  healthcheck:
    test: ['CMD', 'wget', '-q', '-O', '/dev/null', 'http://127.0.0.1:3000/api/heartbeat']
    interval: 10s
    timeout: 5s
    retries: 10
    start_period: 30s
```

Vérifier que le nom du service Postgres de dev est bien `postgres` (sinon adapter `PGHOST` et `DATABASE_URL`).

- [ ] **Step 3: Caddy**

Dans `Caddyfile`, après le bloc de la plateforme :

```
# Interface de mesure d'audience (profil « mesure »), une seule pour toute la
# plateforme. I22 : les chemins de collecte, de rejeu, de pixels et de liens
# sont fermés — la collecte ne passe que par le relais de pdlm, qui filtre et
# tronque. `/api/batch` est une seconde porte de collecte (relevé le 23/09).
# stats.pdlm.example.fr {
# 	@collecte path /api/send /api/batch /api/record /script.js /recorder.js /p/* /q/*
# 	respond @collecte 404
# 	reverse_proxy umami:3000
# }
```

Dans `Caddyfile.dev`, avant le bloc `:80` :

```
# Interface Umami de la pile locale de type production (profil « mesure »).
http://stats.localhost {
	@collecte path /api/send /api/batch /api/record /script.js /recorder.js /p/* /q/*
	respond @collecte 404
	reverse_proxy umami:3000
}
```

- [ ] **Step 4: Verify by running**

```bash
docker compose config --quiet && echo "prod : configuration valide sans profil"
UMAMI_DB_PASSWORD=x UMAMI_APP_SECRET=y COMPOSE_PROFILES=mesure docker compose config --quiet && echo "prod : valide avec profil"
docker compose -f docker-compose.dev.yml --profile mesure up -d
docker compose -f docker-compose.dev.yml --profile mesure up init-umami   # 2e passage : idempotent
curl -sf http://127.0.0.1:3002/api/heartbeat
docker compose -f docker-compose.dev.yml exec -T postgres psql -U postgres -d umami -tAc "select count(*) from website"
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' | grep -i umami
docker run --rm -v "$PWD/Caddyfile.dev:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Expected: les deux `config` valides ; `init-umami` réussit deux fois de suite ; `{"ok":true}` ; `0` ; mémoire d'Umami relevée (à noter pour la tâche 14) ; `Valid configuration`.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.dev.yml Caddyfile Caddyfile.dev
git commit -m "Mesure d'audience — services Umami (profil « mesure ») et bloc Caddy stats (I22)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Purge à 25 mois

**Files:**

- Create: `scripts/purge-mesure.sql`, `scripts/tester-purge-mesure.sh`

**Interfaces:**

- Consumes : Umami de développement (tâche 11), base `umami`.
- Produces : la purge, lancée par le service `purge-mesure` (tâche 11) et par `restore.sh` (tâche 13).

Tables et colonnes relevées par exécution sur Umami 3.4.0 (23/09) ; `relationMode = "prisma"` : aucune clé étrangère en base, l'ordre des suppressions est logique, pas imposé.

Deux choix, pour qu'I21 tienne **strictement** :

- **Limite calculée sur la date avancée de 2 jours** : `(maintenant + 2 jours) − 25 mois`, et non `maintenant − 25 mois + 2 jours`. La soustraction de mois « saute » en fin de mois : purgée le 28/02/2027 avec l'ancienne formule, une ligne du 31/01/2025 était gardée puis dépassait 25 mois dès le 1/03 (relevé par Astra, vérifié le 23/09). Avancer la date d'abord garantit qu'aucune ligne ne dépasse 25 mois avant la purge suivante (24 h plus tard) : balayage heure par heure sur 2026-2030, 0 violation.
- **Sessions supprimées sur leur seule date**, qu'un événement récent s'y rattache ou non. En pratique ce cas n'arrive pas : l'identifiant de session d'Umami inclut un sel qui change chaque mois (`SALT_ROTATION=month`, lu dans `src/app/api/send/route.ts`) et le relais retire `timestamp`. Une session ne reçoit donc plus d'événement un mois après sa création. Si le cas survenait malgré tout, les événements concernés restent (moins de 25 mois) mais perdent leurs attributs de session : c'est le prix de la stricte conformité.

- [ ] **Step 1: Write the failing test script**

`scripts/tester-purge-mesure.sh` :

```bash
#!/usr/bin/env bash
# Test de scripts/purge-mesure.sql contre une vraie base Umami (I21).
# Prérequis : docker compose -f docker-compose.dev.yml --profile mesure up -d
# Crée un site factice, des lignes de part et d'autre de la limite dans chaque
# table purgée, lance la purge, vérifie, puis efface le site factice.
set -euo pipefail
cd "$(dirname "$0")/.."

psql_umami() { docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -tA "$@"; }

SITE=00000000-0000-4000-8000-00000000c0de
TABLES="event_data session_data revenue heatmap_event session_replay session_replay_saved website_event session_link session"
nettoyer() {
  for t in $TABLES website; do psql_umami -c "DELETE FROM $t WHERE website_id='$SITE'" >/dev/null; done
}
trap nettoyer EXIT
nettoyer

# Même limite que la purge ; VIEUX juste en deçà, RECENT juste au-delà.
LIMITE="((now() + interval '2 days') - interval '25 months')"
VIEUX="($LIMITE - interval '1 hour')"
RECENT="($LIMITE + interval '1 day')"
SV=00000000-0000-4000-8000-0000000000a1   # session ancienne
SR=00000000-0000-4000-8000-0000000000a2   # session récente
EV=00000000-0000-4000-8000-0000000000e1   # événement ancien
ER=00000000-0000-4000-8000-0000000000e2   # événement récent

psql_umami <<SQL >/dev/null
INSERT INTO website (website_id, name) VALUES ('$SITE', 'purge-test');
INSERT INTO session (session_id, website_id, created_at) VALUES ('$SV', '$SITE', $VIEUX), ('$SR', '$SITE', $RECENT);
INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at) VALUES
  ('$EV', '$SITE', '$SV', gen_random_uuid(), '/vieux', $VIEUX),
  ('$ER', '$SITE', '$SR', gen_random_uuid(), '/recent', $RECENT);
INSERT INTO event_data (event_data_id, website_id, website_event_id, data_key, data_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$EV', 'vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$ER', 'recent', 1, $RECENT);
INSERT INTO session_data (session_data_id, website_id, session_id, data_key, data_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', 'vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', 'recent', 1, $RECENT);
INSERT INTO revenue (revenue_id, website_id, session_id, event_id, event_name, currency, revenue, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', '$EV', 'vieux', 'EUR', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', '$ER', 'recent', 'EUR', 1, $RECENT);
INSERT INTO heatmap_event (heatmap_event_id, website_id, session_id, visit_id, url_path, event_type, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', gen_random_uuid(), '/vieux', 1, $VIEUX), (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/recent', 1, $RECENT);
INSERT INTO session_replay (replay_id, website_id, session_id, visit_id, chunk_index, events, event_count, started_at, ended_at, created_at) VALUES
  (gen_random_uuid(), '$SITE', '$SV', gen_random_uuid(), 0, '\x00', 0, $VIEUX, $VIEUX, $VIEUX),
  (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), 0, '\x00', 0, $RECENT, $RECENT, $RECENT);
INSERT INTO session_replay_saved (saved_replay_id, name, website_id, visit_id, created_at) VALUES
  (gen_random_uuid(), 'vieux', '$SITE', gen_random_uuid(), $VIEUX), (gen_random_uuid(), 'recent', '$SITE', gen_random_uuid(), $RECENT);
INSERT INTO session_link (website_id, session_id, distinct_id, created_at) VALUES
  ('$SITE', '$SV', 'vieux', $VIEUX), ('$SITE', '$SR', 'recent', $RECENT);
SQL

echo "--- purge ---"
docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -f - <scripts/purge-mesure.sql

attendu() { # $1=libellé $2=requête $3=valeur attendue
  local lu; lu=$(psql_umami -c "$2")
  if [ "$lu" = "$3" ]; then echo "OK   $1 ($lu)"; else echo "ÉCHEC $1 : lu $lu, attendu $3" >&2; exit 1; fi
}
for t in $TABLES; do
  attendu "$t : seule la ligne récente reste" \
    "SELECT count(*) FROM $t WHERE website_id='$SITE' AND created_at < $LIMITE" 0
  attendu "$t : la ligne récente est gardée" \
    "SELECT count(*) FROM $t WHERE website_id='$SITE' AND created_at >= $LIMITE" 1
done

# Horloge figée : fin février (année ordinaire puis bissextile), là où la soustraction
# de mois saute. La ligne « juste trop vieille » doit partir, la suivante rester.
purge_a() { # $1=date de purge
  docker compose -f docker-compose.dev.yml exec -T postgres psql -q -v ON_ERROR_STOP=1 -v maintenant="$1" \
    -U umami -d umami -f - <scripts/purge-mesure.sql >/dev/null
}
for cas in "2027-02-28 12:00+00|2025-01-31 00:00+00|2025-02-03 00:00+00" \
           "2028-02-28 12:00+00|2026-01-31 00:00+00|2026-02-02 13:00+00"; do
  IFS='|' read -r quand trop_vieux garde <<<"$cas"
  psql_umami -c "INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at) VALUES
    (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/fige-vieux', '$trop_vieux'),
    (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/fige-garde', '$garde')" >/dev/null
  purge_a "$quand"
  attendu "purge du $quand : $trop_vieux supprimé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/fige-vieux'" 0
  attendu "purge du $quand : $garde gardé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/fige-garde'" 1
  psql_umami -c "DELETE FROM website_event WHERE website_id='$SITE' AND url_path LIKE '/fige-%'" >/dev/null
done

# Atomicité : une purge qui échoue en cours de route ne supprime rien.
psql_umami -c "INSERT INTO website_event (event_id, website_id, session_id, visit_id, url_path, created_at)
  VALUES (gen_random_uuid(), '$SITE', '$SR', gen_random_uuid(), '/vieux2', $VIEUX)" >/dev/null
if perl -pe 's/^COMMIT;$/SELECT 1\/0;\nCOMMIT;/' scripts/purge-mesure.sql \
  | docker compose -f docker-compose.dev.yml exec -T postgres psql -v ON_ERROR_STOP=1 -U umami -d umami -f - >/dev/null 2>&1; then
  echo "ÉCHEC : la purge sabotée aurait dû échouer" >&2; exit 1
fi
attendu "purge interrompue : rien de supprimé" "SELECT count(*) FROM website_event WHERE website_id='$SITE' AND url_path='/vieux2'" 1
echo "Purge conforme (I21)."
```

```bash
chmod +x scripts/tester-purge-mesure.sh
```

- [ ] **Step 2: Run it to verify it fails**

Run: `./scripts/tester-purge-mesure.sh`
Expected: FAIL (`scripts/purge-mesure.sql` introuvable)

- [ ] **Step 3: Write the purge**

`scripts/purge-mesure.sql` :

```sql
-- pdlm — purge de la mesure d'audience (I21 : aucune donnée de plus de 25 mois).
-- Lancé par le service `purge-mesure` au démarrage puis toutes les 24 h, et par
-- restore.sh après une restauration, avec ON_ERROR_STOP. Tables relevées sur
-- Umami 3.4.0. Limite : (maintenant + 2 jours) − 25 mois — la date est avancée
-- AVANT de retrancher les mois, sinon le saut de fin de mois laisse une ligne
-- dépasser 25 mois avant la purge suivante (28/02 → 1/03). `-v maintenant=…`
-- fige l'horloge pour les tests.
\if :{?maintenant}
\else
\set maintenant now
\endif
SELECT (:'maintenant'::timestamptz + interval '2 days') - interval '25 months' AS limite \gset

BEGIN;

CREATE TEMP TABLE purge_bilan (nom text, lignes bigint) ON COMMIT DROP;

WITH d AS (DELETE FROM event_data WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'event_data', count(*) FROM d;
WITH d AS (DELETE FROM session_data WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_data', count(*) FROM d;
WITH d AS (DELETE FROM revenue WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'revenue', count(*) FROM d;
WITH d AS (DELETE FROM heatmap_event WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'heatmap_event', count(*) FROM d;
WITH d AS (DELETE FROM session_replay WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_replay', count(*) FROM d;
WITH d AS (DELETE FROM session_replay_saved WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_replay_saved', count(*) FROM d;
WITH d AS (DELETE FROM website_event WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'website_event', count(*) FROM d;
WITH d AS (DELETE FROM session_link WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session_link', count(*) FROM d;
-- Sessions sur leur seule date (voir le plan, tâche 12 : le sel mensuel d'Umami
-- empêche une session de recevoir des événements au-delà de son mois).
WITH d AS (DELETE FROM session WHERE created_at < :'limite' RETURNING 1)
INSERT INTO purge_bilan SELECT 'session', count(*) FROM d;

SELECT now() AS purge, nom, lignes FROM purge_bilan ORDER BY nom;

COMMIT;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `./scripts/tester-purge-mesure.sh`
Expected: dix-huit lignes `OK` (deux par table), quatre lignes `OK` d'horloge figée (fin février 2027 et 2028), « purge interrompue : rien de supprimé », puis « Purge conforme (I21). »

- [ ] **Step 5: Commit**

```bash
git add scripts/purge-mesure.sql scripts/tester-purge-mesure.sh
git commit -m "Mesure d'audience — purge quotidienne à 25 mois, testée contre Umami 3.4.0 (I21)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Sauvegarde et restauration de la base `umami`

**Files:**

- Modify: `scripts/backup.sh`, `scripts/restore.sh`

**Interfaces:**

- Produces : `umami.sql.gz` dans le dossier de sauvegarde quand la base `umami` existe ; restauration de ce fichier s'il est présent. Une sauvegarde sans lui se restaure toujours.

- [ ] **Step 1: `backup.sh`**

Remplacer le bloc de contrôle du dump (`if ! gunzip -t … fi` ×2) par une fonction réutilisable, définie avant l'étape 1 :

```bash
# Un dump tronqué est pire qu'une absence de dump : on vérifie qu'il se
# décompresse entièrement et qu'il contient bien du SQL.
verifier_dump() { # $1=fichier $2=libellé
  if ! gunzip -t "$1" 2>/dev/null; then
    echo "ÉCHEC : le dump $2 est illisible." >&2
    exit 1
  fi
  if ! gunzip -c "$1" | grep -q 'PostgreSQL database dump complete'; then
    echo "ÉCHEC : le dump $2 est incomplet (marqueur de fin absent)." >&2
    exit 1
  fi
}
```

À l'étape 2, après le `pg_dump` de la base pdlm :

```bash
verifier_dump "$DOSSIER_ABS/postgres.sql.gz" PostgreSQL

# Mesure d'audience : base `umami`, si elle existe. Umami n'a pas besoin
# d'être arrêté : un pg_dump est cohérent pour une base à lui seul.
if docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='umami'" | grep -q 1; then
  echo "2/4 — Dump de la mesure d'audience → $DOSSIER/umami.sql.gz"
  docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" umami \
    | gzip >"$DOSSIER_ABS/umami.sql.gz"
  verifier_dump "$DOSSIER_ABS/umami.sql.gz" "de la mesure d'audience"
fi
```

Mettre à jour l'en-tête (« Le dossier reçoit : postgres.sql.gz + s3/ (contenu du bucket) + umami.sql.gz si la mesure d'audience est installée ») et, dans le bilan final :

```bash
[ -f "$DOSSIER_ABS/umami.sql.gz" ] && echo "  mesure  : $(gunzip -c "$DOSSIER_ABS/umami.sql.gz" | wc -l | tr -d ' ') lignes de SQL"
```

- [ ] **Step 2: `restore.sh`**

Tous les prérequis sont vérifiés **avant** de toucher à quoi que ce soit, base pdlm comprise. Après le contrôle `gunzip -t` de `postgres.sql.gz` :

```bash
# Mesure d'audience : prérequis vérifiés avant la moindre écriture.
if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  gunzip -t "$DOSSIER_ABS/umami.sql.gz" 2>/dev/null || {
    echo "ÉCHEC : $DOSSIER/umami.sql.gz est illisible — restauration annulée." >&2
    exit 1
  }
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_roles WHERE rolname='umami'" | grep -q 1 || {
    echo "ÉCHEC : rôle umami absent — restauration annulée. Lancer d'abord : docker compose --profile mesure up init-umami" >&2
    exit 1
  }
  # Services de mesure qui tournent maintenant : ceux-là, et eux seuls, seront relancés.
  MESURE_ACTIFS=$(docker compose --profile mesure ps --status running --services | grep -E '^(umami|purge-mesure)$' || true)
fi
```

Après la restauration PostgreSQL (fin de l'étape 2) :

```bash
if [ -f "$DOSSIER_ABS/umami.sql.gz" ]; then
  echo "2/5 — Restauration de la mesure d'audience (base umami)…"
  # Umami et la purge tiennent des connexions : arrêtés le temps de la restauration.
  if [ -n "$MESURE_ACTIFS" ]; then docker compose --profile mesure stop $MESURE_ACTIFS >/dev/null; fi
  docker compose exec -T postgres psql -U "$POSTGRES_USER" -d postgres \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='umami' AND pid <> pg_backend_pid();" \
    -c "DROP DATABASE IF EXISTS umami;" \
    -c "CREATE DATABASE umami OWNER umami;"
  gunzip -c "$DOSSIER_ABS/umami.sql.gz" \
    | docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami
  # I21 : une sauvegarde ancienne contient des visites devenues trop vieilles.
  # Purge immédiate, avant toute remise en service ; un échec arrête le script.
  echo "     purge des données de plus de 25 mois…"
  docker compose exec -T postgres psql -q -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d umami -f - \
    <scripts/purge-mesure.sql >/dev/null
  # --wait : attend la santé (Umami) ou le démarrage (purge) ; échoue sinon.
  if [ -n "$MESURE_ACTIFS" ]; then docker compose --profile mesure up -d --wait $MESURE_ACTIFS; fi
fi
```

Pas de `|| true` : si un service qui tournait ne redevient pas sain, le script échoue et le dit. Un service qui ne tournait pas avant n'est pas démarré.

Mettre à jour l'en-tête de `restore.sh` : « … et, si la sauvegarde contient umami.sql.gz, la base de mesure d'audience, purgée à 25 mois avant remise en service ».

- [ ] **Step 3: Check syntax**

Run: `bash -n scripts/backup.sh && bash -n scripts/restore.sh && echo syntaxe-ok`
Expected: `syntaxe-ok`. L'aller-retour réel est fait à la tâche 15, sur une pile de type production, avec une restauration sur une pile neuve.

- [ ] **Step 4: Commit**

```bash
git add scripts/backup.sh scripts/restore.sh
git commit -m "Mesure d'audience — sauvegarde et restauration de la base umami

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: CI, README, variables d'environnement

**Files:**

- Modify: `.github/workflows/ci.yml`, `.github/workflows/trivy-rescan.yml`, `README.md`

- [ ] **Step 1: Trivy for the Umami image (both workflows)**

Dans `ci.yml`, job `trivy-images-tierces`, renommer le job en `Trivy — images tierces (postgres, caddy, minio, umami) — remontée seule` et ajouter après l'étape minio :

```yaml
- name: Résoudre le digest umami épinglé
  id: umami
  run: |
    DIGEST=$(grep -oP 'ghcr\.io/umami-software/umami:[^@\s]+@sha256:[a-f0-9]+' docker-compose.yml | head -1)
    echo "image=$DIGEST" >> "$GITHUB_OUTPUT"

- name: umami (digest épinglé)
  uses: aquasecurity/trivy-action@v0.36.0
  with:
    image-ref: ${{ steps.umami.outputs.image }}
    scanners: vuln
    severity: HIGH,CRITICAL
    ignore-unfixed: true
    exit-code: '1'
```

Mêmes deux étapes dans `trivy-rescan.yml`, après l'étape minio (même indentation que les étapes voisines).

Vérifier localement que le motif trouve l'image :

```bash
grep -oE 'ghcr\.io/umami-software/umami:[^@[:space:]]+@sha256:[a-f0-9]+' docker-compose.yml | head -1
```

Expected: `ghcr.io/umami-software/umami:3.4.0@sha256:85909afc…`

- [ ] **Step 2: README**

Dans la table « Variables d'environnement », ajouter :

| Variable            | Rôle                                                                                |
| ------------------- | ----------------------------------------------------------------------------------- |
| `COMPOSE_PROFILES`  | `mesure` pour installer la mesure d'audience (Umami)                                |
| `UMAMI_DB_PASSWORD` | mot de passe du rôle Postgres `umami` (`openssl rand -hex 32`)                      |
| `UMAMI_APP_SECRET`  | secret d'Umami (`openssl rand -hex 32`)                                             |
| `UMAMI_URL`         | adresse interne d'Umami (`http://umami:3000`) ; **vide = pas de mesure d'audience** |
| `UMAMI_API_KEY`     | clé d'API du compte technique `pdlm`                                                |
| `UMAMI_TEAM_ID`     | identifiant de l'équipe de l'EPCI dans Umami                                        |
| `UMAMI_PUBLIC_URL`  | `https://stats.<plateforme>` (interface, liens de partage ; réservé, I6)            |
| `UMAMI_DESINSTALLE` | `1` seulement après une désinstallation délibérée (base `umami` supprimée) : autorise la suppression d'une commune qui a un historique de mesure |

Ajouter une section `## Mesure d'audience` après « Ajouter une commune » (et son entrée dans le Sommaire), avec :

1. **Principe** (trois phrases) : Umami, sans cookie ni bandeau, dans l'exemption CNIL ; collecte par le relais de pdlm sur le domaine de chaque commune ; interrupteur par commune, coupé par défaut. Renvoi à la spec.
2. **Installation, une fois par plateforme** :
   - dans `.env` : `COMPOSE_PROFILES=mesure`, `UMAMI_DB_PASSWORD`, `UMAMI_APP_SECRET`, `UMAMI_URL=http://umami:3000`, `UMAMI_PUBLIC_URL` ; `docker compose up -d` ;
   - DNS `stats.<plateforme>` et le bloc Caddy (décommenter celui du `Caddyfile`) ;
   - dans Umami (`https://stats.<plateforme>`) : se connecter en `admin` / `umami` et **changer ce mot de passe** ; créer l'utilisateur `pdlm` (rôle « utilisateur ») et, connecté en `pdlm`, sa clé d'API (Paramètres → Clés d'API ; la clé n'est montrée qu'une fois) → `UMAMI_API_KEY` ; en `admin`, créer l'équipe au nom de l'EPCI et y ajouter `pdlm` avec le rôle **membre** (le rôle « lecture seule » ne peut pas créer de site — vérifié) → identifiant de l'équipe dans `UMAMI_TEAM_ID` ; ajouter les agents de l'EPCI à l'équipe en **lecture seule** ;
   - `docker compose up -d app` pour que pdlm lise les variables.
3. **Règles** :
   - ne jamais créer de tableau (« board ») réunissant plusieurs communes (finalité propre à chaque éditeur, spec) ;
   - **ne jamais changer `UMAMI_TEAM_ID` ni retirer `pdlm` de l'équipe** une fois une commune activée : pdlm prouve qu'un site est déjà supprimé par « membre de l'équipe et site introuvable » ; un site resté dans une autre équipe passerait pour supprimé ;
   - **désinstaller** : couper la mesure de toutes les communes, supprimer la base `umami`, retirer `COMPOSE_PROFILES=mesure` et `UMAMI_URL`, puis poser `UMAMI_DESINSTALLE=1`. Sans cette dernière variable, pdlm refuse de supprimer une commune qui a un historique de mesure (une `UMAMI_URL` perdue au redéploiement ne doit pas laisser de données orphelines).
4. **Activer pour une commune** : admin de la commune, fiche commune → « Mesure d’audience » ; transmettre le « Lien de partage » au maire.
5. **Couper, effacer** : couper n'efface rien (purge à 25 mois) ; « Supprimer l’historique » efface tout, définitivement.
6. **Conservation** : purge quotidienne (service `purge-mesure`) ; tester avec `./scripts/tester-purge-mesure.sh` (pile de développement, profil `mesure`). Une sauvegarde de plus de 25 mois contient des données de mesure à supprimer.
7. **Recette à faire au premier déploiement** : les six points de la tâche 15, en liste.
8. **Coût mémoire** : la valeur relevée à la tâche 11, étape 4.

Dans « Sauvegarde et restauration », ajouter : « Si la mesure d'audience est installée, `umami.sql.gz` est sauvegardé et restauré avec la base ; une sauvegarde sans ce fichier se restaure toujours. »

Dans « Démarrage — développement », ajouter la commande `docker compose -f docker-compose.dev.yml --profile mesure up -d` et la ligne `.env` `UMAMI_URL=http://127.0.0.1:3002` (+ `UMAMI_API_KEY`, `UMAMI_TEAM_ID`, `UMAMI_PUBLIC_URL=http://127.0.0.1:3002` obtenus comme en production).

- [ ] **Step 3: `.env.example` lines for the user**

Ne pas ouvrir `.env.example` (règle de refus). Préparer pour le user, dans le message de fin de tâche, les lignes à coller lui-même :

```dotenv
# --- Mesure d'audience (Umami) — laisser vide pour ne pas l'installer ---
# COMPOSE_PROFILES=mesure
UMAMI_DB_PASSWORD=
UMAMI_APP_SECRET=
UMAMI_URL=
UMAMI_API_KEY=
UMAMI_TEAM_ID=
UMAMI_PUBLIC_URL=
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/trivy-rescan.yml README.md
git commit -m "Mesure d'audience — Trivy sur l'image Umami, documentation d'installation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Recette sur une pile de type production

Manuelle, avec Umami réel, sur la machine de développement (pile `docker-compose.yml` avec `Caddyfile.dev`). Chaque point est noté au README (tâche 14, point 7) avec son résultat du jour. Aucun code nouveau sauf correctif : si un point échoue, s'arrêter et appliquer superpowers:systematic-debugging.

- [ ] **Step 1: Stack up**

Le user ajoute dans `.env` : `COMPOSE_PROFILES=mesure`, `UMAMI_DB_PASSWORD` et `UMAMI_APP_SECRET` (`openssl rand -hex 32`), `UMAMI_URL=http://umami:3000`, `UMAMI_PUBLIC_URL=http://stats.localhost`. Puis :

```bash
docker compose up -d --build
docker compose ps
```

Installation Umami par l'API (mêmes étapes que le README, jeton admin) :

```bash
U=http://stats.localhost
T=$(curl -s -XPOST $U/api/auth/login -H 'content-type: application/json' -d '{"username":"admin","password":"umami"}' | jq -r .token)
curl -s -XPOST $U/api/users -H "authorization: Bearer $T" -H 'content-type: application/json' -d '{"username":"pdlm","password":"<mot de passe>","role":"user"}'
# puis connexion en pdlm → POST /api/me/api-keys {"name":"pdlm"} → .key
# admin → POST /api/teams {"name":"EPCI recette"} → id ; POST /api/teams/<id>/users {"userId":"<pdlm>","role":"team-member"}
```

Le user reporte `UMAMI_API_KEY` et `UMAMI_TEAM_ID` dans `.env` ; `docker compose up -d app`.

- [ ] **Step 2: Une page vue arrive, avec pays et ville**

Activer la mesure de la commune de démonstration dans l'admin, visiter une page publique depuis le navigateur, puis :

```bash
docker compose exec -T postgres psql -U postgres -d umami -c \
  "SELECT e.url_path, s.country, s.city, s.browser FROM website_event e JOIN session s USING (session_id) ORDER BY e.created_at DESC LIMIT 3"
```

Expected: la page visitée. En local, `country`/`city` restent vides (IP locale écartée) : noter le résultat, et refaire ce point au premier déploiement réel.

- [ ] **Step 3: X-Forwarded-For derrière Caddy**

Placer temporairement `console.log('[recette] xff', requete.headers.get('x-forwarded-for'))` en tête de `relayer`, reconstruire l'image, puis :

```bash
curl -s -o /dev/null -w '%{http_code}\n' -XPOST http://localhost/mesure/api/send \
  -H 'x-forwarded-for: 6.6.6.6' -H 'content-type: application/json' \
  -d '{"type":"event","payload":{"url":"/"}}'
docker compose logs app | grep '\[recette\]' | tail -1
```

Expected: la valeur la plus à droite est l'adresse vue par Caddy, pas `6.6.6.6` (Caddy remplace ou complète l'en-tête : **constater**, ne pas supposer). Retirer le `console.log` et reconstruire.

- [ ] **Step 4: Chemins bloqués sur stats**

```bash
for p in /api/send /api/batch /api/record /script.js /recorder.js /p/x /q/x; do
  printf '%-14s ' "$p"; curl -s -o /dev/null -w '%{http_code}\n' -XPOST "http://stats.localhost$p"; done
curl -s -o /dev/null -w 'interface : %{http_code}\n' http://stats.localhost/login
```

Expected: 404 partout ; interface : 200.

- [ ] **Step 5: Purge dans la pile**

```bash
docker compose logs purge-mesure | tail -12
```

Expected: le bilan par table de la première exécution, sans « ÉCHEC ».

- [ ] **Step 6: Sauvegarde et restauration**

```bash
./scripts/backup.sh backups/recette-umami
ls backups/recette-umami        # postgres.sql.gz  s3  umami.sql.gz
./scripts/restore.sh backups/recette-umami
docker compose exec -T postgres psql -U postgres -d umami -tAc "SELECT count(*) FROM website_event"
```

Expected: le même nombre de visites qu'avant la sauvegarde ; la ligne « purge des données de plus de 25 mois » affichée ; Umami et la purge redémarrés (`docker compose ps`).

Restauration sur une pile **neuve**. `down -v` efface les volumes du projet Compose `pdlm-prod` (la pile locale de recette), jamais ceux de développement (`pdlm`). Vérifier le nom avec `docker compose ls` avant de lancer :

```bash
docker compose down -v
docker compose up -d postgres minio
docker compose --profile mesure up init-umami
./scripts/restore.sh backups/recette-umami
docker compose up -d
docker compose exec -T postgres psql -U postgres -d umami -tAc "SELECT count(*) FROM website_event"
```

Expected: même nombre de visites ; tous les services sains. Sans l'étape `init-umami`, `restore.sh` doit s'arrêter **avant** de toucher à la base pdlm, avec le message « rôle umami absent ».

- [ ] **Step 7: Mémoire**

```bash
docker stats --no-stream --format '{{.Name}} {{.MemUsage}}' | grep -E 'umami|app'
```

Reporter la valeur dans le README (tâche 14, point 8).

- [ ] **Step 8: Bouton « Supprimer l’historique » et lien du maire**

Dans l'admin : le lien de partage ouvert dans une fenêtre privée montre la vue d'ensemble sans onglet sessions ni temps réel ; « Supprimer l’historique » → confirmation → « Historique effacé. » ; l'entrée « Historique de mesure effacé — … » est au journal ; `website_event` est vide pour ce site.

- [ ] **Step 8b: Par HTTP réel, sur le serveur construit (pas seulement en appelant les fonctions)**

Les tests d'intégration appellent les hooks, les routes et le point d'accès directement. Ici, on vérifie la même chose à travers Next et Payload construits (`docker compose` de la tâche 11, image reconstruite). `$JWT` : jeton de l'opérateur (`POST /api/users/login`) ; `$A` : identifiant d'une commune mesurée ; `$HOST_A`, `$HOST_B` : domaines de deux communes **toutes deux mesurées** (le bloc `:80` de `Caddyfile.dev` accepte tout hôte).

```bash
# mesure: null ne coupe rien et ne touche pas aux champs du hook
curl -s -X PATCH "http://localhost/api/communes/$A" -H "Authorization: JWT $JWT" \
  -H 'Content-Type: application/json' -d '{"mesure":null}' | jq '.doc.mesure'
# erreur publique : Umami arrêté → message lisible, pas « Something went wrong »
docker compose stop umami
curl -s -X PATCH "http://localhost/api/communes/$B_COUPEE" -H "Authorization: JWT $JWT" \
  -H 'Content-Type: application/json' -d '{"mesure":{"active":true}}' | jq '.errors[0].message'
docker compose start umami
# effacement par le vrai point d'accès, puis le journal
curl -s -X POST "http://localhost/api/communes/$A/mesure/effacer" -H "Authorization: JWT $JWT"
# frontière du proxy : en-tête interne forgé vers B, requête sur A → seul A reçoit la visite
curl -s -o /dev/null -w '%{http_code}\n' --resolve "$HOST_A:80:127.0.0.1" "http://$HOST_A/mesure/api/send" \
  -H "x-commune-host: $HOST_B" -H 'Content-Type: application/json' \
  -d '{"type":"event","payload":{"url":"/preuve-proxy"}}'
docker compose exec -T postgres psql -U postgres -d umami -tAc \
  "SELECT website_id FROM website_event WHERE url_path='/preuve-proxy'"
# opposition envoyée depuis une autre origine → 403, cookie intact
curl -s -o /dev/null -w '%{http_code}\n' -X POST --resolve "$HOST_A:80:127.0.0.1" "http://$HOST_A/mesure/opposition" \
  -H 'Origin: https://site-hostile.example' -d 'choix=accepte'
```

Expected : `active` et `siteUmami` inchangés ; message « Le service de mesure d’audience ne répond pas ; la mesure reste coupée… » (statut 503) ; « Historique effacé. » puis, au journal, « … demandé » et « Historique de mesure effacé » ; la visite `/preuve-proxy` enregistrée sous le site de A uniquement ; 403. Dans l'admin, avec les trois profils (opérateur, admin de la commune, rédacteur) : le bouton « Supprimer l’historique » n'apparaît que pour les deux premiers, et le message d'erreur d'activation s'affiche en clair.

- [ ] **Step 9: Commit the README results**

```bash
git add README.md
git commit -m "Mesure d'audience — recette sur pile de type production

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
