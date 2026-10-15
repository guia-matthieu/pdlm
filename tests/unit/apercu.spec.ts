import { describe, expect, it } from 'vitest'

import { idCommune, lireParametresApercu } from '@/lib/apercu'

/**
 * Lecture des paramètres d'aperçu (spec gabarits-couleurs § 4, I29) : l'adresse
 * est une entrée non fiable — tout paramètre invalide ou inconnu est ignoré et
 * remplacé par la valeur en base, et rien ne sort d'ici sans avoir passé le
 * format I24 (`^#[0-9a-fA-F]{6}$`).
 */
const EN_BASE = {
  gabarit: 'village',
  choix: { principale: '#123456', accent: '#abcdef', terre: null },
  forcees: { texte: '#101010' },
}

const lire = (requete: string) => lireParametresApercu(new URLSearchParams(requete), EN_BASE)

describe('apercu — couleurs choisies', () => {
  it('un paramètre invalide vaut la couleur en base', () => {
    expect(lire('principale=javascript:alert(1)').choix.principale).toBe('#123456')
  })

  it('une couleur valide est rendue en minuscules (I29)', () => {
    expect(lire('principale=%23ABCDEF').choix.principale).toBe('#abcdef')
    expect(lire('accent=%23A1B2C3').choix.accent).toBe('#a1b2c3')
  })

  it('un paramètre répété ne fait jamais passer la seconde valeur', () => {
    // `get()` rend la première occurrence : la valeur d'attaque placée en
    // seconde position n'est jamais lue.
    const premiere = lire('principale=%23111111&principale=javascript:alert(1)')
    expect(premiere.choix.principale).toBe('#111111')
  })

  it('sans paramètre, tout vaut la valeur en base', () => {
    expect(lire('')).toEqual({
      communeId: null,
      gabarit: 'village',
      choix: { principale: '#123456', accent: '#abcdef', terre: null },
      forcees: { texte: '#101010' },
      lang: 'fr',
    })
  })
})

describe('apercu — couleurs forcées (décision 6)', () => {
  it('une forcée hors format est ignorée : la valeur en base l’emporte', () => {
    expect(lire('texte=gris').forcees.texte).toBe('#101010')
  })

  it('une forcée valide passe, en minuscules', () => {
    expect(lire('picto3=%23AABBCC').forcees.picto3).toBe('#aabbcc')
  })

  it('une clé inconnue ne devient jamais une forcée', () => {
    const forcees = lire('encre=%23000000').forcees
    expect(forcees).not.toHaveProperty('encre')
  })
})

describe('apercu — gabarit et langue', () => {
  it('un gabarit inconnu vaut le gabarit en base', () => {
    expect(lire('gabarit=montagne').gabarit).toBe('village')
  })

  it('un gabarit du registre passe', () => {
    expect(lire('gabarit=littoral').gabarit).toBe('littoral')
  })

  it('une langue hors liste close vaut fr (défaut)', () => {
    expect(lire('lang=xx').lang).toBe('fr')
  })

  it('une langue de la liste close passe', () => {
    expect(lire('lang=co').lang).toBe('co')
  })
})

describe('apercu — identifiant de commune', () => {
  it.each([
    ['commune=42', 42],
    ['commune=1 OR 1=1', null],
    ['commune=', null],
    ['commune=-1', null],
    ['commune=1e3', null],
    ['', null],
  ])('%s → %s', (requete, attendu) => {
    expect(idCommune(new URLSearchParams(requete))).toBe(attendu)
    expect(lire(requete).communeId).toBe(attendu)
  })
})
