/** Une heure : « 9 h », « 9h », « 9 h 30 » — le « h » seul (jamais
 *  « heures »), minutes optionnelles, espaces sécables ou déjà insécables. */
const HEURE = /\d+[ \u00A0]?h\b(?:[ \u00A0]?\d{1,2}(?!\d))?/

/** Une plage : deux heures autour d'un tiret (court, long ou trait
 *  d'union), les espaces autour du tiret étant optionnels. */
const PLAGE = new RegExp(`${HEURE.source}[ \u00A0]?[–—-][ \u00A0]?${HEURE.source}`, 'g')

/**
 * À l'affichage seulement — la donnée enregistrée ne bouge pas —, une plage
 * horaire ne se coupe plus en deux : dans chaque plage « nombre + h +
 * tiret + nombre + h », les espaces internes deviennent insécables, entre
 * le nombre et le « h » comme autour du tiret. L'insécable ne referme
 * qu'une des deux coutures du tiret : après un tiret, la coupure devant une
 * insécable reste permise (UAX #14, règle LB12a), d'où le lieur de mots
 * (U+2060) posé après le tiret. Une plage sans espace interne (« 9h-12h »)
 * n'a rien à protéger et ressort inchangée.
 */
export function horairesInsecables(texte: string): string {
  return texte.replace(PLAGE, (plage) =>
    plage.replace(/ /g, '\u00A0').replace(/([–—-])\u00A0/g, '$1\u2060\u00A0'),
  )
}
