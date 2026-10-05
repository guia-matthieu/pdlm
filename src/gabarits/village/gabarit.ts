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
  // Décision 19 : les fichiers de `polices/` servis et préchargés — Bricolage
  // Grotesque (titres) et Atkinson Hyperlegible Next (texte), variables, OFL.
  polices: ['bricolage-grotesque-latin-wght.woff2', 'AtkinsonHyperlegibleNext-Regular-latin.woff2'],
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
