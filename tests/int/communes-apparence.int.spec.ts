// @vitest-environment node
import type { Payload } from 'payload'

import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Commune, User } from '@/payload-types'

import { getPayloadClient } from '@/lib/payload'

import { creerCommuneActive, supprimerCommuneTest } from '../helpers/communeTest'

let payload: Payload
let communeA: number
let communeB: number
let mediaA: number
let mediaB: number

async function image(): Promise<{ data: Buffer; mimetype: string; name: string; size: number }> {
  const data = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#888888' },
  })
    .png()
    .toBuffer()
  return { data, mimetype: 'image/png', name: 'test.png', size: data.length }
}

/** Erreur de validation attendue : chemin du champ et motif du message. */
async function refus(operation: Promise<unknown>, chemin: string, motif: RegExp) {
  const erreur = (await operation.then(
    () => null,
    (e: unknown) => e,
  )) as { data?: { errors?: Array<{ path?: string; message?: string }> } } | null
  expect(erreur, 'l’opération aurait dû être refusée').not.toBeNull()
  const [premiere] = erreur?.data?.errors ?? []
  expect(premiere?.path).toBe(chemin)
  expect(premiere?.message).toMatch(motif)
}

beforeAll(async () => {
  payload = await getPayloadClient()
  communeA = (await creerCommuneActive(payload, 'apparence-a')).id
  communeB = (await creerCommuneActive(payload, 'apparence-b')).id
  const mkMedia = async (alt: string, tenant: number) =>
    payload.create({
      collection: 'media',
      data: { alt, tenant },
      file: await image(),
      overrideAccess: true,
    })
  mediaA = (await mkMedia('A', communeA)).id as number
  mediaB = (await mkMedia('B', communeB)).id as number
})

afterAll(async () => {
  await payload.delete({ collection: 'media', id: mediaA, overrideAccess: true })
  await payload.delete({ collection: 'media', id: mediaB, overrideAccess: true })
  await supprimerCommuneTest(payload, communeA)
  await supprimerCommuneTest(payload, communeB)
})

/** Refus d'accès attendu : APIError 403 (Forbidden), pas une erreur de validation. */
async function refusAcces(operation: Promise<unknown>) {
  const erreur = (await operation.then(
    () => null,
    (e: unknown) => e,
  )) as { status?: number } | null
  expect(erreur, 'l’opération aurait dû être refusée').not.toBeNull()
  expect(erreur?.status).toBe(403)
}

