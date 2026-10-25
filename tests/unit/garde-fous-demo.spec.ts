import { describe, expect, it } from 'vitest'

import {
  domaineDemoValide,
  erreursEnvironnementDemo,
  estHostnameDemo,
  motsDePasseTropCourts,
  variablesManquantes,
  type EnvDemo,
} from '@/seed/garde-fous-demo'

describe('Seed de démo en ligne — garde-fous de l’environnement', () => {
  const ENV_COMPLET: EnvDemo = {
    DEMO_DOMAIN: 'demo.pdlm.guia.fr',
    DEMO_MDP_OPERATEUR: 'mot-de-passe-operateur',
    DEMO_MDP_ADMIN: 'mot-de-passe-admin',
    DEMO_MDP_REDACTEUR: 'mot-de-passe-redacteur',
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
    ])
    expect(erreursEnvironnementDemo({})).toEqual([
      'Variable(s) manquante(s) ou vide(s) : DEMO_DOMAIN, DEMO_MDP_OPERATEUR, DEMO_MDP_ADMIN, DEMO_MDP_REDACTEUR',
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
      DEMO_MDP_ADMIN: 'SECRET123',
    })
    expect(erreurs.join('\n').includes('SECRET')).toBe(false)
  })

  it('un hostname de démo vit sous DEMO_DOMAIN', () => {
    expect(estHostnameDemo('saint-ex.demo.pdlm.guia.fr', 'demo.pdlm.guia.fr')).toBe(true)
    expect(estHostnameDemo('port-lavanne.demo.localhost', 'demo.localhost')).toBe(true)
    expect(estHostnameDemo('saint-ex.autre.example.fr', 'demo.pdlm.guia.fr')).toBe(false)
    expect(estHostnameDemo('evil.demo.pdlm.guia.fr.example.org', 'demo.pdlm.guia.fr')).toBe(false)
    expect(estHostnameDemo('demo.pdlm.guia.fr', 'demo.pdlm.guia.fr')).toBe(false)
  })

  it('DEMO_DOMAIN est un domaine nu avec au moins un point', () => {
    expect(domaineDemoValide('demo.pdlm.guia.fr')).toBe(true)
    expect(domaineDemoValide('demo.localhost')).toBe(true)
    expect(domaineDemoValide('https://demo.pdlm.guia.fr')).toBe(false)
    expect(domaineDemoValide('demo.pdlm.guia.fr:443')).toBe(false)
    expect(domaineDemoValide('demo.pdlm.guia.fr/')).toBe(false)
    expect(domaineDemoValide('demo')).toBe(false)
    expect(domaineDemoValide('')).toBe(false)
  })
})
