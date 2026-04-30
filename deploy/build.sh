#!/usr/bin/env bash
# NanoOrch Enterprise — local bytecode build
# Produces deploy/dist/ with V8 bytecode instead of readable JavaScript.
#
# Usage (run from project root):
#   chmod +x deploy/build.sh && ./deploy/build.sh
#
# Test without Docker:
#   DATABASE_URL=... SESSION_SECRET=... node deploy/dist/migrate-loader.cjs
#   DATABASE_URL=... SESSION_SECRET=... node deploy/dist/loader.cjs
#
# Build Docker image (after running this script):
#   docker build -f deploy/Dockerfile -t nanoorch-enterprise .

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║   NanoOrch Enterprise Build              ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── Step 1: Standard build (esbuild + vite) ──────────────────────────────────
echo "[1/4] Running standard build (esbuild + vite)..."
npm run build
echo "      → dist/index.cjs, dist/migrate.cjs, dist/public/"
echo ""

# ── Step 2: Verify bytenode is available ─────────────────────────────────────
echo "[2/4] Checking bytenode..."
if ! node -e "require('bytenode')" 2>/dev/null; then
  echo "      Installing bytenode..."
  npm install bytenode --no-save
fi
echo "      → bytenode OK"
echo ""

# ── Step 3: Compile to V8 bytecode ───────────────────────────────────────────
echo "[3/4] Compiling to V8 bytecode..."
mkdir -p deploy/dist
node -e "
const bytenode = require('bytenode');
const path = require('path');

bytenode.compileFile({
  filename: path.resolve('dist/index.cjs'),
  output:   path.resolve('deploy/dist/server.jsc'),
  electron: false,
});
console.log('      → deploy/dist/server.jsc');

bytenode.compileFile({
  filename: path.resolve('dist/migrate.cjs'),
  output:   path.resolve('deploy/dist/migrate.jsc'),
  electron: false,
});
console.log('      → deploy/dist/migrate.jsc');
"
echo ""

# ── Step 4: Copy frontend assets and loader stubs ────────────────────────────
echo "[4/4] Copying frontend assets and loader stubs..."
rm -rf deploy/dist/public
cp -r dist/public deploy/dist/public
cp deploy/loader.cjs         deploy/dist/loader.cjs
cp deploy/migrate-loader.cjs deploy/dist/migrate-loader.cjs
echo "      → deploy/dist/public/"
echo "      → deploy/dist/loader.cjs"
echo "      → deploy/dist/migrate-loader.cjs"
echo ""

# ── Summary ───────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════╗"
echo "║   Build complete!  deploy/dist/          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "  server.jsc        — server V8 bytecode (unreadable)"
echo "  migrate.jsc       — migration V8 bytecode (unreadable)"
echo "  loader.cjs         — server entry stub"
echo "  migrate-loader.cjs — migration entry stub"
echo "  public/            — minified frontend assets"
echo ""
echo "Test locally:"
echo "  DATABASE_URL=... SESSION_SECRET=... node deploy/dist/migrate-loader.cjs"
echo "  DATABASE_URL=... SESSION_SECRET=... node deploy/dist/loader.cjs"
echo ""
echo "Build Docker image:"
echo "  docker build -f deploy/Dockerfile -t nanoorch-enterprise ."
echo ""
