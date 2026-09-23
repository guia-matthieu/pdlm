import { demarrerFauxUmami } from '../helpers/fauxUmami'

/** Faux Umami sur un port fixe, celui que le serveur de développement reçoit dans UMAMI_URL. */
export const PORT_FAUX_UMAMI = 3998

export default async function globalSetup() {
  const umami = await demarrerFauxUmami(PORT_FAUX_UMAMI)
  return async () => {
    await umami.fermer()
  }
}
