FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/web apps/web
COPY packages packages

ARG NEXT_PUBLIC_API_URL=http://localhost:3000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm --filter @news-tracker/contracts build \
  && pnpm --filter web build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers ./node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers

EXPOSE 3001
CMD ["node", "apps/web/server.js"]
