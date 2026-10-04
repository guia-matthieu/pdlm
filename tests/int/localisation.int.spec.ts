import type { Payload } from 'payload'

import type { Actualite } from '@/payload-types'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPayloadClient } from '@/lib/payload'
import { languesDisponiblesAdmin } from '@/lib/langues-admin'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'
import { refus } from '../helpers/refus'

let payload: Payload
let commune: { id: number; host: string }

const LOCALES = [
  { code: 'fr', label: 'Français' },
  { code: 'co', label: 'Corse' },
]

const texte = (t: string): NonNullable<Actualite['contenu']> => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: null,
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [
          { type: 'text', text: t, format: 0, version: 1, detail: 0, mode: 'normal', style: '' },
        ],
      },
    ],
  },
})

beforeAll(async () => {
  payload = await getPayloadClient()
  commune = await creerCommuneActive(payload, 'localisation')
})

afterAll(async () => {
  for (const collection of ['pages', 'actualites', 'menus', 'media'] as const) {
    await payload.delete({
      collection,
      where: { tenant: { equals: commune.id } },
      overrideAccess: true,
    })
  }
  await supprimerCommuneTest(payload, commune.id)
})

describe('localisation — lecture sans repli', () => {
  it('un document jamais édité en corse se lit vide en corse sans repli, en français avec repli', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        tenant: commune.id,
        titre: 'Marché',
        slug: 'marche-loc',
        blocs: [{ blockType: 'contact', titre: 'x' }],
        _status: 'published',
      },
      overrideAccess: true,
    })
    const sansRepli = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'co',
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
    })
    expect(sansRepli.titre ?? null).toBeNull()
    expect(sansRepli.traduction ?? 'non-traduite').toBe('non-traduite')
    const avecRepli = await payload.findByID({
      collection: 'pages',
      id: page.id,
      locale: 'co',
      fallbackLocale: 'fr',
      depth: 0,
      overrideAccess: true,
    })
    expect(avecRepli.titre).toBe('Marché')
  })
})

describe('localisation — obligatoire en français seulement', () => {
  it('refuse une page sans titre en français', async () => {
    await expect(
      refus(
        payload.create({
          collection: 'pages',
          data: {
            tenant: commune.id,
            slug: 'sans-titre',
            blocs: [{ blockType: 'contact' }],
          } as never,
          overrideAccess: true,
        }),
      ),
    ).rejects.toThrow(/obligatoire en français/)
  })

  it('accepte un libellé de menu traduit à moitié (règle 3 : petits textes)', async () => {
    const menu = await payload.create({
      collection: 'menus',
      data: {
        tenant: commune.id,
        nom: 'Principal',
        items: [
          { label: 'Marché', url: '/marche' },
          { label: 'Démarches', url: '/demarches' },
        ],
      },
      overrideAccess: true,
    })
    const enCorse = await payload.update({
      collection: 'menus',
      id: menu.id,
      locale: 'co',
      overrideAccess: true,
      data: {
        items: [
          { id: menu.items[0].id, label: 'Mercatu', url: '/marche' },
          { id: menu.items[1].id, url: '/demarches' },
        ],
      },
    })
    expect(enCorse.items[0].label).toBe('Mercatu')
    const fr = await payload.findByID({
      collection: 'menus',
      id: menu.id,
      locale: 'fr',
      overrideAccess: true,
    })
    expect(fr.items.map((i) => i.label)).toEqual(['Marché', 'Démarches'])
  })
})

