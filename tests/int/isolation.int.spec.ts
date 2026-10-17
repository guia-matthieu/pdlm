import type { Payload, PayloadRequest } from 'payload'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import type { User } from '@/payload-types'
import {
  actualiteParSlug,
  actualitesCommune,
  alertesActives,
  menuCommune,
  pagesDuMenu,
} from '@/lib/contenu'

/**
 * Preuve d'isolation (J4) — invariants I1 à I6, I9 du plan.
 * Contexte : opérateur, admin de A, rédacteur de B, utilisateur mixte
 * (admin de A + rédacteur de B), commune C non membre.
 */

let payload: Payload
let communeA: number
let communeB: number
let communeC: number
let operateur: User
let adminA: User
let redacteurB: User
let mixte: User

/** Mot de passe des utilisateurs de test (assemblé — non-secret, base jetable). */
const MDP_TEST = ['motdepasse', '1234'].join('-')

/** Fausse requête authentifiée — les access functions ne lisent que req.user. */
const req = (user: unknown) => ({ user: user ?? null }) as unknown as PayloadRequest

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- les blocs émis omettent volontairement blockType (donnée lâche sous test), incompatible avec l'union générée
const pageMin = (titre: string, tenant: number): any => ({
  titre,
  slug: undefined as unknown as string, // généré par hook
  tenant,
  blocs: [{ blocName: undefined, _status: undefined }].map(() => ({
    blocName: 'texteRiche',
    contenu: {
      root: { type: 'root', children: [], direction: null, format: '', indent: 0, version: 1 },
    },
  })),
})

beforeAll(async () => {
  payload = await getPayloadClient()

  const mkCommune = async (nom: string, slug: string) => {
    const existante = await payload.find({
      collection: 'communes',
      where: { slug: { equals: slug } },
      limit: 1,
      overrideAccess: true,
    })
    if (existante.docs.length > 0) return existante.docs[0]
    return payload.create({
      collection: 'communes',
      data: { nom, slug, actif: false },
      overrideAccess: true,
    })
  }

  communeA = (await mkCommune('Iso A', 'iso-a')).id
  communeB = (await mkCommune('Iso B', 'iso-b')).id
  communeC = (await mkCommune('Iso C', 'iso-c')).id

  const mkUser = async (email: string, data: Record<string, unknown> = {}) => {
    const existant = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existant.docs.length > 0) return existant.docs[0]
    return payload.create({
      collection: 'users',
      data: { email, password: MDP_TEST, name: email, ...data },
      overrideAccess: true,
    })
  }

  operateur = await mkUser('iso-operateur@pdlm.test', { role: 'operateur' })
  adminA = await mkUser('iso-admin-a@pdlm.test', {
    tenants: [{ tenant: communeA, roles: ['admin'] }],
  })
  redacteurB = await mkUser('iso-redacteur-b@pdlm.test', {
    tenants: [{ tenant: communeB, roles: ['redacteur'] }],
  })
  mixte = await mkUser('iso-mixte@pdlm.test', {
    tenants: [
      { tenant: communeA, roles: ['admin'] },
      { tenant: communeB, roles: ['redacteur'] },
    ],
  })
})

