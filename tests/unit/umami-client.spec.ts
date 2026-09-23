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
