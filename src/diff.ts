/**
 * Visual diff between two mockups using the configured vision provider.
 * Identifies what changed between design iterations or between
 * an approved mockup and the live implementation.
 */

import fs from "fs";
import { getProvider } from "./providers";

export interface DiffResult {
  differences: { area: string; description: string; severity: string }[];
  summary: string;
  matchScore: number; // 0-100, how closely they match
}

const DIFF_PROMPT = `Compare these two UI images. The first is the BEFORE (or design intent), the second is the AFTER (or actual implementation). Return valid JSON only:

{
  "differences": [
    {"area": "header", "description": "Font size changed from ~32px to ~24px", "severity": "high"}
  ],
  "summary": "one sentence overall assessment",
  "matchScore": 85
}

severity: "high" = noticeable to any user, "medium" = visible on close inspection, "low" = minor/pixel-level.
matchScore: 100 = identical, 0 = completely different.
Focus on layout, typography, colors, spacing, and element presence/absence. Ignore rendering differences (anti-aliasing, sub-pixel).`;

/**
 * Compare two images and describe the visual differences.
 */
export async function diffMockups(
  beforePath: string,
  afterPath: string,
): Promise<DiffResult> {
  const provider = getProvider();
  const beforeData = fs.readFileSync(beforePath).toString("base64");
  const afterData = fs.readFileSync(afterPath).toString("base64");

  try {
    const content = await provider.analyze({
      images: [beforeData, afterData],
      prompt: DIFF_PROMPT,
      jsonMode: true,
      maxTokens: 600,
    });
    return JSON.parse(content) as DiffResult;
  } catch (err: any) {
    console.error(`Diff failed: ${err.message?.slice(0, 200) ?? err}`);
    return { differences: [], summary: "Diff unavailable", matchScore: -1 };
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
