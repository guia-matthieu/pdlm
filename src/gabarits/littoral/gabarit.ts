/**
 * Données du gabarit Littoral : la composition de la maquette validée
 * (`J-maquette-littoral/accueil.html`, ordre de son HTML) — héros, rive de la
 * mairie, démarches, puis les bandes séparées par des marées : texte libre,
 * actualités (la une au visuel débordant), agenda sur la courbe des marées,
 * mosaïque. Mise en forme : `theme.css`.
 */

import type { Gabarit } from '../types'

export const gabarit: Gabarit = {
  nom: 'littoral',
  libelle: 'Littoral',
  versionContrat: 1,
  // Décision 19 : les fichiers de `polices/` servis et préchargés — Source
  // Serif 4 (titres, 400 et 600 statiques) et Public Sans (texte, variable), OFL.
  polices: [
    'source-serif-4-latin-400.woff2',
    'source-serif-4-latin-600.woff2',
    'PublicSans-latin-variable.woff2',
  ],
  accueil: [
    { section: 'heros' },
    { section: 'mairie' },
    { section: 'demarches' },
    { section: 'texteLibre' },
    { section: 'actualites', variante: 'une' },
    { section: 'agenda' },
    { section: 'mosaique' },
  ],
  cadrageHeros: 'panorama',
  friseAuPied: true,
}
