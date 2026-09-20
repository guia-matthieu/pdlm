# pdlm — image de production (Next.js standalone) + image de migration (CLI payload complet)
#
# Deux cibles :
#   - runner (défaut)  : serveur Next standalone, utilisateur non-root
#   - migrator         : CLI payload + config + migrations (docker compose --build target)

FROM node:22.17.0-alpine AS base
RUN apk add --no-cache libc6-compat

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
CMD ["npx", "payload", "migrate"]

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

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
RUN mkdir .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
