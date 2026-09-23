import * as migration_20260920_154554 from './20260920_154554'
import * as migration_20260921_161136_ajout_instantanes_journal from './20260921_161136_ajout_instantanes_journal'
import * as migration_20260921_212414_couleur_par_defaut_neutre from './20260921_212414_couleur_par_defaut_neutre'
import * as migration_20260923_165520_mesure_audience from './20260923_165520_mesure_audience'

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
]
