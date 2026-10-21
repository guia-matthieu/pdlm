// Nomenclature des domaines internet des communes (RPNT § 2 et I35).
// Fonctions pures : aucune dépendance à Payload, aucun appel réseau. Elles
// proposent et signalent, elles ne bloquent jamais (aucun `validate` ici).

// geoTLD ANCT par département, clé en minuscules. À égalité de rang avec .fr.
const GEOTLD_PAR_DEPARTEMENT: Readonly<Record<string, string>> = {
  '22': 'bzh',
  '29': 'bzh',
  '35': 'bzh',
  '56': 'bzh',
  '44': 'bzh',
  '2a': 'corsica',
  '2b': 'corsica',
  '67': 'alsace',
  '68': 'alsace',
}

// Département lisible : 2-3 chiffres (97x pour l'outre-mer) ou 2A/2B (Corse).
const departementValide = (departement: string): boolean =>
  /^\d{2,3}$/.test(departement) || /^[12][ab]$/.test(departement)

/**
 * Transcrit un nom de commune en étiquette de domaine : minuscules, sans
 * accent, espaces/apostrophes/tirets réduits à un tiret unique, sans tiret de
 * bord. Rend `null` quand aucune écriture ASCII n'existe : on ne proposera
 * jamais de nom IDN (punycode).
 */
export function etiquetteDomaine(nom: string): string | null {
  const sansAccents = nom
    .trim()
    .toLowerCase()
    .normalize('NFD')
    // Seuls les accents combinants partent : œ ou ß ne se décomposent pas.
    .replace(/\p{M}/gu, '')
  const etiquette = sansAccents
    .replace(/[\s'’-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(etiquette) ? etiquette : null
}

/**
 * Formes recommandées par rang de préférence : `nom`, `mairie-nom`,
 * `ville-nom` en `.fr`, le geoTLD éventuel du département **à égalité** dans
 * le même rang (jamais après). La forme `nom<département>` ne vient qu'en
 * dernier, et seulement si la commune est homonyme d'une autre. Sans
 * département lisible : `.fr` seul et pas de forme homonyme.
 */
export function formesRecommandees(
  nom: string,
  codeDepartement: string | null,
  homonyme: boolean,
): string[][] {
  const etiquette = etiquetteDomaine(nom)
  if (!etiquette) return []

  const departement = (codeDepartement ?? '').trim().toLowerCase()
  const valide = departementValide(departement)
  const geoTLD = valide ? GEOTLD_PAR_DEPARTEMENT[departement] : undefined

  const rangs: string[][] = []
  for (const prefixe of ['', 'mairie-', 'ville-']) {
    const rang = [`${prefixe}${etiquette}.fr`]
    if (geoTLD) rang.push(`${prefixe}${etiquette}.${geoTLD}`)
    rangs.push(rang)
  }
  if (homonyme && valide) {
    // Nom+département : « saint-etienne42.fr ». Un département inconnu
    // donnerait une forme fausse, on ne la fabrique pas.
    const rang = [`${etiquette}${departement}.fr`]
    if (geoTLD) rang.push(`${etiquette}${departement}.${geoTLD}`)
    rangs.push(rang)
  }
  return rangs
}

/**
 * Département d'un code INSEE validé : 2 chiffres, `2A`/`2B` pour la Corse,
 * 3 chiffres pour l'outre-mer (`974`…). Rend `null` si le code est absent ou
 * illisible.
 */
export function departementDuCodeInsee(codeInsee: string | null | undefined): string | null {
  const code = (codeInsee ?? '').trim()
  if (/^\d{5}$/.test(code)) {
    return code.startsWith('97') ? code.slice(0, 3) : code.slice(0, 2)
  }
  if (/^[12][ABab]\d{3}$/.test(code)) {
    return code.slice(0, 2).toUpperCase()
  }
  return null
}