describe('I17 — « validée » exige une traduction complète', () => {
  it('refuse de valider en corse une actualité dont le contenu corse manque', async () => {
    const actu = await payload.create({
      collection: 'actualites',
      data: {
        tenant: commune.id,
        titre: 'Fête',
        slug: 'fete-loc',
        resume: 'Résumé',
        contenu: texte('Texte'),
        _status: 'published',
      },
      overrideAccess: true,
    })
    await expect(
      refus(
        payload.update({
          collection: 'actualites',
          id: actu.id,
          locale: 'co',
          overrideAccess: true,
          data: { traduction: 'validee', titre: 'Festa' },
        }),
      ),
    ).rejects.toThrow(/résumé|contenu/i)
  })

  it('accepte de valider quand tout est traduit, sans toucher au français', async () => {
    const actu = await payload.create({
      collection: 'actualites',
      data: {
        tenant: commune.id,
        titre: 'Foire',
        slug: 'foire-loc',
        resume: 'Résumé',
        contenu: texte('Texte'),
        _status: 'published',
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'actualites',
      id: actu.id,
      locale: 'co',
      overrideAccess: true,
      data: { traduction: 'validee', titre: 'Fiera', resume: 'Riassuntu', contenu: texte('Testu') },
    })
    const fr = await payload.findByID({
      collection: 'actualites',
      id: actu.id,
      locale: 'fr',
      overrideAccess: true,
    })
    expect(fr.titre).toBe('Foire')
  })
})

describe('I17 — validation en deux temps', () => {
  // Constat (tâche 3) : dans `beforeChange`, `data` est complété avec le document
  // de la MÊME langue (sans repli sur le français). Valider seul, après avoir
  // traduit, doit donc passer ; valider sans traduction reste refusé (ci-dessus).
  it('accepte de passer à « validée » sans renvoyer les textes déjà traduits', async () => {
    const actu = await payload.create({
      collection: 'actualites',
      data: {
        tenant: commune.id,
        titre: 'Bal',
        slug: 'bal-loc',
        resume: 'Résumé',
        contenu: texte('Texte'),
        _status: 'published',
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'actualites',
      id: actu.id,
      locale: 'co',
      overrideAccess: true,
      data: {
        traduction: 'a-relire',
        titre: 'Ballu',
        resume: 'Riassuntu',
        contenu: texte('Testu'),
      },
    })
    const valide = await payload.update({
      collection: 'actualites',
      id: actu.id,
      locale: 'co',
      overrideAccess: true,
      data: { traduction: 'validee' },
    })
    expect(valide.traduction).toBe('validee')
  })
})

describe('R5 — un contenu se crée en français', () => {
  it('refuse de créer une page en corse', async () => {
    await expect(
      refus(
        payload.create({
          collection: 'pages',
          locale: 'co',
          data: {
            tenant: commune.id,
            titre: 'Mercatu',
            slug: 'mercatu-co',
            blocs: [{ blockType: 'contact' }],
          } as never,
          overrideAccess: true,
        }),
      ),
    ).rejects.toThrow(/Créez d’abord ce contenu en français, puis traduisez-le\./)
  })
})

describe('slugs en français', () => {
  it('une mise à jour en corse sans slug laisse le slug français inchangé', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        tenant: commune.id,
        titre: 'Bal du village',
        slug: 'bal-du-village',
        blocs: [{ blockType: 'contact', titre: 'x' }],
        _status: 'published',
      },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'pages',
      id: page.id,
      locale: 'co',
      data: { titre: 'Ballu corsu' },
      overrideAccess: true,
    })
    for (const locale of ['fr', 'co'] as const) {
      const lu = await payload.findByID({
        collection: 'pages',
        id: page.id,
        locale,
        depth: 0,
        overrideAccess: true,
      })
      expect(lu.slug, locale).toBe('bal-du-village')
    }
  })
})

describe('R4 — la structure du menu se modifie en français', () => {
  const STRUCTURE =
    /La structure du menu \(ajout, retrait ou changement d’ordre d’éléments\) se modifie en français\./
  let menu: { id: number; items: Array<{ id?: string | null; url?: string | null }> }

  beforeAll(async () => {
    const existant = await payload.find({
      collection: 'menus',
      where: { tenant: { equals: commune.id } },
      limit: 1,
      overrideAccess: true,
    })
    menu = (existant.docs[0] ??
      (await payload.create({
        collection: 'menus',
        data: {
          tenant: commune.id,
          nom: 'Principal',
          items: [
            { label: 'Marché', url: '/marche' },
            { label: 'Démarches', url: '/demarches' },
          ],
        },
        overrideAccess: true,
      }))) as typeof menu
  })

  it('refuse d’ajouter un élément en corse', async () => {
    await expect(
      refus(
        payload.update({
          collection: 'menus',
          id: menu.id,
          locale: 'co',
          overrideAccess: true,
          data: {
            items: [
              ...menu.items.map((i) => ({ id: i.id, url: i.url })),
              { label: 'Novu', url: '/novu' },
            ],
          },
        }),
      ),
    ).rejects.toThrow(STRUCTURE)
  })

  it('refuse de retirer un élément en corse', async () => {
    await expect(
      refus(
        payload.update({
          collection: 'menus',
          id: menu.id,
          locale: 'co',
          overrideAccess: true,
          data: { items: [{ id: menu.items[0].id, url: menu.items[0].url }] },
        }),
      ),
    ).rejects.toThrow(STRUCTURE)
  })

  it('refuse de changer l’ordre des éléments en corse (le français suivrait)', async () => {
    const [premier, second] = menu.items
    await expect(
      refus(
        payload.update({
          collection: 'menus',
          id: menu.id,
          locale: 'co',
          overrideAccess: true,
          data: {
            items: [
              { id: second.id, url: second.url },
              { id: premier.id, url: premier.url },
            ],
          },
        }),
      ),
    ).rejects.toThrow(STRUCTURE)
    const francais = await payload.findByID({
      collection: 'menus',
      id: menu.id,
      locale: 'fr',
      depth: 0,
      overrideAccess: true,
    })
    expect(francais.items?.map((i) => i.id)).toEqual([premier.id, second.id])
  })
})

