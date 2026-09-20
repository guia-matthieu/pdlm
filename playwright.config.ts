import { defineConfig, devices } from '@playwright/test'
import 'dotenv/config'

/**
 * Port configurable : en local, 3000 est souvent déjà pris par un autre projet.
 * `reuseExistingServer` ne doit jamais être vrai en CI — sinon Playwright
 * attaque n'importe quel serveur qui écoute sur le port, y compris celui d'un
 * autre projet, et les tests valident alors une application étrangère.
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
  },
})
