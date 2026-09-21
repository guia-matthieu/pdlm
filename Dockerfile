# pdlm — image de production (Next.js standalone) + image de migration (CLI payload complet)
#
# Deux cibles :
#   - runner (défaut)  : serveur Next standalone, utilisateur non-root
#   - migrator         : CLI payload + config + migrations (docker compose --build target)

FROM node:22.17.0-alpine AS base
# Correctifs de sécurité Alpine publiés après le pin de l'image de base
# (libcrypto3/libssl3/musl/zlib) — sans ça, Trivy relève des CVE HIGH/CRITICAL
# déjà corrigées en amont (I13). Le pin `22.17.0` reste fixe : seuls les
# paquets système sont mis à niveau, pas la version de Node.
RUN apk update && apk upgrade --no-cache && apk add --no-cache libc6-compat

# — Dépendances (npm ci depuis le lockfile) —
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci

# — Migrator : sources + node_modules complets (pas de build Next nécessaire) —
FROM base AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json vitest.config.mts ./
COPY src ./src
# node_modules/.bin/payload est un script Node pur (pas un binaire natif) :
# l'invoquer directement via `node` évite `npx`, donc le CLI npm global de
# l'image de base — même correctif que le runner (I13).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
CMD ["node", "node_modules/payload/bin.js", "migrate"]

# — Build de l'application —
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# — Runner : image finale, utilisateur non-root —
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Le serveur standalone ne lance jamais npm/npx (CMD ci-dessous) — retirer le
# CLI npm embarqué par l'image Node officielle retire au passage ses propres
# dépendances vendorisées (tar, minimatch, pacote, sigstore…), qui remontaient
# en HIGH/CRITICAL au scan Trivy sans jamais être exécutées en production.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
