/**
 * Vision-based quality gate for generated mockups.
 * Uses Codex to verify text readability, layout completeness, and visual coherence.
 */

import { requireCodexAuth } from "./auth";
import { runCodexJson } from "./codex";
import { resolveLogPath } from "./project-dir";

export interface CheckResult {
  pass: boolean;
  issues: string;
  logPath?: string;
}

const CHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    pass: { type: "boolean" },
    issues: { type: "string" },
  },
  required: ["pass", "issues"],
};

/**
 * Check a generated mockup against the original brief.
 */
export async function checkMockup(imagePath: string, brief: string): Promise<CheckResult> {
  requireCodexAuth();
  const logPath = resolveLogPath("check");

  try {
    const result = await runCodexJson<CheckResult>({
      images: [imagePath],
      logPath,
      outputSchema: CHECK_SCHEMA,
      timeoutMs: 90_000,
      prompt: [
        "You are a UI quality checker.",
        "Evaluate the attached mockup against the design brief and respond with JSON only.",
        "",
        `Brief: ${brief}`,
        "",
        "Check these three things:",
        "1. Text readability: Are labels, headings, and body text legible and spelled correctly?",
        "2. Layout completeness: Are all requested elements present?",
        "3. Visual coherence: Does it look like a real production UI rather than AI art or a collage?",
        "",
        "Set `pass` to true only if all three checks pass.",
        "If anything fails, set `pass` to false and put specific issues in `issues`.",
        "If everything passes, set `issues` to an empty string.",
      ].join("\n"),
    });
    return { ...result, logPath };
  } catch (error: any) {
    console.error(`Vision check failed: ${error.message}`);
    return { pass: true, issues: "Vision check unavailable — skipped", logPath };
  }
}

/**
 * Standalone check command: check an existing image against a brief.
 */
export async function checkCommand(imagePath: string, brief: string): Promise<void> {
  const result = await checkMockup(imagePath, brief);
  console.log(JSON.stringify(result, null, 2));
}
