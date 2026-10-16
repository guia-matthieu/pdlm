/**
 * Courriel de la commune : un seul lien `mailto:` portant l'adresse entière,
 * découpé pour ne se replier qu'après l'arobase — chaque partie est
 * insécable (règle `.courriel span` de styles.css), le `<wbr>` est la seule
 * occasion de coupure. Rend null sans adresse : le champ est `email?`, une
 * commune peut avoir un téléphone sans courriel.
 */
export function Courriel({
  adresse,
  className,
}: {
  adresse: string | null | undefined
  className?: string
}) {
  if (!adresse) return null
  // Champ de type email : l'arobase est garantie par la validation Payload.
  const arobase = adresse.lastIndexOf('@')
  return (
    <a className={className ? `courriel ${className}` : 'courriel'} href={`mailto:${adresse}`}>
      <span>{adresse.slice(0, arobase + 1)}</span>
      <wbr />
      <span>{adresse.slice(arobase + 1)}</span>
    </a>
  )
}
