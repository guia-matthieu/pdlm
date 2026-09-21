import * as migration_20260920_154554 from './20260920_154554';
import * as migration_20260921_161136_ajout_instantanes_journal from './20260921_161136_ajout_instantanes_journal';

export const migrations = [
  {
    up: migration_20260920_154554.up,
    down: migration_20260920_154554.down,
    name: '20260920_154554',
  },
  {
    up: migration_20260921_161136_ajout_instantanes_journal.up,
    down: migration_20260921_161136_ajout_instantanes_journal.down,
    name: '20260921_161136_ajout_instantanes_journal'
  },
];
