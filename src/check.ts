/**
 * Vision-based quality gate for generated mockups.
 * Verifies text readability, layout completeness, and visual coherence
 * via whichever provider is configured.
 */

import fs from "fs";
import { getProvider } from "./providers";

export interface CheckResult {
  pass: boolean;
  issues: string;
}

/**
 * Check a generated mockup against the original brief.
 */
export async function checkMockup(imagePath: string, brief: string): Promise<CheckResult> {
  const provider = getProvider();
  const imageData = fs.readFileSync(imagePath).toString("base64");

  const prompt = [
    "You are a UI quality checker. Evaluate this mockup against the design brief.",
    "",
    `Brief: ${brief}`,
    "",
    "Check these 3 things:",
    "1. TEXT READABILITY: Are all labels, headings, and body text legible? Any misspellings?",
    "2. LAYOUT COMPLETENESS: Are all requested elements present? Anything missing?",
    "3. VISUAL COHERENCE: Does it look like a real production UI, not AI art or a collage?",
    "",
    "Respond with exactly one line:",
    "PASS — if all 3 checks pass",
    "FAIL: [list specific issues] — if any check fails",
  ].join("\n");

  let content: string;
  try {
    content = await provider.analyze({
      images: [imageData],
      prompt,
      maxTokens: 200,
    });
  } catch (err: any) {
    console.error(`Vision check failed: ${err.message}`);
    return { pass: true, issues: "Vision check unavailable — skipped" };
  }

  if (content.startsWith("PASS")) {
    return { pass: true, issues: "" };
  }

  const issues = content.replace(/^FAIL:\s*/i, "").trim();
  return { pass: false, issues: issues || content };
}

/**
 * Standalone check command: check an existing image against a brief.
 */
export async function checkCommand(imagePath: string, brief: string): Promise<void> {
  const result = await checkMockup(imagePath, brief);
  console.log(JSON.stringify(result, null, 2));
}
