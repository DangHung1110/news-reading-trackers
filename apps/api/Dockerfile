FROM node:22-alpine AS builder

RUN apk add --no-cache openssl \
  && corepack enable \
  && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/validation/package.json packages/validation/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/api apps/api
COPY packages packages
RUN pnpm --filter @news-tracker/contracts build \
  && pnpm --filter @news-tracker/validation build \
  && pnpm --filter api build \
  && pnpm --filter api deploy --prod --legacy /prod/api
RUN generated_client_dir="$(find /app/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' -print -quit)" \
  && runtime_client_dir="$(find /prod/api/node_modules/.pnpm -type d -path '*/node_modules/.prisma/client' -print -quit)" \
  && test -n "$generated_client_dir" \
  && test -n "$runtime_client_dir" \
  && cp -a "$generated_client_dir/." "$runtime_client_dir/"

FROM node:22-alpine AS runner

RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3000

COPY --from=builder /prod/api ./

EXPOSE 3000
CMD ["node", "dist/main.js"]
