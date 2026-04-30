import { storage } from "../storage";
import { decrypt } from "./encryption";
import { loadSecret } from "./secrets";

const ENV_MAP: Record<string, string> = {
  openai:    "AI_INTEGRATIONS_OPENAI_API_KEY",
  anthropic: "AI_INTEGRATIONS_ANTHROPIC_API_KEY",
  gemini:    "AI_INTEGRATIONS_GEMINI_API_KEY",
};

/**
 * Resolve the best available API key for a given provider + workspace.
 *
 * Priority:
 *   1. Workspace-level key  — stored encrypted in the DB by a workspace admin via the NanoOrch UI
 *   2. Platform-level key   — stored encrypted in the DB by a superadmin via the NanoOrch UI
 *   3. Environment variable — Replit secret / docker-compose env (last resort)
 *
 * Returns null only when no key exists anywhere for this provider.
 * The AI provider modules (openai.ts, anthropic.ts, gemini.ts) add their own
 * env-var fallback via `apiKey ?? loadSecret(...)`, so passing null is safe —
 * the provider will still try the env var.  This function explicitly reads the env
 * var so callers that need the actual key value (e.g. embeddings, title generator)
 * get it directly.
 */
export async function resolveProviderKey(
  provider: string,
  workspaceId: string | null | undefined,
): Promise<string | null> {
  // 1. Workspace-level key
  if (workspaceId) {
    const wsKey = await storage.getProviderKey(workspaceId, provider);
    if (wsKey) {
      try { return decrypt(wsKey.encryptedKey); } catch { /* fall through */ }
    }
  }

  // 2. Platform-level key
  const platformKey = await storage.getProviderKey(null, provider);
  if (platformKey) {
    try { return decrypt(platformKey.encryptedKey); } catch { /* fall through */ }
  }

  // 3. Environment variable fallback
  const envVar = ENV_MAP[provider];
  return envVar ? (loadSecret(envVar) ?? null) : null;
}