describe('Communes — apparence et accueil (spec § 1)', () => {
  it('une commune créée reçoit 6 démarches et 4 tuiles préremplies', async () => {
    const c = await payload.findByID({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
      depth: 0,
    })
    expect(c.accueil?.demarches?.map((d) => d.titre)).toEqual([
      'Déchets',
      'Papiers d’identité',
      'État civil',
      'Urbanisme',
      'École et cantine',
      'Conseil municipal',
    ])
    // Les trois démarches à fiche nationale reçoivent son lien, les autres non.
    expect(c.accueil?.demarches?.map((d) => d.lien ?? null)).toEqual([
      null,
      'https://www.service-public.fr/particuliers/vosdroits/N358',
      'https://www.service-public.fr/particuliers/vosdroits/N359',
      'https://www.service-public.fr/particuliers/vosdroits/N319',
      null,
      null,
    ])
    expect(c.accueil?.mosaique?.map((t) => t.libelle)).toEqual([
      'Balades et sentiers',
      'Patrimoine',
      'Commerces',
      'Associations',
    ])
    expect(c.accueil?.mosaique?.map((t) => t.illustration)).toEqual([
      'sentiers',
      'patrimoine',
      'commerces',
      'associations',
    ])
    expect(c.apparence?.gabarit).toBe('village')
  })

  // I4 : une photo d'une autre commune est refusée, par le serveur. Le refus
  // se lit dans `data.errors` (forme du helper `refus`, comme
  // relations-tenant) : le message de `ValidationError` n'est que le résumé.
  it('refuse une photo d’accueil qui appartient à une autre commune', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { photoAccueil: mediaB } },
        overrideAccess: true,
      }),
      'apparence.photoAccueil',
      /n’appartient pas à cette commune/,
    )
  })

  it('refuse une photo de mosaïque qui appartient à une autre commune', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { accueil: { mosaique: [{ libelle: 'X', illustration: 'nature', photo: mediaB }] } },
        overrideAccess: true,
      }),
      'accueil.mosaique',
      /n’appartient pas à cette commune/,
    )
  })

  // I4, chemin positif : un média de la commune passe (le refus n'est pas
  // « tout refuser »).
  it('accepte une photo d’accueil et des photos de mosaïque de la commune', async () => {
    const avecPhoto = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { photoAccueil: mediaA } },
      overrideAccess: true,
      depth: 0,
    })
    expect(avecPhoto.apparence?.photoAccueil).toBe(mediaA)
    const avecTuiles = await payload.update({
      collection: 'communes',
      id: communeA,
      data: {
        accueil: {
          mosaique: [
            { libelle: 'X', illustration: 'nature', photo: mediaA },
            { libelle: 'Y', illustration: 'mer' },
          ],
        },
      },
      overrideAccess: true,
      depth: 0,
    })
    expect(avecTuiles.accueil?.mosaique?.[0]?.photo).toBe(mediaA)
    expect(avecTuiles.accueil?.mosaique?.[1]?.photo).toBeNull()
  })

  it('refuse une mosaïque mêlant des photos de deux communes', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: {
          accueil: {
            mosaique: [
              { libelle: 'X', illustration: 'nature', photo: mediaA },
              { libelle: 'Y', illustration: 'mer', photo: mediaB },
            ],
          },
        },
        overrideAccess: true,
      }),
      'accueil.mosaique',
      /n’appartient pas à cette commune/,
    )
  })

  // I24 : seul le format est refusé ; les majuscules passent telles quelles.
  it('accepte une couleur illisible et des majuscules, refuse les formats invalides', async () => {
    const illisible = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurTerre: '#ffff00' } },
      overrideAccess: true,
      depth: 0,
    })
    expect(illisible.apparence?.couleurTerre).toBe('#ffff00')
    const majuscules = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurTerre: '#7FC8A0' } },
      overrideAccess: true,
      depth: 0,
    })
    expect(majuscules.apparence?.couleurTerre).toBe('#7FC8A0')
    for (const invalide of ['#fff', '#12345678']) {
      await refus(
        payload.update({
          collection: 'communes',
          id: communeA,
          data: { apparence: { couleurTerre: invalide } },
          overrideAccess: true,
        }),
        'apparence.couleurTerre',
        /#RRGGBB/,
      )
    }
  })

  it('couleurs forcées : un hexa passe, un mot est refusé', async () => {
    const forcee = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleursForcees: { texte: '#112233' } } },
      overrideAccess: true,
      depth: 0,
    })
    expect(forcee.apparence?.couleursForcees?.texte).toBe('#112233')
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { couleursForcees: { texte: 'gris' } } },
        overrideAccess: true,
      }),
      'apparence.couleursForcees.texte',
      /#RRGGBB/,
    )
  })

  // Le lien d'une démarche part dans un `href` du site public : même règle
  // que les réseaux sociaux (XSS stocké sinon).
  it('refuse un lien de démarche qui n’est pas une URL éditoriale', async () => {
    const c = await payload.findByID({
      collection: 'communes',
      id: communeA,
      depth: 0,
      overrideAccess: true,
    })
    const [premiere] = c.accueil?.demarches ?? []
    for (const lien of ['javascript:alert(1)', '//hote.example']) {
      await refus(
        payload.update({
          collection: 'communes',
          id: communeA,
          data: {
            accueil: {
              demarches: (c.accueil?.demarches ?? []).map((d, i) =>
                i === 0 ? { id: d.id, picto: d.picto, lien } : { id: d.id, picto: d.picto },
              ),
            },
          },
          overrideAccess: true,
        }),
        `accueil.demarches.0.lien`,
        /URL invalide/,
      )
      expect(premiere, 'des démarches préremplies existent').toBeDefined()
    }
  })

  it('crée une version à chaque enregistrement', async () => {
    const avant = await payload.countVersions({
      collection: 'communes',
      where: { parent: { equals: communeA } },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurAccent: '#123456' } },
      overrideAccess: true,
    })
    const apres = await payload.countVersions({
      collection: 'communes',
      where: { parent: { equals: communeA } },
      overrideAccess: true,
    })
    expect(apres.totalDocs).toBe(avant.totalDocs + 1)
  })
})

