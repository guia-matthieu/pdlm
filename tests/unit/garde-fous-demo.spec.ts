import { describe, expect, it } from 'vitest'

import {
  domainesMalRattaches,
  domaineDemoValide,
  erreursEnvironnementDemo,
  messageComptesEtrangers,
  motsDePasseTropCourts,
  nbEtiquettes,
  slugsEtrangers,
  variablesManquantes,
  type DomaineAttendu,
  type EnvDemo,
} from '@/seed/garde-fous-demo'

describe('Seed de démo en ligne — garde-fous de l’environnement', () => {
  const ENV_COMPLET: EnvDemo = {
    DEMO_DOMAIN: 'demo.pdlm.guia.fr',
    PLATFORM_DOMAIN: 'demo.pdlm.guia.fr',
    DEMO_MDP_OPERATEUR: 'mot-de-passe-operateur',
    DEMO_MDP_ADMIN: 'mot-de-passe-admin',
    DEMO_MDP_REDACTEUR: 'mot-de-passe-redacteur',
    DEMO_MDP_RELAIS: 'mot-de-passe-relais',
  }

  it('un environnement complet ne produit aucune erreur', () => {
    expect(erreursEnvironnementDemo(ENV_COMPLET)).toEqual([])
  })

  it('chaque variable manquante est nommée', () => {
    expect(variablesManquantes({})).toEqual([
      'DEMO_DOMAIN',
      'DEMO_MDP_OPERATEUR',
      'DEMO_MDP_ADMIN',
      'DEMO_MDP_REDACTEUR',
      'DEMO_MDP_RELAIS',
    ])
    expect(erreursEnvironnementDemo({})).toEqual([
      'Variable(s) manquante(s) ou vide(s) : DEMO_DOMAIN, DEMO_MDP_OPERATEUR, DEMO_MDP_ADMIN, DEMO_MDP_REDACTEUR, DEMO_MDP_RELAIS',
    ])
  })

  it('une variable vide compte comme manquante', () => {
    expect(variablesManquantes({ ...ENV_COMPLET, DEMO_DOMAIN: '' })).toEqual(['DEMO_DOMAIN'])
  })

  it('un mot de passe de moins de 16 caractères est refusé, 16 passent', () => {
    const tropCourt = 'a'.repeat(15)
    const juste = 'a'.repeat(16)
    expect(motsDePasseTropCourts({ ...ENV_COMPLET, DEMO_MDP_ADMIN: tropCourt })).toEqual([
      'DEMO_MDP_ADMIN',
    ])
    expect(motsDePasseTropCourts({ ...ENV_COMPLET, DEMO_MDP_RELAIS: tropCourt })).toEqual([
      'DEMO_MDP_RELAIS',
    ])
    expect(motsDePasseTropCourts({ ...ENV_COMPLET, DEMO_MDP_ADMIN: juste })).toEqual([])
    expect(
      erreursEnvironnementDemo({ ...ENV_COMPLET, DEMO_MDP_ADMIN: tropCourt }).some((e) =>
        e.startsWith('Mot(s) de passe trop courts'),
      ),
    ).toBe(true)
  })

  it('aucun message d’erreur ne révèle la valeur testée', () => {
    const erreurs = erreursEnvironnementDemo({
      DEMO_DOMAIN: 'DOMAINE-SECRET',
      PLATFORM_DOMAIN: 'AUTRE-DOMAINE-SECRET',
      DEMO_MDP_ADMIN: 'SECRET123',
    })
    expect(erreurs.join('\n').includes('SECRET')).toBe(false)
    expect(erreurs.join('\n').includes('DOMAINE')).toBe(false)
  })

  it('DEMO_DOMAIN est un domaine nu avec au moins trois étiquettes', () => {
    expect(nbEtiquettes('demo.pdlm.guia.fr')).toBe(4)
    expect(domaineDemoValide('demo.pdlm.guia.fr')).toBe(true)
    // Trois étiquettes = plancher (retouche G).
    expect(domaineDemoValide('demo.pdlm.localhost')).toBe(true)
    expect(domaineDemoValide('saint-ex.guia.fr')).toBe(true)
    // Deux étiquettes = un domaine réel potentiel, refusé (retouche G).
    expect(domaineDemoValide('guia.fr')).toBe(false)
    expect(domaineDemoValide('com.fr')).toBe(false)
    expect(domaineDemoValide('demo.localhost')).toBe(false)
    expect(domaineDemoValide('https://demo.pdlm.guia.fr')).toBe(false)
    expect(domaineDemoValide('demo.pdlm.guia.fr:443')).toBe(false)
    expect(domaineDemoValide('demo.pdlm.guia.fr/')).toBe(false)
    expect(domaineDemoValide('demo')).toBe(false)
    expect(domaineDemoValide('')).toBe(false)
  })

  it('DEMO_DOMAIN défini mais différent de PLATFORM_DOMAIN est refusé, les deux noms cités', () => {
    const erreurs = erreursEnvironnementDemo({
      ...ENV_COMPLET,
      PLATFORM_DOMAIN: 'pdlm.guia.fr',
    })
    expect(erreurs).toHaveLength(1)
    expect(erreurs[0]).toContain('DEMO_DOMAIN')
    expect(erreurs[0]).toContain('PLATFORM_DOMAIN')
    expect(erreurs[0]).not.toContain('pdlm.guia.fr')
    // Égaux ou PLATFORM_DOMAIN absent : pas d'erreur.
    expect(erreursEnvironnementDemo(ENV_COMPLET)).toEqual([])
    const sansPlatform: EnvDemo = { ...ENV_COMPLET }
    delete sansPlatform.PLATFORM_DOMAIN
    expect(erreursEnvironnementDemo(sansPlatform)).toEqual([])
  })

  it('le seed refuse une base qui contient une commune hors démo', () => {
    const slugsDemo = ['saint-ex', 'port-lavanne']
    expect(slugsEtrangers([], slugsDemo)).toEqual([])
    expect(slugsEtrangers(['saint-ex', 'port-lavanne'], slugsDemo)).toEqual([])
    expect(slugsEtrangers(['saint-ex', 'valvert'], slugsDemo)).toEqual(['valvert'])
    expect(slugsEtrangers(['villeneuve', 'valvert'], slugsDemo)).toEqual([
      'villeneuve',
      'valvert',
    ])
  })

  it('le seed refuse un hostname de démo déjà rattaché à une autre commune', () => {
    const attendus = [
      { hostname: 'saint-ex.demo.pdlm.guia.fr', commune: 1 },
      { hostname: 'port-lavanne.demo.pdlm.guia.fr', commune: 2 },
    ]
    // Base vierge de domaines de démo : rien à signaler.
    expect(domainesMalRattaches([], attendus)).toEqual([])
    // Rattachement conforme : rien à signaler.
    expect(
      domainesMalRattaches([{ hostname: 'saint-ex.demo.pdlm.guia.fr', commune: 1 }], attendus),
    ).toEqual([])
    // Hostname pris par une AUTRE commune : refus, hostname seul nommé.
    expect(
      domainesMalRattaches([{ hostname: 'saint-ex.demo.pdlm.guia.fr', commune: 7 }], attendus),
    ).toEqual(['saint-ex.demo.pdlm.guia.fr'])
    // Un domaine étranger hors hostnames de démo : ignoré.
    expect(domainesMalRattaches([{ hostname: 'mairie-quimper.fr', commune: 7 }], attendus)).toEqual(
      [],
    )
  })

  it('un hostname de démo déjà pris alors que la commune n’existe pas encore est refusé (retouche N)', () => {
    // Première exécution : commune attendue absente de la base (undefined).
    const attendus: DomaineAttendu[] = [
      { hostname: 'saint-ex.demo.pdlm.guia.fr', commune: undefined },
    ]
    // Hostname libre : rien à signaler, le seed créera commune puis domaine.
    expect(domainesMalRattaches([], attendus)).toEqual([])
    // Hostname déjà pris par une commune quelconque : refus — le seed de démo
    // ne doit pas créer sa commune sur un hostname qui recouvrirait un site.
    expect(
      domainesMalRattaches([{ hostname: 'saint-ex.demo.pdlm.guia.fr', commune: 7 }], attendus),
    ).toEqual(['saint-ex.demo.pdlm.guia.fr'])
  })

  it('le seed refuse une base qui contient un utilisateur hors comptes de démo (retouche O)', () => {
    const courrielsDemo = [
      'operateur@pdlm.invalid',
      'admin@pdlm.invalid',
      'redacteur@pdlm.invalid',
    ]
    // Base vide : rien à signaler.
    expect(messageComptesEtrangers([], courrielsDemo)).toBeNull()
    // Comptes de démo seuls : rien à signaler.
    expect(messageComptesEtrangers(courrielsDemo, courrielsDemo)).toBeNull()
    // Un compte étranger : refus, message SANS aucun courriel lu en base.
    const message = messageComptesEtrangers(
      [...courrielsDemo, 'marie.durand@mairie-quimper.fr'],
      courrielsDemo,
    )
    expect(message).toContain('1 utilisateur(s) hors comptes de démo')
    expect(message).not.toContain('marie.durand@mairie-quimper.fr')
    expect(message).not.toContain('@')
    // Deux comptes étrangers : le nombre seul les compte.
    expect(
      messageComptesEtrangers(
        ['a@ville.fr', 'operateur@pdlm.invalid', 'b@ville.fr'],
        courrielsDemo,
      ),
    ).toContain('2 utilisateur(s) hors comptes de démo')
  })
})
