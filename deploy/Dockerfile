# NanoOrch Enterprise — Hardened Docker Image
# Backend runs as V8 bytecode (not readable JavaScript).
# No TypeScript source is present in the final image.
#
# Build (from project root):
#   docker build -f deploy/Dockerfile -t nanoorch-enterprise .
#
# Run with Docker secrets (recommended — secrets never appear in `docker inspect`):
#   ./secrets/create-secrets.sh       # one-time secret file setup
#   docker compose -f deploy/docker-compose.enterprise-secrets.yml up -d
#
# Run standalone (secrets visible in `docker inspect` — dev/test only):
#   docker run -d \
#     -e DATABASE_URL=postgresql://user:pass@host/db \
#     -e SESSION_SECRET=your-secret \
#     -p 3000:3000 \
#     nanoorch-enterprise

# ── Stage 1: Production node_modules (bytenode included) ─────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --omit=dev \
 && npm install --no-save bytenode \
 && npm cache clean --force

# ── Stage 2: Build + V8 bytecode compilation ─────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci \
 && npm install --no-save bytenode
COPY . .

# Compile TypeScript + bundle with esbuild (existing build script)
RUN npm run build

# Compile bundles to V8 bytecode — same Node version as runner guarantees compatibility
RUN node -e " \
  const bytenode = require('bytenode'); \
  const path = require('path'); \
  bytenode.compileFile({ filename: path.resolve('dist/index.cjs'),   output: path.resolve('dist/server.jsc'),  electron: false }); \
  bytenode.compileFile({ filename: path.resolve('dist/migrate.cjs'), output: path.resolve('dist/migrate.jsc'), electron: false }); \
  console.log('Bytecode compiled: server.jsc + migrate.jsc'); \
"

# ── Stage 3: Production runner — bytecode only, zero source ──────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache dumb-init docker-cli git \
 && ARCH="$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
 && wget -qO /usr/local/bin/kubectl \
      "https://dl.k8s.io/release/$(wget -qO- https://dl.k8s.io/release/stable.txt)/bin/linux/${ARCH}/kubectl" \
 && chmod +x /usr/local/bin/kubectl

# Production node_modules (includes bytenode for the loader stubs)
COPY --from=base /app/node_modules ./node_modules

# Bytecode only — the .cjs source bundles are intentionally NOT copied
COPY --from=builder /app/dist/server.jsc  ./dist/server.jsc
COPY --from=builder /app/dist/migrate.jsc ./dist/migrate.jsc

# Frontend assets (already minified, no TypeScript)
COPY --from=builder /app/dist/public ./dist/public

# SQL migration files (needed at runtime for schema setup)
COPY --from=builder /app/migrations ./migrations

# package.json needed for module resolution metadata
COPY --from=builder /app/package.json ./package.json

# Tiny loader stubs — all they do is require('bytenode') then require('./*.jsc')
COPY deploy/loader.cjs         ./dist/loader.cjs
COPY deploy/migrate-loader.cjs ./dist/migrate-loader.cjs

# Entrypoint
COPY deploy/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV MIGRATIONS_DIR=/app/migrations

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--", "/entrypoint.sh"]
