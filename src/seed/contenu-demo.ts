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
 * R5 : un contenu se traduit après avoir été créé en français. Idempotent :
 * si la version corse est déjà validée (lue sans repli — `fallbackLocale:
 * false`), on ne réécrit rien.
 */
async function traduire(
  payload: Payload,
  collection: 'pages',
  id: number,
  data: Record<string, unknown>,
) {
  const existante = await payload.findByID({
    collection,
    id,
    locale: 'co',
    fallbackLocale: false,
    overrideAccess: true,
  })
  if ((existante as { traduction?: string })?.traduction === 'validee') return
  await payload.update({
    collection,
    id,
    locale: 'co',
    data: { ...data, traduction: 'validee', _status: 'published' },
    overrideAccess: true,
  })
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

  // La page « accueil » alimente la section texte libre de l'accueil composé
  // par le gabarit (le héros vient du gabarit) : pas de bloc hero ici, il
  // serait doublé sur la page d'accueil du site.
  await upsertPage(payload, {
    tenant: saintExId,
    titre: 'Accueil',
    slug: 'accueil',
    _status: 'published',
    blocs: [
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
          'Ce site est propulsé par pdlm, logiciel libre sous licence AGPL-3.0.',
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
          'Le site ne dépose aucun cookie de mesure d’audience. Si la commune mesure la fréquentation de ses pages, elle le fait sans cookie et de façon anonyme : la page « Mesure d’audience » (/mesure-d-audience) détaille ce qui est collecté et permet de s’y opposer.',
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
        // Actualités, Agenda et Documents sont des liens fixes de Navigation :
        // les remettre ici les afficherait deux fois.
        items: [{ label: 'Vie municipale', page: vieMunicipale.docs[0]?.id }],
      },
      overrideAccess: true,
    })
  }

  // Valvert : un accueil minimal (preuve d’isolation des contenus). Pas de
  // bloc hero : le héros de l'accueil vient du gabarit.
  const valvertAccueil = await upsertPage(payload, {
    tenant: valvertId,
    titre: 'Accueil',
    slug: 'accueil',
    _status: 'published',
    blocs: [
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'Bienvenue à Valvert. Retrouvez ici les actualités et l’agenda de la commune.',
        ),
      },
    ],
  })

  // Valvert : page « Marché du samedi » — traduite en corse (démo multilingue).
  const valvertMarche = await upsertPage(payload, {
    tenant: valvertId,
    titre: 'Marché du samedi',
    slug: 'marche',
    _status: 'published',
    blocs: [
      { blockType: 'hero', titre: 'Marché du samedi' },
      {
        blockType: 'texteRiche',
        contenu: texteRich('Le marché se tient chaque samedi matin sur la place.'),
      },
    ],
  })

  // Valvert : page « Démarches » — jamais traduite (démo multilingue).
  const valvertDemarches = await upsertPage(payload, {
    tenant: valvertId,
    titre: 'Démarches',
    slug: 'demarches',
    _status: 'published',
    blocs: [
      { blockType: 'hero', titre: 'Démarches' },
      {
        blockType: 'texteRiche',
        contenu: texteRich('Pour toute démarche, adressez-vous à la mairie.'),
      },
    ],
  })

  // Corse (démo) — textes PROVISOIRES, à relire par un locuteur (spec § 10, point 1).
  // `titre` (champ page, non affiché — R1) reste non vide : `exigerTraductionComplete`
  // l'exige pour valider la traduction, au même titre que `blocs`.
  await traduire(payload, 'pages', valvertAccueil.id, {
    titre: 'Benvenuti à Valverde',
    blocs: [
      {
        blockType: 'texteRiche',
        contenu: texteRich(
          'Benvenuti à Valverde. Trovate quì e nutizie è l’agenda di u cumunu.',
        ),
      },
    ],
  })
  await traduire(payload, 'pages', valvertMarche.id, {
    titre: 'Mercatu di u sabbatu',
    blocs: [
      { blockType: 'hero', titre: 'Mercatu di u sabbatu' },
      {
        blockType: 'texteRiche',
        contenu: texteRich('U mercatu si tene ogni sabbatu matina nant’à a piazza.'),
      },
    ],
  })
  // `demarches` reste non traduite : aucun appel à `traduire` pour cette page.

  // Menu de Valvert : structure créée en français (R4), libellés traduits ensuite.
  const nbMenusValvert = await payload.count({
    collection: 'menus',
    where: { tenant: { equals: valvertId } },
  })
  const valvertMenu =
    nbMenusValvert.totalDocs === 0
      ? await payload.create({
          collection: 'menus',
          data: {
            tenant: valvertId,
            nom: 'Principal',
            items: [
              { label: 'Marché', page: valvertMarche.id },
              { label: 'Démarches', page: valvertDemarches.id },
            ],
          },
          overrideAccess: true,
        })
      : (
          await payload.find({
            collection: 'menus',
            where: { tenant: { equals: valvertId } },
            limit: 1,
            overrideAccess: true,
          })
        ).docs[0]

  // Corse (démo) — seul le premier libellé est traduit (« Mercatu »), les lignes
  // (mêmes id, mêmes pages) restent celles créées en français (R4). Texte
  // PROVISOIRE, à relire par un locuteur (spec § 10, point 1).
  const menuCoExistant = await payload.findByID({
    collection: 'menus',
    id: valvertMenu.id,
    locale: 'co',
    fallbackLocale: false,
    overrideAccess: true,
  })
  const items = (valvertMenu as { items?: Array<{ id?: string | null }> }).items ?? []
  const [itemMarche, itemDemarches] = items
  if (menuCoExistant?.items?.[0]?.label !== 'Mercatu' && itemMarche?.id && itemDemarches?.id) {
    await payload.update({
      collection: 'menus',
      id: valvertMenu.id,
      locale: 'co',
      data: {
        items: [
          { id: itemMarche.id, label: 'Mercatu', page: valvertMarche.id },
          { id: itemDemarches.id, page: valvertDemarches.id },
        ],
      },
      overrideAccess: true,
    })
  }
}
