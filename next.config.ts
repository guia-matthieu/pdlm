import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

/**
 * Matrice d'en-têtes de sécurité (I13, plan « passe 4 ») — appliquée à toutes
 * les réponses (front public, admin, API) : rien dans ce projet ne dépend
 * d'être chargé en iframe, ni de charger un script/style/police tiers.
 *
 * CSP volontairement avec 'unsafe-inline' sur script-src/style-src : React,
 * Next.js (hydratation) et l'éditeur Lexical de l'admin Payload en dépendent
 * en v0.1 ; un CSP par nonce est confirmé v0.2+ dans le plan. `unsafe-eval`
 * ajouté SEULEMENT hors production (même bascule que `DEV` dans
 * payload.config.ts) : React s'en sert en développement pour reconstruire
 * les piles d'appel du hot-reload et ne l'utilise jamais en production
 * (message d'erreur Next.js explicite, vérifié en recette J9) — l'exclure
 * en production resserre la CSP sans rien casser. Absence délibérée de
 * Strict-Transport-Security ici : HSTS n'a de sens que servi sur une
 * connexion déjà HTTPS — porté par Caddy en production, jamais par l'app
 * elle-même qui ne sait pas si elle est derrière TLS.
 *
 * Cross-Origin-Embedder-Policy/-Opener-Policy (I13, recette ZAP J9) : aucune
 * ressource cross-origin nulle part dans le projet (pas de police/CDN/iframe
 * tiers — vérifié par grep avant ajout), donc require-corp/same-origin ne
 * cassent rien aujourd'hui. À revoir si un widget tiers (carte, etc.) est
 * ajouté plus tard.
 */
const DEV = process.env.NODE_ENV !== 'production'
const enTetesSecurite = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${DEV ? " 'unsafe-eval'" : ''}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  // Ne pas annoncer le framework et sa version à un attaquant en reconnaissance.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/(.*)', headers: enTetesSecurite }]
  },
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
