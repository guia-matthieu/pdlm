import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

import { CLE_TEST, EQUIPE_TEST } from './tests/helpers/fauxUmami'

/**
 * Port configurable : en local, 3000 est souvent déjà pris par un autre projet.
 * `reuseExistingServer` ne doit jamais être vrai en CI — sinon Playwright
 * attaque n'importe quel serveur qui écoute sur le port, y compris celui d'un
 * autre projet, et les tests valident alors une application étrangère.
 *
 * En local, si un `next dev` de ce dépôt tourne déjà, **Next 16 refuse d'en
 * démarrer un second pour le même répertoire** (« Another next dev server is
 * already running ») et Playwright échoue sur « Process from config.webServer
 * was not able to start ». Lancer alors la suite sur le port de ce serveur, pour
 * qu'elle le réutilise au lieu d'en créer un :
 *
 *     E2E_PORT=3001 npm run test:e2e
 *
 * En CI la question ne se pose pas : rien ne tourne, Playwright démarre le sien.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  /* Empêche un test.only oublié de réduire silencieusement la couverture en CI. */
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  /**
   * Un seul worker, partout : la suite attaque un unique serveur de
   * développement qui compile les routes à la demande. En parallèle, les
   * premières navigations se disputent ce compilateur et dépassent les délais —
   * des échecs qui ne disent rien de l'application.
   */
  workers: 1,
  /* Marge pour la compilation à la demande de la première visite d'une route. */
  timeout: 90_000,
  expect: { timeout: 10_000 },
  /* `open: 'never'` : le rapport HTML ne doit pas ouvrir un navigateur en CI. */
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  globalSetup: './tests/e2e/global-setup.ts',
  webServer: {
    // npm, comme le lockfile du dépôt : `pnpm` n'est pas installé ici.
    command: `npm run dev -- --port ${PORT}`,
    /*
     * Sonde de disponibilité indépendante des données. Viser `/` échouerait dès
     * que la racine ne renvoie pas 200 — commune non semée, DEFAULT_COMMUNE_SLUG
     * absent — et Playwright abandonnerait sur « Timed out waiting from
     * config.webServer », un message qui ne dit rien de la vraie cause.
     * /api/health répond 200 sans toucher la base.
     */
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: !process.env.CI,
    // Le premier rendu compile l'application à la demande.
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    // Mesure d'audience contre le faux Umami de global-setup.ts. Un serveur
    // réutilisé (reuseExistingServer, en local) ne reçoit PAS ces variables :
    // mesure.e2e.spec.ts se signale alors au lieu d'échouer sans explication.
    env: {
      UMAMI_URL: 'http://127.0.0.1:3998',
      UMAMI_API_KEY: CLE_TEST,
      UMAMI_TEAM_ID: EQUIPE_TEST,
      UMAMI_PUBLIC_URL: 'http://stats.localhost',
    },
  },
})
