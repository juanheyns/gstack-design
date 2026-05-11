/**
 * Design-to-Code Prompt Generator.
 * Extracts implementation instructions from an approved mockup via Codex.
 * Produces a structured prompt the agent can use to implement the design.
 */

import { requireCodexAuth } from "./auth";
import { runCodexJson } from "./codex";
import { readDesignConstraints } from "./memory";
import { resolveLogPath } from "./project-dir";

export interface DesignToCodeResult {
  implementationPrompt: string;
  colors: string[];
  typography: string[];
  layout: string[];
  components: string[];
  logPath?: string;
}

const DESIGN_TO_CODE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    implementationPrompt: { type: "string" },
    colors: { type: "array", items: { type: "string" } },
    typography: { type: "array", items: { type: "string" } },
    layout: { type: "array", items: { type: "string" } },
    components: { type: "array", items: { type: "string" } },
  },
  required: ["implementationPrompt", "colors", "typography", "layout", "components"],
};

/**
 * Generate a structured implementation prompt from an approved mockup.
 */
export async function generateDesignToCodePrompt(
  imagePath: string,
  repoRoot?: string,
): Promise<DesignToCodeResult> {
  requireCodexAuth();
  const logPath = resolveLogPath("prompt");

  // Read DESIGN.md if available for additional context
  const designConstraints = repoRoot ? readDesignConstraints(repoRoot) : null;
  const contextBlock = designConstraints
    ? `\n\nExisting DESIGN.md constraints:\n${designConstraints}`
    : "";

  const result = await runCodexJson<DesignToCodeResult>({
    images: [imagePath],
    logPath,
    outputSchema: DESIGN_TO_CODE_SCHEMA,
    timeoutMs: 90_000,
    prompt: `Analyze the attached approved UI mockup and generate a structured implementation handoff as JSON only.

Be specific about visual details including exact hex colors, font sizes in px, spacing values, border-radius, shadows, layout structure, and visible components.
The developer should be able to implement the screen without looking at the mockup again.${contextBlock}`,
  });
  return { ...result, logPath };
}
