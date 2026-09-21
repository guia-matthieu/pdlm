import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Le DSFR, ses fondamentaux (bleu France #000091, rouge Marianne #e1000f) et
 * la police Marianne sont réservés aux sites de l'État en .gouv.fr : une
 * commune ne peut pas les employer (modalités d'utilisation du DSFR,
 * github.com/GouvernementFR/dsfr/blob/main/doc/legal/cgu.md). pdlm ne doit
 * donc pas les proposer, même par défaut.
 *
 * Les migrations sont exclues : elles gardent l'historique du schéma.
 */
const MARQUEURS = [/#000091\b/i, /#e1000f\b/i, /marianne/i]
const EXCLUS = [path.join('src', 'migrations')]

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = path.join(dossier, nom)
    if (EXCLUS.includes(chemin)) return []
    return statSync(chemin).isDirectory() ? fichiers(chemin) : [chemin]
  })
}

describe('identité visuelle de l’État absente du code', () => {
  it('aucun marqueur DSFR ou Marianne dans src/', () => {
    const occurrences = fichiers('src').flatMap((fichier) =>
      readFileSync(fichier, 'utf8')
        .split('\n')
        .flatMap((ligne, i) =>
          MARQUEURS.some((m) => m.test(ligne)) ? [`${fichier}:${i + 1}: ${ligne.trim()}`] : [],
        ),
    )
    expect(occurrences).toEqual([])
  })
})
