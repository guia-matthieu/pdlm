import { RichText as RichTextLexical } from '@payloadcms/richtext-lexical/react'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/** Rendu du contenu riche Lexical (convertisseurs par défaut, styles sobres). */
export function RichText({ data }: { data: SerializedEditorState | null | undefined }) {
  if (!data) return null
  return (
    <div className="richtexte">
      <RichTextLexical data={data} />
    </div>
  )
}
