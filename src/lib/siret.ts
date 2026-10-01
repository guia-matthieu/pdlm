/**
 * SIRET d'une organisation mandataire (spec RPNT section 8) : il préparera le
 * rattachement par ProConnect, qui identifie un agent par le SIRET de son
 * organisation. D5 : contrôle de format seulement.
 */
export function normaliserSiret(brut: string): string {
  return brut.replace(/\s+/g, '')
}

export function validerSiret(v: string | null | undefined): true | string {
  return typeof v === 'string' && /^\d{14}$/.test(normaliserSiret(v))
    ? true
    : 'Le SIRET compte 14 chiffres.'
}
