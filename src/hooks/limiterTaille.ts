import type { CollectionBeforeValidateHook } from 'payload'

/** I5 : limite de taille vérifiée sur le fichier réel (20 Mo par défaut). */
export const limiterTaille =
  (maxMo = 20): CollectionBeforeValidateHook =>
  ({ req }) => {
    const fichier = (req as { file?: { size?: number } }).file
    if (fichier?.size && fichier.size > maxMo * 1024 * 1024) {
      throw new Error(`Fichier trop volumineux : la limite est de ${maxMo} Mo.`)
    }
  }
