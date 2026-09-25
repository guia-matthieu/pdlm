import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  type JSXConverter,
  type JSXConvertersFunction,
  RichText as RichTextLexical,
} from '@payloadcms/richtext-lexical/react'

const identite = (chemin: string) => chemin

interface ChampsLien {
  url?: string | null
  newTab?: boolean | null
  linkType?: 'custom' | 'internal' | null
  doc?: { relationTo?: string; value?: unknown } | null
}

/**
 * Lien interne vers un document : seule une page peuplée (`value` objet avec
 * `slug`) a une adresse connue — `/<slug>`, l'accueil étant `/`. Un document
 * non peuplé (id seul, lecture en depth 0) ou d'une autre collection garde
 * le repli `#` du convertisseur par défaut.
 */
function adresseDocument(doc: ChampsLien['doc']): string {
  const valeur = doc?.value as { slug?: unknown } | null | undefined
  if (doc?.relationTo !== 'pages' || typeof valeur?.slug !== 'string') return '#'
  return valeur.slug === 'accueil' ? '/' : `/${valeur.slug}`
}

/**
 * Rendu du contenu riche Lexical (convertisseurs par défaut, styles sobres).
 * Les liens (R9, spec § 3) passent par `lien` — cheminLangue côté appelant :
 * un lien interne garde la langue affichée, une URL externe, `mailto:`,
 * `tel:` ou `#ancre` reste intacte. rel/target du convertisseur par défaut
 * conservés.
 */
export function RichText({
  data,
  lien = identite,
}: {
  data: SerializedEditorState | null | undefined
  lien?: (chemin: string) => string
}) {
  if (!data) return null
  const convertirLien: JSXConverter = ({ node, nodesToJSX }) => {
    const champs = ((node as { fields?: ChampsLien }).fields ?? {}) as ChampsLien
    const href = champs.linkType === 'internal' ? adresseDocument(champs.doc) : (champs.url ?? '')
    return (
      <a
        href={lien(href)}
        rel={champs.newTab ? 'noopener noreferrer' : undefined}
        target={champs.newTab ? '_blank' : undefined}
      >
        {nodesToJSX({ nodes: (node as { children?: never[] }).children ?? [] })}
      </a>
    )
  }
  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    link: convertirLien,
    autolink: convertirLien,
  })
  return (
    <div className="richtexte">
      <RichTextLexical data={data} converters={converters} />
    </div>
  )
}