describe('R4 — les lignes de l’accueil se modifient en français', () => {
  const STRUCTURE =
    /Les lignes de l’accueil \(ajout, retrait ou changement d’ordre\) se modifient en français\. Dans cette langue, traduisez seulement les titres\./
  type Demarche = NonNullable<NonNullable<Commune['accueil']>['demarches']>[number]
  type Tuile = NonNullable<NonNullable<Commune['accueil']>['mosaique']>[number]
  let lignes: Demarche[]
  let tuiles: Tuile[]

  beforeAll(async () => {
    const c = await payload.findByID({
      collection: 'communes',
      id: communeA,
      depth: 0,
      overrideAccess: true,
    })
    lignes = c.accueil?.demarches ?? []
    tuiles = c.accueil?.mosaique ?? []
  })

  it('traduit un titre et un libellé en corse (mêmes lignes, même ordre)', async () => {
    await payload.update({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      overrideAccess: true,
      data: {
        accueil: {
          demarches: lignes.map((l, i) => ({
            id: l.id,
            picto: l.picto,
            lien: l.lien,
            titre: `Titre ${i}`,
          })),
          mosaique: tuiles.map((t, i) => ({
            id: t.id,
            illustration: t.illustration,
            libelle: `Libelle ${i}`,
          })),
        },
      },
    })
    const co = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      depth: 0,
      overrideAccess: true,
    })
    expect(co.accueil?.demarches?.[0]?.titre).toBe('Titre 0')
    expect(co.accueil?.mosaique?.[0]?.libelle).toBe('Libelle 0')
  })

  it('le français lu après la traduction corse est inchangé', async () => {
    const fr = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'fr',
      depth: 0,
      overrideAccess: true,
    })
    expect(fr.accueil?.demarches?.map((d) => d.titre)).toEqual([
      'Déchets',
      'Papiers d’identité',
      'État civil',
      'Urbanisme',
      'École et cantine',
      'Conseil municipal',
    ])
    expect(fr.accueil?.demarches?.map((d) => d.id)).toEqual(lignes.map((l) => l.id))
  })

  it('refuse d’ajouter une démarche en corse', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            demarches: [
              ...lignes.map((l) => ({ id: l.id, picto: l.picto, lien: l.lien })),
              { picto: 'conseil', titre: 'Novu' },
            ],
          },
        },
      }),
      'accueil.demarches',
      STRUCTURE,
    )
  })

  it('refuse de retirer une tuile en corse', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            mosaique: tuiles.slice(0, -1).map((t) => ({ id: t.id, illustration: t.illustration })),
          },
        },
      }),
      'accueil.mosaique',
      STRUCTURE,
    )
  })

  // Remplacer une ligne par une nouvelle (même longueur, id différent)
  // changerait la ligne française : refusé aussi.
  it('refuse de remplacer une démarche par une ligne nouvelle en corse', async () => {
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            demarches: lignes.map((l, i) =>
              i === 0
                ? { picto: l.picto, titre: 'Linea nova' }
                : { id: l.id, picto: l.picto, lien: l.lien },
            ),
          },
        },
      }),
      'accueil.demarches',
      STRUCTURE,
    )
  })

  // `precision` est traduisible (décision 14) : sa traduction corse ne touche
  // pas la valeur française.
  it('traduit une précision en corse sans toucher le français', async () => {
    await payload.update({
      collection: 'communes',
      id: communeA,
      overrideAccess: true,
      data: {
        accueil: {
          demarches: lignes.map((l, i) => ({
            id: l.id,
            picto: l.picto,
            lien: l.lien,
            precision: i === 0 ? 'Sur rendez-vous' : undefined,
          })),
        },
      },
    })
    await payload.update({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      overrideAccess: true,
      data: {
        accueil: {
          demarches: lignes.map((l, i) => ({
            id: l.id,
            picto: l.picto,
            lien: l.lien,
            precision: i === 0 ? 'Nant’à appuntamentu' : undefined,
          })),
        },
      },
    })
    const co = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'co',
      depth: 0,
      overrideAccess: true,
    })
    expect(co.accueil?.demarches?.[0]?.precision).toBe('Nant’à appuntamentu')
    const fr = await payload.findByID({
      collection: 'communes',
      id: communeA,
      locale: 'fr',
      depth: 0,
      overrideAccess: true,
    })
    expect(fr.accueil?.demarches?.[0]?.precision).toBe('Sur rendez-vous')
  })

  it('refuse de changer l’ordre des démarches en corse', async () => {
    const [premiere, ...reste] = lignes
    await refus(
      payload.update({
        collection: 'communes',
        id: communeA,
        locale: 'co',
        overrideAccess: true,
        data: {
          accueil: {
            demarches: [
              ...reste.map((l) => ({ id: l.id, picto: l.picto, lien: l.lien })),
              { id: premiere.id, picto: premiere.picto, lien: premiere.lien },
            ],
          },
        },
      }),
      'accueil.demarches',
      STRUCTURE,
    )
  })
})

