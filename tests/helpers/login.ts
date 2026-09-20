import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface Identifiants {
  email: string
  motDePasse: string
}

/**
 * Connexion à l'admin Payload par le formulaire réel — jamais par injection de
 * cookie : c'est la chaîne complète (proxy, session, accès) qui doit être
 * éprouvée.
 *
 * Le formulaire de connexion initialise son état de façon asynchrone et
 * réinitialise ses champs à la fin de ce cycle (mesuré ~2 s sur le serveur de
 * développement). Une valeur saisie avant cette remise à zéro est effacée — DOM
 * et état React compris — et la connexion part vide : Payload répond alors 400
 * « Ce champ est requis » sur email. Aucune vérification du DOM ne révèle la
 * course, puisque la valeur est bien présente au moment où on l'observe. D'où
 * l'attente de fin des requêtes avant toute saisie.
 *
 * La reprise englobe la connexion entière : une soumission vide est une erreur
 * de validation, pas un échec d'identifiants, elle ne consomme donc pas le
 * quota `maxLoginAttempts` de la collection Users.
 */
export async function connecterAdmin(page: Page, { email, motDePasse }: Identifiants) {
  await expect(async () => {
    await page.goto('/admin/login')
    await page.waitForLoadState('networkidle')

    await page.locator('#field-email').fill(email)
    await page.locator('#field-password').fill(motDePasse)

    // Libellé français : confirme au passage que l'admin est bien en i18n fr.
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Un motif comme /\/admin\/?$/ accepterait aussi /admin/login : on exige le
    // chemin exact, sinon un échec de connexion passerait pour un succès.
    await page.waitForURL((url) => url.pathname === '/admin', { timeout: 20_000 })
  }).toPass({ timeout: 120_000 })

  await expect(page.locator('#field-password')).toHaveCount(0)
}
