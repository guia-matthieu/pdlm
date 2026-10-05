/**
 * Dictionnaire d'interface de référence. Toute autre langue doit fournir
 * exactement ces clés (le typage l'impose, tests/unit/dictionnaires.spec.ts
 * le vérifie aussi).
 */
export const fr = {
  evitement: 'Aller au contenu',
  menuPrincipal: 'Menu principal',
  selecteurLangue: 'Langue du site',
  accueil: {
    lien: 'Accueil',
    demarches: 'Vos démarches',
    mairie: 'La mairie',
    actualites: 'Actualités',
    toutesActualites: 'Toutes les actualités',
    agenda: 'Au village ce mois-ci',
    toutAgenda: 'Tout l’agenda',
    mosaique: (nom: string) => `Vivre à ${nom}`,
  },
  actualites: 'Actualités',
  agenda: 'Agenda',
  documents: 'Documents',
  descriptionSite: (nom: string) =>
    `Site officiel de la commune de ${nom} : actualités, agenda et démarches.`,
  bienvenue: (nom: string) => `Bienvenue à ${nom}`,
  enConstruction: 'Le site est en cours de construction. Revenez bientôt !',
  consulter: 'Vous pouvez consulter :',
  aucuneActualite: 'Aucune actualité pour le moment.',
  pagination: 'Pagination',
  precedent: 'Précédent',
  suivant: 'Suivant',
  pageSur: (numero: string, total: string) => `Page ${numero} / ${total}`,
  aucunEvenement: 'Aucun événement à venir.',
  lieu: (lieu: string) => `Lieu : ${lieu}`,
  sInscrire: 'S’inscrire',
  filtrerCategorie: 'Filtrer par catégorie',
  toutes: 'Toutes',
  aucunDocument: 'Aucun document dans cette catégorie.',
  conservation: (duree: string) => `conservation : ${duree}`,
  categories: {
    deliberations: 'Délibérations',
    arretes: 'Arrêtés',
    budget: 'Budget',
    urbanisme: 'Urbanisme',
    autres: 'Autres',
  },
  horaires: 'Horaires :',
  contact: 'Contact',
  telephone: 'Téléphone :',
  courriel: 'Courriel :',
  informations: 'Informations',
  mentionsLegales: 'Mentions légales',
  confidentialite: 'Politique de confidentialité',
  accessibilite: 'Accessibilité',
  mesureAudience: 'Mesure d’audience',
  propulsePar: 'Site propulsé par',
  logicielLibre: '(logiciel libre).',
  nonTraduit: 'Cette page est présentée en français.',
}

export type Dictionnaire = typeof fr