describe('I17 et obligatoire en français — cas limites', () => {
  it('refuse de valider en corse une page dont les blocs corses sont vides', async () => {
    const page = await payload.create({
      collection: 'pages',
      data: {
        tenant: commune.id,
        titre: 'Horaires',
        slug: 'horaires-loc',
        blocs: [{ blockType: 'contact' }],
        _status: 'published',
      },
      overrideAccess: true,
    })
    await expect(
      refus(
        payload.update({
          collection: 'pages',
          id: page.id,
          locale: 'co',
          overrideAccess: true,
          data: { traduction: 'validee', titre: 'Orarii', blocs: [] },
        }),
      ),
    ).rejects.toThrow(/le contenu de la page manque/)
  })

  it('refuse une actualité dont le contenu français est un paragraphe vide', async () => {
    const vide: NonNullable<Actualite['contenu']> = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [
          { type: 'paragraph', format: '', indent: 0, version: 1, direction: null, children: [] },
        ],
      },
    }
    await expect(
      refus(
        payload.create({
          collection: 'actualites',
          data: {
            tenant: commune.id,
            titre: 'Vide',
            slug: 'vide-loc',
            resume: 'Résumé',
            contenu: vide,
          },
          overrideAccess: true,
        }),
      ),
    ).rejects.toThrow(/obligatoire en français/)
  })
})

describe('nom de référence en français', () => {
  it('modifier une commune en corse journalise son nom français', async () => {
    const { nom } = await payload.findByID({
      collection: 'communes',
      id: commune.id,
      locale: 'fr',
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: commune.id,
      locale: 'co',
      data: { nom: 'Nome corsu', horaires: 'Luni' },
      overrideAccess: true,
    })
    const { docs } = await payload.find({
      collection: 'journal',
      where: { commune: { equals: commune.id } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
    expect(docs[0].communeNom).toBe(nom)
    expect(docs[0].message).toBe(`Modification — ${nom}`)
  })
})

describe('admin — langues proposées', () => {
  it('un non-opérateur ne voit que le français et les langues de sa commune', async () => {
    await payload.update({
      collection: 'communes',
      id: commune.id,
      data: { langues: ['co'] },
      overrideAccess: true,
    })
    const locales = [
      { code: 'fr', label: 'Français' },
      { code: 'co', label: 'Corse' },
    ]
    const req = {
      payload,
      user: { role: 'redacteur', tenants: [{ tenant: commune.id, roles: ['redacteur'] }] },
      headers: new Headers({ cookie: `payload-tenant=${commune.id}` }),
    }
    expect((await languesDisponiblesAdmin({ locales, req } as never)).map((l) => l.code)).toEqual([
      'fr',
      'co',
    ])
    await payload.update({
      collection: 'communes',
      id: commune.id,
      data: { langues: [] },
      overrideAccess: true,
    })
    expect((await languesDisponiblesAdmin({ locales, req } as never)).map((l) => l.code)).toEqual([
      'fr',
    ])
  })

  it('ignore le cookie d’une commune qui n’est pas celle de l’utilisateur', async () => {
    const autre = await creerCommuneActive(payload, 'localisation-autre')
    try {
      await payload.update({
        collection: 'communes',
        id: autre.id,
        data: { langues: ['co'] },
        overrideAccess: true,
      })
      const req = {
        payload,
        user: { role: 'redacteur', tenants: [{ tenant: commune.id, roles: ['redacteur'] }] },
        headers: new Headers({ cookie: `payload-tenant=${autre.id}` }),
      }
      // La commune de l'utilisateur n'a aucune langue régionale ; celle du cookie en a une.
      expect(
        (await languesDisponiblesAdmin({ locales: LOCALES, req } as never)).map((l) => l.code),
      ).toEqual(['fr'])
    } finally {
      await supprimerCommuneTest(payload, autre.id)
    }
  })

  it('sans cookie : les langues de l’unique commune, le français seul s’il y en a plusieurs', async () => {
    const autre = await creerCommuneActive(payload, 'localisation-autre')
    try {
      await payload.update({
        collection: 'communes',
        id: commune.id,
        data: { langues: ['co'] },
        overrideAccess: true,
      })
      const seule = {
        payload,
        user: { role: 'redacteur', tenants: [{ tenant: commune.id, roles: ['redacteur'] }] },
        headers: new Headers(),
      }
      expect(
        (await languesDisponiblesAdmin({ locales: LOCALES, req: seule } as never)).map(
          (l) => l.code,
        ),
      ).toEqual(['fr', 'co'])
      const plusieurs = {
        ...seule,
        user: {
          role: 'redacteur',
          tenants: [
            { tenant: commune.id, roles: ['redacteur'] },
            { tenant: autre.id, roles: ['redacteur'] },
          ],
        },
      }
      expect(
        (await languesDisponiblesAdmin({ locales: LOCALES, req: plusieurs } as never)).map(
          (l) => l.code,
        ),
      ).toEqual(['fr'])
    } finally {
      await payload.update({
        collection: 'communes',
        id: commune.id,
        data: { langues: [] },
        overrideAccess: true,
      })
      await supprimerCommuneTest(payload, autre.id)
    }
  })

  it('un opérateur voit toutes les langues', async () => {
    const locales = [
      { code: 'fr', label: 'Français' },
      { code: 'co', label: 'Corse' },
    ]
    const req = { payload, user: { role: 'operateur' }, headers: new Headers() }
    expect(await languesDisponiblesAdmin({ locales, req } as never)).toHaveLength(2)
  })
})
