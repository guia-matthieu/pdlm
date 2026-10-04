/**
 * Une ValidationError de Payload n'a dans `message` que les noms des champs ;
 * les textes d'erreur sont dans `data.errors`. On les recolle au message pour
 * pouvoir écrire `await expect(refus(promesse)).rejects.toThrow(/texte/)`.
 */
export function refus<T>(promesse: Promise<T>): Promise<T> {
  return promesse.catch(
    (e: { message?: string; data?: { errors?: Array<{ message?: string }> } }) => {
      throw new Error(
        [e.message ?? '', ...(e.data?.errors ?? []).map((x) => x.message ?? '')].join(' | '),
      )
    },
  )
}
