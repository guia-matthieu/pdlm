import { describe, expect, it } from 'vitest'

import type { UtilisateurAcces } from '@/access/roles'
import {
  champIdentiteInterdit,
  lireComptesPartages,
  type ContexteRefusIdentite,
} from '@/hooks/protegerComptePartage'

const RELAIS = 'relais@pdlm.invalid'

const utilisateur = (id: string | number, role?: string): UtilisateurAcces => ({
  id,
  role: role ?? null,
})

const contexte = ({
  comptesPartages = [RELAIS],
  auteur = utilisateur(7),
  cibleEmail = RELAIS,
  cibleId = 7,
  modifie = {},
}: {
  comptesPartages?: readonly string[]
  auteur?: UtilisateurAcces | null | undefined
  cibleEmail?: string | null
  cibleId?: string | number | null
  modifie?: { email?: unknown; password?: unknown; [champ: string]: unknown }
} = {}): ContexteRefusIdentite => ({
  comptesPartages,
  auteur,
  cible: { id: cibleId, email: cibleEmail },
  modifie,
})

describe('lireComptesPartages', () => {
  it('rend une liste vide pour une variable absente ou vide', () => {
    expect(lireComptesPartages(undefined)).toEqual([])
    expect(lireComptesPartages('')).toEqual([])
  })

  it('sépare sur les virgules, enlève les espaces, ignore les morceaux vides', () => {
    expect(lireComptesPartages(`${RELAIS}`)).toEqual([RELAIS])
    expect(lireComptesPartages(` ${RELAIS} , autre@pdlm.invalid ,,`)).toEqual([
      RELAIS,
      'autre@pdlm.invalid',
    ])
  })

  it('normalise en minuscule', () => {
    expect(lireComptesPartages('Relais@PDLM.invalid')).toEqual([RELAIS])
  })
})

describe('champIdentiteInterdit', () => {
  it('refuse le changement de mot de passe de son propre compte partagé', () => {
    expect(champIdentiteInterdit(contexte({ modifie: { password: 'nouveau' } }))).toBe('password')
  })

  it('refuse le changement de courriel de son propre compte partagé', () => {
    expect(champIdentiteInterdit(contexte({ modifie: { email: 'autre@pdlm.invalid' } }))).toBe(
      'email',
    )
  })

  it('laisse passer le reste (nom, courriel identique, mot de passe vide)', () => {
    expect(champIdentiteInterdit(contexte({ modifie: { name: 'Relais' } }))).toBeNull()
    expect(champIdentiteInterdit(contexte({ modifie: { email: RELAIS } }))).toBeNull()
    expect(champIdentiteInterdit(contexte({ modifie: { password: '' } }))).toBeNull()
    expect(champIdentiteInterdit(contexte({ modifie: {} }))).toBeNull()
  })

  it('ne touche pas les comptes non listés (variable absente en production)', () => {
    expect(
      champIdentiteInterdit(contexte({ comptesPartages: [], modifie: { password: 'nouveau' } })),
    ).toBeNull()
    expect(
      champIdentiteInterdit(
        contexte({ cibleEmail: 'admin@pdlm.invalid', modifie: { password: 'nouveau' } }),
      ),
    ).toBeNull()
  })

  it('ne touche pas l’auteur qui modifie un AUTRE compte', () => {
    expect(
      champIdentiteInterdit(
        contexte({ auteur: utilisateur(8), modifie: { password: 'nouveau' } }),
      ),
    ).toBeNull()
  })

  it('ne touche pas l’opérateur', () => {
    expect(
      champIdentiteInterdit(
        contexte({
          auteur: utilisateur(7, 'operateur'),
          modifie: { password: 'nouveau', email: 'x@y.invalid' },
        }),
      ),
    ).toBeNull()
  })

  it('ne touche pas les appels sans req.user (seed, Local API)', () => {
    expect(
      champIdentiteInterdit(contexte({ auteur: null, modifie: { password: 'nouveau' } })),
    ).toBeNull()
    // `auteur: undefined` pris tel quel (le helper le remplacerait par son
    // défaut) : la Local API du seed envoie exactement ça.
    expect(
      champIdentiteInterdit({
        ...contexte({ modifie: { email: 'a@b.c' } }),
        auteur: undefined,
      }),
    ).toBeNull()
  })

  it('compare les id en chaînes (7 et "7" : le même compte) et les courriels sans casse', () => {
    expect(
      champIdentiteInterdit(
        contexte({ auteur: utilisateur('7'), cibleId: 7, modifie: { password: 'x' } }),
      ),
    ).toBe('password')
    expect(
      champIdentiteInterdit(contexte({ comptesPartages: ['Relais@PDLM.invalid'], modifie: { password: 'x' } })),
    ).toBe('password')
  })
})
