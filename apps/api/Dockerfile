# API do Nobre CRM. Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0 --silent
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
# o postinstall (prisma generate) precisa do schema e da config
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

# Dependências completas para compilar
FROM base AS build
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/domain packages/domain
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build

# Só dependências de produção (inclui prisma CLI e tsx, usados por migrate deploy e seed no start)
FROM base AS runtime
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
RUN pnpm install --frozen-lockfile --prod --filter api... && pnpm store prune
COPY packages/domain packages/domain
COPY apps/api apps/api
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/src/generated apps/api/src/generated
WORKDIR /app/apps/api
USER node
EXPOSE 3333
# migrations + seed idempotente + servidor (o compose pode sobrescrever)
CMD ["sh", "-c", "pnpm prisma migrate deploy && pnpm prisma db seed && pnpm start"]
