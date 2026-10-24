# API do Nobre CRM. Build a partir da raiz do monorepo: docker build -f apps/api/Dockerfile .
FROM node:24-alpine AS base
RUN npm install -g pnpm@11.5.0 --silent
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/domain/package.json packages/domain/
COPY packages/contracts/package.json packages/contracts/
# o postinstall (prisma generate) precisa do schema e da config
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/

# Compila: dist/server.js e dist/seed.js com domínio, contrato e client do Prisma embutidos
FROM base AS build
RUN pnpm install --frozen-lockfile --filter api...
COPY packages/domain packages/domain
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN pnpm --filter api exec prisma generate && pnpm --filter api build

# Só as dependências de produção (Fastify, Prisma client e CLI para o migrate deploy, pg, zod...)
FROM base AS deps
RUN pnpm install --frozen-lockfile --prod --filter api... && pnpm store prune

# Imagem final: dist/, schema e migrations, package.json e node_modules de produção. Sem src/, test/,
# tsx nem os pacotes do workspace (já estão no bundle).
FROM node:24-alpine AS runtime
ENV NODE_ENV=production PRISMA_HIDE_UPDATE_MESSAGE=1
WORKDIR /app/apps/api
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/api/node_modules ./node_modules
COPY apps/api/package.json apps/api/prisma.config.ts ./
COPY apps/api/prisma/schema.prisma ./prisma/schema.prisma
COPY apps/api/prisma/migrations ./prisma/migrations
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 3333
# migrations + seed idempotente + servidor (o compose usa o mesmo comando)
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/seed.js && node dist/server.js"]
