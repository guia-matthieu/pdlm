import { describe, expect, it } from 'vitest'

import { DEMARCHES_DEFAUT, MOSAIQUE_DEFAUT } from '@/lib/accueil-defauts'
import {
  DEMARCHES_MIGRATION,
  MOSAIQUE_MIGRATION,
} from '@/migrations/20261004_144904_gabarits_couleurs'

/**
 * Une migration est figée : elle porte ses valeurs de préremplissage en
 * littéraux et n'importe rien de `src/lib/` (décision 14). Ce test garde les
 * deux sources synchrones : un changement de `accueil-defauts.ts` sans
 * migration (ou l'inverse) se voit ici.
 */
describe('préremplissage — littéraux de la migration et défauts du champ', () => {
  it('les démarches de la migration sont celles du defaultValue', () => {
    expect(DEMARCHES_MIGRATION).toEqual(
      DEMARCHES_DEFAUT.map((d, i) => ({
        ordre: i + 1,
        picto: d.picto,
        lien: d.lien ?? null,
        titre: d.titre,
      })),
    )
  })

  it('les tuiles de la migration sont celles du defaultValue', () => {
    expect(MOSAIQUE_MIGRATION).toEqual(
      MOSAIQUE_DEFAUT.map((t, i) => ({
        ordre: i + 1,
        illustration: t.illustration,
        libelle: t.libelle,
      })),
    )
  })
})
