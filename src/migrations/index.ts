import * as migration_20260920_154554 from './20260920_154554'
import * as migration_20260921_161136_ajout_instantanes_journal from './20260921_161136_ajout_instantanes_journal'
import * as migration_20260921_212414_couleur_par_defaut_neutre from './20260921_212414_couleur_par_defaut_neutre'
import * as migration_20260923_165520_mesure_audience from './20260923_165520_mesure_audience'
import * as migration_20260925_182417_multilingue from './20260925_182417_multilingue'
import * as migration_20261001_171239_mandats from './20261001_171239_mandats'
import * as migration_20261004_144904_gabarits_couleurs from './20261004_144904_gabarits_couleurs'

export const migrations = [
  {
    up: migration_20260920_154554.up,
    down: migration_20260920_154554.down,
    name: '20260920_154554',
  },
  {
    up: migration_20260921_161136_ajout_instantanes_journal.up,
    down: migration_20260921_161136_ajout_instantanes_journal.down,
    name: '20260921_161136_ajout_instantanes_journal',
  },
  {
    up: migration_20260921_212414_couleur_par_defaut_neutre.up,
    down: migration_20260921_212414_couleur_par_defaut_neutre.down,
    name: '20260921_212414_couleur_par_defaut_neutre',
  },
  {
    up: migration_20260923_165520_mesure_audience.up,
    down: migration_20260923_165520_mesure_audience.down,
    name: '20260923_165520_mesure_audience',
  },
  {
    up: migration_20260925_182417_multilingue.up,
    down: migration_20260925_182417_multilingue.down,
    name: '20260925_182417_multilingue',
  },
  {
    up: migration_20261001_171239_mandats.up,
    down: migration_20261001_171239_mandats.down,
    name: '20261001_171239_mandats',
  },
  {
    up: migration_20261004_144904_gabarits_couleurs.up,
    down: migration_20261004_144904_gabarits_couleurs.down,
    name: '20261004_144904_gabarits_couleurs',
  },
]
