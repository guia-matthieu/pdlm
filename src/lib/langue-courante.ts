import 'server-only'

import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'

import { dictionnaire, type Dictionnaire } from '../i18n'
import { cheminSansPrefixe, choisirLangue } from './adresses'
import { resolveSite, type Site } from './commune'
import { type CodeLangue } from './langues'
import { languesDuSite } from './langues-site'

export { languesDuSite }

export interface ContexteLangue {
  site: Site
  langue: CodeLangue
  languesSite: CodeLangue[]
  t: Dictionnaire
  /** Chemin demandé sans préfixe de langue, requête comprise (sélecteur de langue). */
  chemin: string
}

/**
 * Contexte de langue d'une requête (spec § 3) : mémoïsé par requête, partagé
 * par le layout de [lang], ses pages et leurs generateMetadata. Lève 404
 * (langue non activée, I14) ou 308 (préfixe égal à la langue du domaine).
 */
export const contexteLangue = cache(async (param: string): Promise<ContexteLangue | null> => {
  const site = await resolveSite()
  if (!site) return null
  const languesSite = languesDuSite(site.commune)
  const cheminDemande = (await headers()).get('x-pdlm-chemin') ?? '/'
  const decision = choisirLangue({ param, langueRacine: site.langueRacine, languesSite, cheminDemande })
  if (decision.type === 'introuvable') notFound()
  if (decision.type === 'rediriger') permanentRedirect(decision.vers)
  return {
    site,
    langue: decision.langue,
    languesSite,
    t: dictionnaire(decision.langue),
    chemin: cheminSansPrefixe(cheminDemande).reste,
  }
})