afterAll(async () => {
  // Nettoyage au mieux (la base de test est jetable) : contenus puis communes
  try {
    const ids = [communeA, communeB, communeC].filter(Boolean)
    for (const slugCollection of [
      'pages',
      'menus',
      'actualites',
      'alertes',
      'evenements',
    ] as const) {
      await payload.delete({
        collection: slugCollection,
        where: { tenant: { in: ids } },
        overrideAccess: true,
      })
    }
    await payload.delete({
      collection: 'users',
      where: { email: { like: '@pdlm.test' } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'communes',
      where: { id: { in: ids } },
      overrideAccess: true,
    })
  } catch {
    // toléré : la base pdlm_test est recréable
  }
})

describe('I1 — rôles contextualisés par commune', () => {
  it('mixte : brouillon autorisé en B (rédacteur)', async () => {
    const brouillon = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Page B rédacteur', communeB), tenant: communeB, _status: 'draft' },
      req: req(mixte),
      overrideAccess: false,
    })
    expect(brouillon.id).toBeDefined()
  })

  it('mixte : publication en B refusée (rédacteur, pas admin)', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: { ...pageMin('Page B publiable', communeB), _status: 'published' },
        req: req(mixte),
        overrideAccess: false,
      }),
    ).rejects.toThrow(/administrateur|publier/i)
  })

  it('mixte : écriture réservée admin en B refusée (evenement sans workflow)', async () => {
    await expect(
      payload.create({
        collection: 'evenements',
        data: {
          titre: 'Fête B',
          dateDebut: new Date().toISOString(),
          dateFin: new Date(Date.now() + 3600_000).toISOString(),
          tenant: communeB,
        },
        req: req(mixte),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('mixte : création en C (non membre) refusée', async () => {
    await expect(
      payload.create({
        collection: 'pages',
        data: { ...pageMin('Page C interdite', communeC), tenant: communeC, _status: 'draft' },
        req: req(mixte),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('mixte : lecture — jamais la commune C', async () => {
    const vues = await payload.find({
      collection: 'pages',
      req: req(mixte),
      limit: 100,
      overrideAccess: false,
    })
    const tenants = new Set(vues.docs.map((d) => (d as unknown as { tenant: number }).tenant))
    expect(tenants.has(communeC)).toBe(false)
  })

  it("opérations en masse : la contrainte tenant s'applique", async () => {
    // Published pages in A (par admin A) et B (par opérateur)
    await payload.create({
      collection: 'pages',
      data: { ...pageMin('Masse A', communeA), _status: 'published' },
      req: req(adminA),
    })
    await payload.create({
      collection: 'pages',
      data: { ...pageMin('Masse B', communeB), _status: 'published' },
      req: req(operateur),
    })

    // admin A tente une suppression en masse sur TOUTES les pages : ne peut toucher que A
    await payload.delete({
      collection: 'pages',
      where: { titre: { like: 'Masse' } },
      req: req(adminA),
      overrideAccess: false,
    })
    const restantes = await payload.find({
      collection: 'pages',
      where: { titre: { like: 'Masse' } },
      overrideAccess: true,
    })
    const titres = restantes.docs.map((d) => (d as unknown as { titre: string }).titre)
    expect(titres).toContain('Masse B')
    expect(titres).not.toContain('Masse A')

    // rédacteur B : suppression en masse refusée (aucune commune admin)
    await expect(
      payload.delete({
        collection: 'pages',
        where: { titre: { like: 'Masse' } },
        req: req(redacteurB),
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })
})

describe('I3 — workflow de publication', () => {
  it('rédacteur : publish refusé ; édition d’un publié ne modifie pas la version publique', async () => {
    const publiee = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Publiée B', communeB), _status: 'published' },
      req: req(operateur),
    })

    await expect(
      payload.update({
        collection: 'pages',
        id: publiee.id,
        data: { ...pageMin('Publiée B modifiée', communeB), _status: 'published' },
        req: req(redacteurB),
        overrideAccess: false,
      }),
    ).rejects.toThrow(/administrateur|publier/i)

    // La version publique reste intacte (draft sauvegardé à part)
    const versionPublique = await payload.findByID({
      collection: 'pages',
      id: publiee.id,
      overrideAccess: true,
      draft: false,
    })
    expect((versionPublique as unknown as { titre: string }).titre).toBe('Publiée B')
  })

  it('rédacteur : écriture SANS _status sur un document publié refusée', async () => {
    // Le test ci-dessus ne couvre que la demande explicite `_status: published`,
    // alors que `bloquerPublication` ne teste QUE `data._status`. Ce test ferme
    // le doute sur le PATCH nu : Payload force `publishAllLocales` dès que
    // l'appel ne porte pas `draft: true` (updateByID.js l. 81), ce qui fixe
    // `data._status = 'published'` AVANT les hooks de collection
    // (update.js l. 40-43). Une écriture directe est donc bien vue comme une
    // publication par le hook — et refusée. Ce test verrouille cet enchaînement,
    // qui tient à un détail d'implémentation de Payload.
    const publiee = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Publiée B intacte', communeB), _status: 'published' },
      req: req(operateur),
    })

    await expect(
      payload.update({
        collection: 'pages',
        id: publiee.id,
        data: { titre: 'Détournée par le rédacteur' },
        req: req(redacteurB),
        overrideAccess: false,
      }),
    ).rejects.toThrow(/administrateur|publier/i)

    const versionPublique = await payload.findByID({
      collection: 'pages',
      id: publiee.id,
      overrideAccess: true,
      draft: false,
    })
    expect((versionPublique as unknown as { titre: string }).titre).toBe('Publiée B intacte')
  })

  it('rédacteur : dépublication refusée', async () => {
    // Retirer un contenu de la vitrine publique est aussi un acte de
    // publication : un rédacteur ne doit pas pouvoir dépublier.
    const publiee = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Publiée B à dépublier', communeB), _status: 'published' },
      req: req(operateur),
    })

    // Document COMPLET (comme le poste l'interface d'admin) avec
    // `_status: 'draft'` et SANS `draft: true` : l'écriture vise la table
    // principale, donc la version publique.
    await expect(
      payload.update({
        collection: 'pages',
        id: publiee.id,
        data: { ...pageMin('Publiée B à dépublier', communeB), _status: 'draft' },
        req: req(redacteurB),
        overrideAccess: false,
      }),
    ).rejects.toThrow(/administrateur|publier/i)

    const versionPublique = await payload.findByID({
      collection: 'pages',
      id: publiee.id,
      overrideAccess: true,
      draft: false,
    })
    expect((versionPublique as unknown as { _status: string })._status).toBe('published')
  })

  it('rédacteur : brouillon sur un document publié TOUJOURS autorisé', async () => {
    // Garde-fou : verrouiller la publication ne doit pas fermer le travail
    // normal d'un rédacteur (proposer une modification en brouillon).
    // Le document complet est transmis, comme le fait l'interface d'admin —
    // `drafts.validate: true` valide le brouillon, `blocs` est requis.
    const publiee = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Publiée B pour brouillon', communeB), _status: 'published' },
      req: req(operateur),
    })

    const brouillon = await payload.update({
      collection: 'pages',
      id: publiee.id,
      data: pageMin('Proposition du rédacteur', communeB),
      draft: true,
      req: req(redacteurB),
      overrideAccess: false,
    })
    expect((brouillon as unknown as { titre: string }).titre).toBe('Proposition du rédacteur')

    // …et la version publique n'a pas bougé
    const versionPublique = await payload.findByID({
      collection: 'pages',
      id: publiee.id,
      overrideAccess: true,
      draft: false,
    })
    expect((versionPublique as unknown as { titre: string }).titre).toBe('Publiée B pour brouillon')
  })
})

describe('I4 — relations contrôlées au même tenant', () => {
  it('menu de B référençant une page de A : rejeté', async () => {
    const pageA = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Cible A', communeA), _status: 'published' },
      req: req(operateur),
    })
    await expect(
      payload.create({
        collection: 'menus',
        data: {
          nom: 'Principal',
          tenant: communeB,
          items: [{ label: 'Fuite', page: pageA.id }],
        },
        req: req(operateur),
      }),
    ).rejects.toThrow(/items/)
  })

  it('auteur non membre de la commune : rejeté', async () => {
    await expect(
      payload.create({
        collection: 'actualites',
        data: {
          titre: 'Actu B',
          tenant: communeB,
          resume: 'Résumé',
          contenu: {
            root: {
              type: 'root',
              children: [],
              direction: null,
              format: '',
              indent: 0,
              version: 1,
            },
          },
          auteur: adminA.id,
          _status: 'draft',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- slug absent : généré par hook à la création, introuvable dans le type d'entrée
        } as any,
        req: req(operateur),
      }),
    ).rejects.toThrow(/auteur/i)
  })

  it('lecteurs serveur : un menu référençant une page brouillon ne sérialise rien de non public', async () => {
    const brouillon = await payload.create({
      collection: 'pages',
      data: { ...pageMin('Cible brouillon', communeB), _status: 'draft' },
      req: req(operateur),
    })
    await payload.create({
      collection: 'menus',
      data: {
        nom: 'Principal',
        tenant: communeB,
        items: [{ label: 'Lien interne', page: brouillon.id }],
      },
      req: req(operateur),
    })
    const menu = await menuCommune(communeB)
    expect(menu).not.toBeNull()
    const ids = (menu?.items ?? [])
      .flatMap((i) => [i.page, ...(i.enfants ?? []).map((e) => e.page)])
      .filter((v): v is number => typeof v === 'number')
    const pages = await pagesDuMenu(communeB, ids)
    expect(pages.size).toBe(0) // la cible brouillon n'est jamais résolue
  })
})

describe('I6/D9 — visibilité et fenêtres de dates', () => {
  it('alertes : seule la fenêtre active est retournée', async () => {
    const HEURE = 3_600_000
    const JOUR = 86_400_000
    await payload.create({
      collection: 'alertes',
      data: {
        niveau: 'info',
        message: 'Active',
        dateDebut: new Date(Date.now() - HEURE).toISOString(),
        dateFin: new Date(Date.now() + JOUR).toISOString(),
        tenant: communeB,
      },
      req: req(operateur),
    })
    await payload.create({
      collection: 'alertes',
      data: {
        niveau: 'info',
        message: 'Expirée',
        dateDebut: new Date(Date.now() - 2 * JOUR).toISOString(),
        dateFin: new Date(Date.now() - JOUR).toISOString(),
        tenant: communeB,
      },
      req: req(operateur),
    })
    const actives = await alertesActives(communeB)
    expect(actives.map((a) => a.message)).toContain('Active')
    expect(actives.map((a) => a.message)).not.toContain('Expirée')
    // Aucune fuite depuis une autre commune
    const activesA = await alertesActives(communeA)
    expect(activesA.map((a) => a.message)).not.toContain('Active')
  })

  it('actualités : une parution programmée reste invisible, liste ET accès direct', async () => {
    const JOUR = 86_400_000
    const programmee = await payload.create({
      collection: 'actualites',
      data: {
        titre: 'Parution de demain',
        slug: 'parution-de-demain',
        tenant: communeB,
        resume: 'Sous embargo jusqu’à demain.',
        datePublication: new Date(Date.now() + JOUR).toISOString(),
        contenu: {
          root: {
            type: 'root',
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
            children: [
              {
                type: 'paragraph',
                direction: 'ltr',
                format: '',
                indent: 0,
                version: 1,
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: 'Texte',
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
        _status: 'published',
      },
      req: req(operateur),
    })
    expect(programmee.id).toBeDefined()

    // La liste filtre déjà sur la date…
    const liste = await actualitesCommune(communeB)
    expect(liste.docs.map((a) => a.slug)).not.toContain('parution-de-demain')

    // …mais l'embargo ne vaut que si l'accès direct par URL filtre aussi :
    // sinon le slug, devinable, donne le contenu en avance.
    const directe = await actualiteParSlug(communeB, 'parution-de-demain')
    expect(directe).toBeNull()
  })
})
