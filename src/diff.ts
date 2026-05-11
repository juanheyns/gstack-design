/**
 * Visual diff between two mockups using Codex.
 * Identifies what changed between design iterations or between
 * an approved mockup and the live implementation.
 */

import { requireCodexAuth } from "./auth";
import { runCodexJson } from "./codex";
import { resolveLogPath } from "./project-dir";

export interface DiffResult {
  differences: { area: string; description: string; severity: string }[];
  summary: string;
  matchScore: number; // 0-100, how closely they match
  logPath?: string;
}

const DIFF_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    differences: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          area: { type: "string" },
          description: { type: "string" },
          severity: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["area", "description", "severity"],
      },
    },
    summary: { type: "string" },
    matchScore: { type: "number" },
  },
  required: ["differences", "summary", "matchScore"],
};

/**
 * Compare two images and describe the visual differences.
 */
export async function diffMockups(
  beforePath: string,
  afterPath: string,
): Promise<DiffResult> {
  requireCodexAuth();
  const logPath = resolveLogPath("diff");

  try {
    const result = await runCodexJson<DiffResult>({
      images: [beforePath, afterPath],
      logPath,
      outputSchema: DIFF_SCHEMA,
      timeoutMs: 90_000,
      prompt: [
        "Compare the two attached UI images.",
        "The first image is BEFORE or design intent. The second image is AFTER or actual implementation.",
        "Return JSON only.",
        "",
        "Rules:",
        "- `severity`: high means obvious to any user, medium means visible on inspection, low means minor or pixel-level.",
        "- `matchScore`: 100 means identical, 0 means completely different.",
        "- Focus on layout, typography, colors, spacing, and missing or extra elements.",
        "- Ignore anti-aliasing and other tiny rendering differences.",
      ].join("\n"),
    });
    return { ...result, logPath };
  } catch (error: any) {
    console.error(`Diff failed: ${error.message}`);
    return { differences: [], summary: "Diff unavailable", matchScore: -1, logPath };
  }
}

/**
 * Verify a live implementation against an approved design mockup.
 * Combines diff with a pass/fail gate.
 */
export async function verifyAgainstMockup(
  mockupPath: string,
  screenshotPath: string,
): Promise<{ pass: boolean; matchScore: number; diff: DiffResult }> {
  const diff = await diffMockups(mockupPath, screenshotPath);

  // Pass if matchScore >= 70 and no high-severity differences
  const highSeverity = diff.differences.filter(d => d.severity === "high");
  const pass = diff.matchScore >= 70 && highSeverity.length === 0;

  return { pass, matchScore: diff.matchScore, diff };
}
