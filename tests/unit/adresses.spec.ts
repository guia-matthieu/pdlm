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
      // Fichiers de public/ : les pictogrammes des démarches (masques CSS).
      '/pictos/dechets.svg',
    ]) {
      expect(aiguiller(chemin), chemin).toBeNull()
    }
  })

  it('hors de ses fichiers, /pictos reste un chemin de page', () => {
    expect(aiguiller('/pictos')).toBe(`/${RACINE}/pictos`)
    expect(aiguiller('/pictos/a/b.svg')).toBe(`/${RACINE}/pictos/a/b.svg`)
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

  it('le reste ne commence jamais par `//` ni `/\\` (redirection vers un autre domaine)', () => {
    expect(cheminSansPrefixe('/fr//evil.com').reste).toBe('/evil.com')
    expect(cheminSansPrefixe('/fr/\\evil.com').reste).toBe('/evil.com')
    expect(cheminSansPrefixe('/fr///evil.com?x=1').reste).toBe('/evil.com?x=1')
    expect(cheminSansPrefixe('//evil.com').reste).toBe('/evil.com')
  })

  it('choisirLangue : la 308 vers la langue du domaine reste sur le site', () => {
    expect(
      choisirLangue({
        langueRacine: 'fr',
        languesSite: ['fr', 'co'],
        param: 'fr',
        cheminDemande: '/fr//evil.com',
      }),
    ).toEqual({ type: 'rediriger', vers: '/evil.com' })
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
    for (const lien of [
      'https://exemple.fr/x',
      'mailto:a@b.fr',
      'tel:0102030405',
      '//hote/x',
      '#contenu',
    ]) {
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
    expect(adresseCanonique('co', '/marche', DOMAINES, PLATEFORME)).toBe(
      'https://pigna.corsica/marche',
    )
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
    const xml = sitemapXml(
      ressources,
      'fr',
      DOMAINES.filter((d) => d.langue === 'fr'),
      PLATEFORME,
    )
    expect(xml).toContain('<loc>https://pigna.fr/co/marche</loc>')
  })

  it('échappe les caractères spéciaux XML dans loc et dans href', () => {
    const ressourcesAvecEsperluette = [
      { chemin: '/vie-&-citoyennete', langues: ['fr', 'co'] as const, priorite: '0.5' },
    ]
    const xml = sitemapXml(ressourcesAvecEsperluette, 'fr', DOMAINES, PLATEFORME)
    expect(xml).toContain('<loc>https://pigna.fr/vie-&amp;-citoyennete</loc>')
    expect(xml).toContain(
      '<xhtml:link rel="alternate" hreflang="co" href="https://pigna.corsica/vie-&amp;-citoyennete"/>',
    )
  })
})
