/**
 * Auth resolution for OpenAI API access.
 *
 * Resolution order:
 * 1. ~/.config/design/config.json → { "api_key": "sk-..." }
 * 2. ~/.gstack/openai.json (backward-compat fallback for existing gstack users)
 * 3. OPENAI_API_KEY environment variable
 * 4. null (caller handles guided setup or fallback)
 */

import fs from "fs";
import path from "path";

const CONFIG_DIR = process.env.DESIGN_HOME
  || path.join(process.env.HOME || "~", ".config", "design");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export function resolveApiKey(): string | null {
  // 1. Check ~/.config/design/config.json
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const content = fs.readFileSync(CONFIG_PATH, "utf-8");
      const config = JSON.parse(content);
      if (config.api_key && typeof config.api_key === "string") {
        return config.api_key;
      }
    }
  } catch {
    // Fall through
  }

  // 2. Fallback: check gstack config (for users migrating from gstack)
  const GSTACK_CONFIG = path.join(process.env.HOME || "~", ".gstack", "openai.json");
  try {
    if (fs.existsSync(GSTACK_CONFIG)) {
      const content = fs.readFileSync(GSTACK_CONFIG, "utf-8");
      const config = JSON.parse(content);
      if (config.api_key && typeof config.api_key === "string") {
        return config.api_key;
      }
    }
  } catch {
    // Fall through to env var
  }

  // 3. Check environment variable
  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  return null;
}

/**
 * Save an API key to ~/.config/design/config.json with 0600 permissions.
 */
export function saveApiKey(key: string): void {
  const dir = path.dirname(CONFIG_PATH);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ api_key: key }, null, 2));
  fs.chmodSync(CONFIG_PATH, 0o600);
}

/**
 * Get API key or exit with setup instructions.
 */
export function requireApiKey(): string {
  const key = resolveApiKey();
  if (!key) {
    console.error("No OpenAI API key found.");
    console.error("");
    console.error("Run: design setup");
    console.error("  or save to ~/.config/design/config.json: { \"api_key\": \"sk-...\" }");
    console.error("  or set OPENAI_API_KEY environment variable");
    console.error("");
    console.error("Get a key at: https://platform.openai.com/api-keys");
    process.exit(1);
  }
  return key;
}
