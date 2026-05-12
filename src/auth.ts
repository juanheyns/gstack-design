/**
 * Auth + provider config resolution.
 *
 * Config file: ~/.config/design/config.json
 *   {
 *     "provider": "openai" | "gemini",
 *     "api_key": "...",
 *     "models": { "image": "...", "vision": "..." }
 *   }
 *
 * Resolution order:
 *   1. ~/.config/design/config.json
 *   2. ~/.gstack/openai.json (legacy gstack location — openai only)
 *   3. Env vars: GEMINI_API_KEY, OPENAI_API_KEY (DESIGN_PROVIDER picks one when both set)
 *   4. null
 */

import fs from "fs";
import path from "path";

export type ProviderName = "openai" | "gemini";

export interface ProviderConfig {
  provider: ProviderName;
  apiKey: string;
  models?: {
    image?: string;
    vision?: string;
  };
}

function configDir(): string {
  return process.env.DESIGN_HOME
    || path.join(process.env.HOME || "~", ".config", "design");
}

function configPath(): string {
  return path.join(configDir(), "config.json");
}

function readConfigFile(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function fromEnv(): ProviderConfig | null {
  const forced = process.env.DESIGN_PROVIDER?.toLowerCase() as ProviderName | undefined;
  const openaiKey = process.env.OPENAI_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (forced === "gemini" && geminiKey) return { provider: "gemini", apiKey: geminiKey };
  if (forced === "openai" && openaiKey) return { provider: "openai", apiKey: openaiKey };

  // No forced choice: prefer whichever single key is present
  if (geminiKey && !openaiKey) return { provider: "gemini", apiKey: geminiKey };
  if (openaiKey) return { provider: "openai", apiKey: openaiKey };
  if (geminiKey) return { provider: "gemini", apiKey: geminiKey };
  return null;
}

function parseConfig(raw: any): ProviderConfig | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.api_key !== "string" || !raw.api_key) return null;

  const provider: ProviderName = raw.provider === "gemini" ? "gemini" : "openai";
  const cfg: ProviderConfig = { provider, apiKey: raw.api_key };
  if (raw.models && typeof raw.models === "object") {
    cfg.models = {
      image: typeof raw.models.image === "string" ? raw.models.image : undefined,
      vision: typeof raw.models.vision === "string" ? raw.models.vision : undefined,
    };
  }
  return cfg;
}

/**
 * Resolve the full provider config: which provider, the API key, and any
 * model overrides.
 */
export function resolveProviderConfig(): ProviderConfig | null {
  // 1. Primary config
  const primary = parseConfig(readConfigFile(configPath()));
  if (primary) return primary;

  // 2. Legacy gstack fallback (openai only)
  const legacyPath = path.join(process.env.HOME || "~", ".gstack", "openai.json");
  const legacy = parseConfig(readConfigFile(legacyPath));
  if (legacy) return legacy;

  // 3. Env vars
  return fromEnv();
}

/**
 * Legacy: return just the API key string. Used by older code paths that
 * haven't been migrated to provider-aware calls yet.
 */
export function resolveApiKey(): string | null {
  return resolveProviderConfig()?.apiKey ?? null;
}

/**
 * Save a config to disk with 0600 permissions.
 */
export function saveConfig(config: ProviderConfig): void {
  const dir = path.dirname(configPath());
  fs.mkdirSync(dir, { recursive: true });
  const payload: any = {
    provider: config.provider,
    api_key: config.apiKey,
  };
  if (config.models) payload.models = config.models;
  fs.writeFileSync(configPath(), JSON.stringify(payload, null, 2));
  fs.chmodSync(configPath(), 0o600);
}

/**
 * Legacy single-key save (defaults provider to openai).
 */
export function saveApiKey(key: string): void {
  saveConfig({ provider: "openai", apiKey: key });
}

/**
 * Get the full provider config or exit with setup instructions.
 */
export function requireProviderConfig(): ProviderConfig {
  const config = resolveProviderConfig();
  if (!config) {
    console.error("No API key found for any supported provider.");
    console.error("");
    console.error("Run: design setup");
    console.error("  or save to ~/.config/design/config.json:");
    console.error("    OpenAI: { \"provider\": \"openai\", \"api_key\": \"sk-...\" }");
    console.error("    Gemini: { \"provider\": \"gemini\", \"api_key\": \"AIza...\" }");
    console.error("  or set OPENAI_API_KEY / GEMINI_API_KEY env var");
    console.error("");
    console.error("Get a key at:");
    console.error("  OpenAI: https://platform.openai.com/api-keys");
    console.error("  Gemini: https://aistudio.google.com/apikey");
    process.exit(1);
  }
  return config;
}

/**
 * Legacy: return just the API key, exiting if missing.
 */
export function requireApiKey(): string {
  return requireProviderConfig().apiKey;
}
