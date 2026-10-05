/**
 * Données du gabarit Village — VERSION PROVISOIRE (décision 18) : les sept
 * sections communes dans l'ordre de la maquette, sans variante ni thème
 * propre. La tâche 5 remplace ce fichier par le gabarit complet (polices,
 * variantes, theme.css) sans toucher au moteur.
 */

import type { Gabarit } from '../types'

export const gabarit: Gabarit = {
  nom: 'village',
  libelle: 'Village',
  versionContrat: 1,
  // Polices chargées par la tâche 5 (Bricolage Grotesque + Atkinson
  // Hyperlegible Next) ; provisoirement le système de styles.css.
  polices: [],
  accueil: [
    { section: 'heros' },
    { section: 'demarches' },
    { section: 'mairie' },
    { section: 'texteLibre' },
    { section: 'actualites' },
    { section: 'agenda' },
    { section: 'mosaique' },
  ],
  cadrageHeros: 'haut',
}
