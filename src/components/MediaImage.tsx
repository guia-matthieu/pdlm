import type { CodeLangue } from '@/lib/langues'
import type { Media } from '@/payload-types'

/** Image publique (v0.1 : img simple — l'optimisation next/image viendra avec remotePatterns). */
export function MediaImage({
  media,
  taille = 'card',
  className,
  prioritaires = false,
  langueAffichee,
}: {
  media: Media | null | undefined
  taille?: 'thumbnail' | 'card' | 'hero'
  className?: string
  prioritaires?: boolean
  /** Langue de la page : si l'alt montré est dans une autre langue (repli), il est marqué `lang`. */
  langueAffichee?: CodeLangue
}) {
  if (!media?.url) return null
  const src = media.sizes?.[taille]?.url || media.url
  const alt = media.alt || ''
  const langueAlt =
    'langueAlt' in media ? (media as { langueAlt: CodeLangue }).langueAlt : undefined
  return (
    // eslint-disable-next-line @next/next/no-img-element -- voulu en v0.1 (cf. doc ci-dessus) : next/image attend les remotePatterns
    <img
      src={src}
      alt={alt}
      lang={langueAffichee && langueAlt && langueAlt !== langueAffichee ? langueAlt : undefined}
      className={className}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={prioritaires ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}