describe('droits — apparence et accueil (décisions 14, 15)', () => {
  const MDP_TEST = ['motdepasse', '1234'].join('-')
  let adminA: User
  let redacteurA: User
  let mandataireA: User
  let operateur: User
  let organisation: number
  let mandat: number

  beforeAll(async () => {
    const mkUser = (
      suffixe: string,
      roles: Array<'admin' | 'redacteur' | 'mandataire'>,
      role?: 'operateur',
    ) =>
      payload.create({
        collection: 'users',
        data: {
          email: `${suffixe}@apparence.pdlm.invalid`,
          password: MDP_TEST,
          name: suffixe,
          ...(role ? { role } : {}),
          tenants: [{ tenant: communeA, roles }],
        },
        overrideAccess: true,
      })
    adminA = await mkUser('admin-a', ['admin'])
    redacteurA = await mkUser('redacteur-a', ['redacteur'])
    operateur = await payload.create({
      collection: 'users',
      data: {
        email: 'operateur@apparence.pdlm.invalid',
        password: MDP_TEST,
        name: 'Opérateur',
        role: 'operateur',
      },
      overrideAccess: true,
    })
    // Le rôle « mandataire » se calcule depuis un mandat actif (lignesMandat),
    // il ne se pose pas dans `tenants` : organisation + mandat + agent.
    organisation = (
      await payload.create({
        collection: 'organisations',
        data: { nom: 'CC Apparence', nature: 'epci', siret: '32000000000002' },
        overrideAccess: true,
      })
    ).id
    mandat = (
      await payload.create({
        collection: 'mandats',
        data: { organisation, commune: communeA },
        overrideAccess: true,
      })
    ).id
    mandataireA = await payload.create({
      collection: 'users',
      data: {
        email: 'mandataire-a@apparence.pdlm.invalid',
        password: MDP_TEST,
        name: 'Mandataire A',
        organisation,
      },
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    for (const u of [adminA, redacteurA, mandataireA, operateur]) {
      await payload.delete({ collection: 'users', id: u.id, overrideAccess: true })
    }
    // Avant la commune (beforeDelete refuse un mandat vivant) et avant
    // l'organisation (liée par le mandat).
    await payload.delete({ collection: 'mandats', id: mandat, overrideAccess: true })
    await payload.delete({ collection: 'organisations', id: organisation, overrideAccess: true })
  })

  it('le rédacteur ne modifie pas la fiche commune (refus 403)', async () => {
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { couleurAccent: '#123456' } },
        overrideAccess: false,
        user: redacteurA,
      }),
    )
  })

  // Décision 15 : le mandataire n'a pas la main sur la fiche commune, donc ni
  // l'apparence ni l'accueil.
  it('le mandataire ne modifie ni l’apparence ni l’accueil (refus 403)', async () => {
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { apparence: { couleurAccent: '#123456' } },
        overrideAccess: false,
        user: mandataireA,
      }),
    )
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeA,
        data: { accueil: { demarches: [{ picto: 'dechets', titre: 'X' }] } },
        overrideAccess: false,
        user: mandataireA,
      }),
    )
  })

  it('l’admin de la commune change les couleurs et l’accueil', async () => {
    const avant = await payload.findByID({
      collection: 'communes',
      id: communeA,
      depth: 0,
      overrideAccess: true,
    })
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: {
        apparence: { couleurAccent: '#abcdef' },
        accueil: {
          // Un titre modifié et une ligne ajoutée : l'accueil se règle
          // réellement, pas seulement les couleurs.
          demarches: [
            ...(avant.accueil?.demarches?.map((d) => ({
              id: d.id,
              picto: d.picto,
              titre: d.id === avant.accueil?.demarches?.[0]?.id ? 'Vie quotidienne' : d.titre,
            })) ?? []),
            { picto: 'conseil', titre: 'Démarche ajoutée' },
          ],
        },
      },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(c.apparence?.couleurAccent).toBe('#abcdef')
    expect(c.accueil?.demarches?.[0]?.titre).toBe('Vie quotidienne')
    expect(c.accueil?.demarches).toHaveLength((avant.accueil?.demarches?.length ?? 0) + 1)
    expect(c.accueil?.demarches?.at(-1)?.titre).toBe('Démarche ajoutée')
  })

  it('l’admin de A ne modifie pas la commune B (refus 403)', async () => {
    await refusAcces(
      payload.update({
        collection: 'communes',
        id: communeB,
        data: { apparence: { couleurAccent: '#123456' } },
        overrideAccess: false,
        user: adminA,
      }),
    )
  })

  it('l’opérateur pose le gabarit et la frise, l’admin ne les écrase pas', async () => {
    const pose = await payload.update({
      collection: 'communes',
      id: communeA,
      data: {
        apparence: {
          gabarit: 'littoral',
          frise: [{ piece: 'falaise', taille: 'grande', ecart: 10 }],
        },
      },
      overrideAccess: false,
      user: operateur,
      depth: 0,
    })
    expect(pose.apparence?.gabarit).toBe('littoral')
    expect(pose.apparence?.frise?.[0]?.piece).toBe('falaise')

    // L'admin change une couleur : gabarit et frise survivent.
    await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { couleurAccent: '#654321' } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    const relu = await payload.findByID({
      collection: 'communes',
      id: communeA,
      depth: 0,
      overrideAccess: true,
    })
    expect(relu.apparence?.gabarit).toBe('littoral')
    expect(relu.apparence?.frise?.[0]?.piece).toBe('falaise')
    expect(relu.apparence?.couleurAccent).toBe('#654321')
  })

  it('le gabarit reste au seul opérateur : une écriture admin est ignorée', async () => {
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { gabarit: 'village' } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    // Payload ignore silencieusement un champ dont access.update est faux :
    // lire la valeur après coup, le gabarit posé par l'opérateur tient.
    expect(c.apparence?.gabarit).toBe('littoral')
  })

  it('la frise reste au seul opérateur : une écriture admin est ignorée', async () => {
    const c = await payload.update({
      collection: 'communes',
      id: communeA,
      data: { apparence: { frise: [] } },
      overrideAccess: false,
      user: adminA,
      depth: 0,
    })
    expect(c.apparence?.frise?.[0]?.piece).toBe('falaise')
  })

  // ⚠️ Comportement observé, NON voulu — bloqué, voir docs/qc/bloque-tache-02.md :
  // le plugin multi-tenant contraint readVersions de la collection tenants par
  // `version.id`, qui sur `_communes_v` est l'id de ligne de version, pas le
  // parent : un admin ne voit même plus les versions de SA commune (0), alors
  // qu'un opérateur ou overrideAccess les voient. Ce test épingle l'état
  // réel pour qu'un futur correctif le fasse basculer (et échouer) ; le
  // comportement voulu — totalDocs > 0 pour SA commune — est décrit dans le
  // fichier bloqué.
  it('versions : un admin ne voit aujourd’hui aucune version (y compris les siennes) — bloqué', async () => {
    const siennes = await payload.findVersions({
      collection: 'communes',
      where: { parent: { equals: communeA } },
      user: adminA,
      overrideAccess: false,
    })
    expect(siennes.totalDocs).toBe(0)
    // Celles de B : aucune fuite non plus (même contrainte dégénérée).
    const autres = await payload.findVersions({
      collection: 'communes',
      where: { parent: { equals: communeB } },
      user: adminA,
      overrideAccess: false,
    })
    expect(autres.totalDocs).toBe(0)
  })
})
