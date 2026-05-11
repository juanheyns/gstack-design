/**
 * Design Memory — extract visual language from approved mockups into DESIGN.md.
 *
 * After a mockup is approved, uses Codex to extract:
 * - Color palette (hex values)
 * - Typography (font families, sizes, weights)
 * - Spacing patterns (padding, margins, gaps)
 * - Layout conventions (grid, alignment, hierarchy)
 *
 * If DESIGN.md exists, merges extracted patterns with existing design system.
 * If no DESIGN.md, creates one from the extracted patterns.
 */

import fs from "fs";
import path from "path";
import { requireCodexAuth } from "./auth";
import { runCodexJson } from "./codex";
import { resolveLogPath } from "./project-dir";

export interface ExtractedDesign {
  colors: { name: string; hex: string; usage: string }[];
  typography: { role: string; family: string; size: string; weight: string }[];
  spacing: string[];
  layout: string[];
  mood: string;
  logPath?: string;
}

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    colors: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          hex: { type: "string" },
          usage: { type: "string" },
        },
        required: ["name", "hex", "usage"],
      },
    },
    typography: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          role: { type: "string" },
          family: { type: "string" },
          size: { type: "string" },
          weight: { type: "string" },
        },
        required: ["role", "family", "size", "weight"],
      },
    },
    spacing: { type: "array", items: { type: "string" } },
    layout: { type: "array", items: { type: "string" } },
    mood: { type: "string" },
  },
  required: ["colors", "typography", "spacing", "layout", "mood"],
};

/**
 * Extract visual language from an approved mockup PNG.
 */
export async function extractDesignLanguage(imagePath: string): Promise<ExtractedDesign> {
  requireCodexAuth();
  const logPath = resolveLogPath("extract");

  try {
    const result = await runCodexJson<ExtractedDesign>({
      images: [imagePath],
      logPath,
      outputSchema: EXTRACT_SCHEMA,
      timeoutMs: 90_000,
      prompt: `Analyze the attached UI mockup and extract the design language as JSON only.

Extract real values from what you see. Be specific about hex colors, font sizes, spacing rhythms, layout conventions, and the overall mood.`,
    });
    return { ...result, logPath };
  } catch (err: any) {
    console.error(`Design extraction error: ${err.message}`);
    return { ...defaultDesign(), logPath };
  }
}

function defaultDesign(): ExtractedDesign {
  return {
    colors: [],
    typography: [],
    spacing: [],
    layout: [],
    mood: "Unable to extract design language",
  };
}

/**
 * Write or update DESIGN.md with extracted design patterns.
 * If DESIGN.md exists, appends an "Extracted from mockup" section.
 * If not, creates a new one.
 */
export function updateDesignMd(
  repoRoot: string,
  extracted: ExtractedDesign,
  sourceMockup: string,
): void {
  const designPath = path.join(repoRoot, "DESIGN.md");
  const timestamp = new Date().toISOString().split("T")[0];

  const section = formatExtractedSection(extracted, sourceMockup, timestamp);

  if (fs.existsSync(designPath)) {
    // Append to existing DESIGN.md
    const existing = fs.readFileSync(designPath, "utf-8");

    // Check if there's already an extracted section, replace it
    const marker = "## Extracted Design Language";
    if (existing.includes(marker)) {
      const before = existing.split(marker)[0];
      fs.writeFileSync(designPath, before.trimEnd() + "\n\n" + section);
    } else {
      fs.writeFileSync(designPath, existing.trimEnd() + "\n\n" + section);
    }
    console.error(`Updated DESIGN.md with extracted design language`);
  } else {
    // Create new DESIGN.md
    const content = `# Design System

${section}`;
    fs.writeFileSync(designPath, content);
    console.error(`Created DESIGN.md with extracted design language`);
  }
}

function formatExtractedSection(
  extracted: ExtractedDesign,
  sourceMockup: string,
  date: string,
): string {
  const lines: string[] = [
    "## Extracted Design Language",
    `*Auto-extracted from approved mockup on ${date}*`,
    `*Source: ${path.basename(sourceMockup)}*`,
    "",
    `**Mood:** ${extracted.mood}`,
    "",
  ];

  if (extracted.colors.length > 0) {
    lines.push("### Colors", "");
    lines.push("| Name | Hex | Usage |");
    lines.push("|------|-----|-------|");
    for (const c of extracted.colors) {
      lines.push(`| ${c.name} | \`${c.hex}\` | ${c.usage} |`);
    }
    lines.push("");
  }

  if (extracted.typography.length > 0) {
    lines.push("### Typography", "");
    lines.push("| Role | Family | Size | Weight |");
    lines.push("|------|--------|------|--------|");
    for (const t of extracted.typography) {
      lines.push(`| ${t.role} | ${t.family} | ${t.size} | ${t.weight} |`);
    }
    lines.push("");
  }

  if (extracted.spacing.length > 0) {
    lines.push("### Spacing", "");
    for (const s of extracted.spacing) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  if (extracted.layout.length > 0) {
    lines.push("### Layout", "");
    for (const l of extracted.layout) {
      lines.push(`- ${l}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Read DESIGN.md and return it as a constraint string for brief construction.
 * If no DESIGN.md exists, returns null (explore wide).
 */
export function readDesignConstraints(repoRoot: string): string | null {
  const designPath = path.join(repoRoot, "DESIGN.md");
  if (!fs.existsSync(designPath)) return null;

  const content = fs.readFileSync(designPath, "utf-8");
  // Truncate to first 2000 chars to keep brief reasonable
  return content.slice(0, 2000);
}
