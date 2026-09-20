import type { Media } from '@/payload-types'

/** Image publique (v0.1 : img simple — l'optimisation next/image viendra avec remotePatterns). */
export function MediaImage({
  media,
  taille = 'card',
  className,
  prioritaires = false,
}: {
  media: Media | null | undefined
  taille?: 'thumbnail' | 'card' | 'hero'
  className?: string
  prioritaires?: boolean
}) {
  if (!media?.url) return null
  const src = media.sizes?.[taille]?.url || media.url
  const alt = media.alt || ''
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={media.width ?? undefined}
      height={media.height ?? undefined}
      loading={prioritaires ? 'eager' : 'lazy'}
      decoding="async"
    />
  )
}
