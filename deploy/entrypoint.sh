#!/bin/sh
set -e

# ── _FILE secret loader ────────────────────────────────────────────────────────
#
# Reads a plain-text file whose path is given by ${VAR_NAME}_FILE and exports
# the value as the plain ${VAR_NAME} env var.
#
# Why needed:
#   • Some libraries (drizzle-orm, pg, express-session) read environment
#     variables directly — they are unaware of the _FILE convention.
#   • Docker secrets are mounted read-only at /run/secrets/<name>.
#   • `docker inspect` only shows the _FILE path — the real value stays hidden.
#
# The Node app also calls loadSecret() from server/lib/secrets.ts which applies
# the same pattern for all app-level secrets.  This shell layer covers the
# libraries that bypass loadSecret().
# ──────────────────────────────────────────────────────────────────────────────
load_secret() {
  var_name="$1"
  file_var="${var_name}_FILE"
  # eval is POSIX sh — no bashism needed
  eval file_path=\$$file_var
  if [ -n "$file_path" ] && [ -f "$file_path" ]; then
    val=$(cat "$file_path")
    export "$var_name=$val"
  fi
}

# ── Secrets that libraries read directly (must be exported at the shell level) ─
load_secret DATABASE_URL        # drizzle / pg driver reads this directly
load_secret SESSION_SECRET      # express-session reads process.env.SESSION_SECRET
load_secret ADMIN_PASSWORD      # seed script reads this directly
load_secret ENCRYPTION_KEY

# ── AI provider keys — also covered by app-level loadSecret() ─────────────────
load_secret AI_INTEGRATIONS_OPENAI_API_KEY
load_secret AI_INTEGRATIONS_ANTHROPIC_API_KEY
load_secret AI_INTEGRATIONS_GEMINI_API_KEY

echo "[NanoOrch Enterprise] Running database migrations..."
node /app/dist/migrate-loader.cjs

echo "[NanoOrch Enterprise] Starting server..."
exec node /app/dist/loader.cjs
