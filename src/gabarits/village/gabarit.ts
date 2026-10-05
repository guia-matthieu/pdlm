/**
 * Données du gabarit Village : la composition de la maquette validée
 * (`maquette/accueil.html`, ordre de son `generer.py`) — héros, démarches à
 * côté de la carte mairie, actualités avec une une, agenda, mosaïque. La
 * section « texte libre » (page « accueil » du rédacteur, spec § 3) n'existe
 * pas dans la maquette : elle se place après le bloc démarches + mairie,
 * avant les bandes. Mise en forme : `theme.css`.
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
    { section: 'actualites', variante: 'une' },
    { section: 'agenda' },
    { section: 'mosaique', variante: 'une-haute' },
  ],
  cadrageHeros: 'haut',
  friseAuPied: true,
}
