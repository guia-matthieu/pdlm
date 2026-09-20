import type { Payload } from 'payload'

/** Contenu lexical minimal (un paragraphe par chaîne). */
export function texteRich(...paragraphes: string[]): any {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: null,
      children: paragraphes.map((texte) => ({
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: null,
        children: [
          {
            type: 'text',
            text: texte,
            format: '',
            version: 1,
            detail: 0,
            mode: 'normal',
            style: '',
          },
        ],
      })),
    },
  }
}

async function upsertPage(payload: Payload, data: any) {
  const existantes = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: data.tenant } }, { slug: { equals: data.slug } }] },
    limit: 1,
    overrideAccess: true,
  })
  if (existantes.docs.length > 0) return existantes.docs[0]
  return payload.create({ collection: 'pages', data, overrideAccess: true })
}

/**
 * Contenu de démonstration (Saint-Exupéry-les-Bains) + gabarits légaux (J6) :
 * mentions légales, politique de confidentialité, déclaration d'accessibilité —
 * à compléter par chaque commune.
 */
export async function seedContenuDemo(
  payload: Payload,
  saintExId: number,
  valvertId: number,
  auteurId: number,
) {
  const J = 86_400_000

  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Accueil',
    slug: 'accueil',
    _status: 'published',
    blocs: [
      {
        blockType: 'hero',
        titre: 'Bienvenue à Saint-Exupéry-les-Bains',
        sousTitre: 'Site officiel de la commune — actualités, agenda et démarches.',
      },
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'Saint-Exupéry-les-Bains est une petite commune où il fait bon vivre. Ce site vous informe sur la vie municipale : actualités, agenda des manifestations et documents administratifs.',
          'La mairie est ouverte à tous ; n’hésitez pas à nous contacter pour toute question.',
        ),
      },
      {
        blockType: 'boutons',
        boutons: [
          { label: 'Actualités', url: '/actualites', variante: 'primaire' },
          { label: 'Agenda', url: '/agenda', variante: 'secondaire' },
        ],
      },
    ],
  })

  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Vie municipale',
    slug: 'vie-municipale',
    _status: 'published',
    blocs: [
      {
        blockType: 'accordeon',
        elements: [
          {
            titre: 'Le conseil municipal',
            contenu: texteRich(
              'Le conseil municipal se réunit environ une fois par mois en séance publique. Les délibérations sont disponibles dans la rubrique Documents.',
            ),
          },
          {
            titre: 'Les commissions',
            contenu: texteRich(
              'Plusieurs commissions travaillent sur les finances, les travaux, la communication et la vie associative.',
            ),
          },
        ],
      },
    ],
  })

  // — Gabarits légaux (J6) : à compléter par la commune —
  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Mentions légales',
    slug: 'mentions-legales',
    _status: 'published',
    metaDescription: 'Mentions légales du site de la commune.',
    blocs: [
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'Éditeur : Mairie de Saint-Exupéry-les-Bains — [adresse à compléter].',
          'Directeur de la publication : Monsieur/Madame le Maire — [à compléter].',
          'Hébergeur : [nom et coordonnées de l’hébergeur à compléter].',
          'Ce site est propulsé par glm, logiciel libre sous licence AGPL-3.0.',
        ),
      },
    ],
  })

  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Politique de confidentialité',
    slug: 'confidentialite',
    _status: 'published',
    metaDescription: 'Politique de confidentialité et protection des données personnelles.',
    blocs: [
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'Le site ne dépose aucun traceur (cookie) et n’utilise aucun outil de mesure d’audience.',
          'Données personnelles : seules les données strictement nécessaires au fonctionnement du site sont traitées (comptes des agents municipaux, contenus publiés). Durées de conservation : les documents publiés précisent leur durée de conservation ; les comptes sont conservés pendant la durée des fonctions ; les sauvegardes sont conservées [durée à compléter].',
          'Vous disposez d’un droit d’accès, de rectification et d’effacement en écrivant à la mairie : [courriel à compléter]. En cas de désaccord, vous pouvez saisir la CNIL (cnil.fr).',
        ),
      },
    ],
  })

  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Accessibilité',
    slug: 'accessibilite',
    _status: 'published',
    metaDescription: 'Déclaration d’accessibilité du site.',
    blocs: [
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'La mairie s’engage à rendre son site accessible conformément à l’article 47 de la loi n° 2005-102 du 11 février 2005.',
          'État de conformité : ce site est en cours d’audit et n’est pas encore déclaré conforme au RGAA. [État réel à compléter après audit.]',
          'Si vous ne parvenez pas à accéder à un contenu ou à un service, contactez la mairie à [courriel à compléter] — voies de recours : Défenseur des droits (defenseurdesdroits.fr).',
        ),
      },
    ],
  })

  // — Contenus de démonstration —
  const nbActus = await payload.count({
    collection: 'actualites',
    where: { tenant: { equals: saintExId } },
  })
  if (nbActus.totalDocs === 0) {
    await payload.create({
      collection: 'actualites',
      data: {
        tenant: saintExId,
        titre: 'Travaux de la voirie principale',
        slug: 'travaux-voirie-principale',
        resume: 'Des travaux de réfection auront lieu du lundi au vendredi prochain.',
        contenu: texteRich(
          'La voirie principale sera en travaux la semaine prochaine entre 8 h et 18 h. La circulation sera alternée.',
          'Merci de votre compréhension.',
        ),
        datePublication: new Date().toISOString(),
        auteur: auteurId,
        _status: 'published',
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'actualites',
      data: {
        tenant: saintExId,
        titre: 'Inscription à l’école municipale',
        slug: 'inscription-ecole-municipale',
        resume: 'Les inscriptions scolaires sont ouvertes jusqu’à la fin du mois.',
        contenu: texteRich('Les dossiers d’inscription sont à retirer en mairie.'),
        datePublication: new Date(Date.now() - 3 * J).toISOString(),
        auteur: auteurId,
        _status: 'published',
      },
      overrideAccess: true,
    })
  }

  const nbEvenements = await payload.count({
    collection: 'evenements',
    where: { tenant: { equals: saintExId } },
  })
  if (nbEvenements.totalDocs === 0) {
    await payload.create({
      collection: 'evenements',
      data: {
        tenant: saintExId,
        titre: 'Marché de printemps',
        dateDebut: new Date(Date.now() + 5 * J).toISOString(),
        dateFin: new Date(Date.now() + 5 * J + 6 * 3600_000).toISOString(),
        lieu: 'Place de la mairie',
        description: texteRich('Vente directe de producteurs locaux.'),
      },
      overrideAccess: true,
    })
    await payload.create({
      collection: 'evenements',
      data: {
        tenant: saintExId,
        titre: 'Conseil municipal (séance publique)',
        dateDebut: new Date(Date.now() + 12 * J).toISOString(),
        dateFin: new Date(Date.now() + 12 * J + 2 * 3600_000).toISOString(),
        lieu: 'Salle du conseil',
      },
      overrideAccess: true,
    })
  }

  const nbAlertes = await payload.count({
    collection: 'alertes',
    where: { tenant: { equals: saintExId } },
  })
  if (nbAlertes.totalDocs === 0) {
    await payload.create({
      collection: 'alertes',
      data: {
        tenant: saintExId,
        niveau: 'info',
        message: 'Fermeture exceptionnelle de la mairie jeudi après-midi.',
        dateDebut: new Date().toISOString(),
        dateFin: new Date(Date.now() + 7 * J).toISOString(),
      },
      overrideAccess: true,
    })
  }

  const nbMenus = await payload.count({
    collection: 'menus',
    where: { tenant: { equals: saintExId } },
  })
  if (nbMenus.totalDocs === 0) {
    const vieMunicipale = await payload.find({
      collection: 'pages',
      where: { and: [{ tenant: { equals: saintExId } }, { slug: { equals: 'vie-municipale' } }] },
      limit: 1,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'menus',
      data: {
        tenant: saintExId,
        nom: 'Principal',
        items: [
          { label: 'Vie municipale', page: vieMunicipale.docs[0]?.id },
          { label: 'Documents', url: '/documents' },
        ],
      },
      overrideAccess: true,
    })
  }

  // Valvert : un accueil minimal (preuve d’isolation des contenus)
  await upsertPage(payload, {
    tenant: valvertId,
    titre: 'Accueil',
    slug: 'accueil',
    _status: 'published',
    blocs: [
      {
        blockType: 'hero',
        titre: 'Bienvenue à Valvert',
        sousTitre: 'Site officiel de la commune de Valvert.',
      },
    ],
  })
}
