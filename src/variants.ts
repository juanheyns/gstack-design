/**
 * Generate N design variants from a brief using Codex.
 */

import fs from "fs";
import path from "path";
import { requireCodexAuth } from "./auth";
import { parseBrief } from "./brief";
import { imageModelGuardrails, runCodexJson } from "./codex";
import { buildImageTaskSchema, type ImageTaskResponse, validateGeneratedPng, validateImageTaskResponse } from "./image-task";
import { resolveLogPath } from "./project-dir";

export interface VariantsOptions {
  brief?: string;
  briefFile?: string;
  count: number;
  outputDir: string;
  size?: string;
  quality?: string;
  viewports?: string; // "desktop,tablet,mobile" — generates at multiple sizes
}

const STYLE_VARIATIONS = [
  "", // First variant uses the brief as-is
  "Use a bolder, more dramatic visual style with stronger contrast and larger typography.",
  "Use a calmer, more minimal style with generous whitespace and subtle colors.",
  "Use a warmer, more approachable style with rounded corners and friendly typography.",
  "Use a more professional, corporate style with sharp edges and structured grid layout.",
  "Use a dark theme with light text and accent colors for key interactive elements.",
  "Use a playful, modern style with asymmetric layout and unexpected color accents.",
];

/**
 * Generate N variants with staggered parallel execution.
 */
export async function variants(options: VariantsOptions): Promise<void> {
  requireCodexAuth();
  const baseBrief = options.briefFile
    ? parseBrief(options.briefFile, true)
    : parseBrief(options.brief!, false);

  const quality = options.quality || "high";

  fs.mkdirSync(options.outputDir, { recursive: true });

  // If viewports specified, generate responsive variants instead of style variants
  if (options.viewports) {
    await generateResponsiveVariants(baseBrief, options.outputDir, options.viewports, quality);
    return;
  }

  const count = Math.min(options.count, 7); // Cap at 7 style variations
  const size = options.size || "1536x1024";

  console.error(`Generating ${count} variants...`);
  const startTime = Date.now();
  const logPath = resolveLogPath("variants");
  const specs = Array.from({ length: count }, (_, i) => {
    const label = String.fromCharCode(65 + i);
    return {
      label,
      path: path.join(options.outputDir, `variant-${label}.png`),
      direction: STYLE_VARIATIONS[i] || "",
    };
  });

  const codexStatus = await runCodexJson<ImageTaskResponse>({
    prompt: [
      "Create multiple distinct UI mockup variants from one brief.",
      "",
      `Base brief: ${baseBrief}`,
      ...imageModelGuardrails(path.join(options.outputDir, "variant-A.png"), size, quality),
      "",
      "Write the final PNG files exactly to these paths:",
      ...specs.map((spec) =>
        `- ${path.resolve(spec.path)}${spec.direction ? ` — direction: ${spec.direction}` : " — direction: use the brief as-is"}`
      ),
      "",
      "Each variant must be a meaningfully different visual direction for the same product brief.",
      "Do not rename any files or skip any requested output.",
      "Apply the native image-generation requirement to every requested variant file.",
      '- Return JSON only.',
      '- If you successfully create and write all requested PNGs, return: {"status":"ok","writtenFiles":["absolute-path-1","absolute-path-2"],"generationMethod":"native_image_generation","notes":""}.',
      '- If native image generation or direct file writing is unavailable, return: {"status":"unavailable","writtenFiles":[],"generationMethod":"unavailable","notes":"explain why"}.',
      '- Do not claim success if every requested file was not actually written.',
    ].join("\n"),
    logPath,
    outputSchema: buildImageTaskSchema(specs.length),
    writablePaths: specs.map((spec) => spec.path),
    timeoutMs: 8 * 60_000,
  });

  validateImageTaskResponse(codexStatus, specs.map((spec) => spec.path));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const succeeded: string[] = [];
  const failed: string[] = [];

  for (const spec of specs) {
    try {
      const imageInfo = validateGeneratedPng(spec.path, size);
      console.error(`  ✓ ${path.basename(spec.path)} (${(imageInfo.bytes / 1024).toFixed(0)}KB, ${imageInfo.width}x${imageInfo.height})`);
      succeeded.push(spec.path);
    } catch (error: any) {
      console.error(`  ✗ ${path.basename(spec.path)}: ${error.message}`);
      failed.push(path.basename(spec.path));
    }
  }

  if (failed.length > 0) {
    throw new Error(`Variant generation failed for ${failed.length}/${count} files. Log: ${logPath}`);
  }

  console.error(`\n${succeeded.length}/${count} variants generated (${elapsed}s)`);

  // Output structured result to stdout
  console.log(JSON.stringify({
    outputDir: options.outputDir,
    count,
    succeeded: succeeded.length,
    failed: failed.length,
    paths: succeeded,
    errors: failed,
    logPath,
    codexStatus,
  }, null, 2));
}

const VIEWPORT_CONFIGS: Record<string, { size: string; suffix: string; desc: string }> = {
  desktop: { size: "1536x1024", suffix: "desktop", desc: "Desktop (1536x1024)" },
  tablet: { size: "1024x1024", suffix: "tablet", desc: "Tablet (1024x1024)" },
  mobile: { size: "1024x1536", suffix: "mobile", desc: "Mobile (1024x1536, portrait)" },
};

async function generateResponsiveVariants(
  baseBrief: string,
  outputDir: string,
  viewports: string,
  quality: string,
): Promise<void> {
  const viewportList = viewports.split(",").map(v => v.trim().toLowerCase());
  const configs = viewportList.map(v => VIEWPORT_CONFIGS[v]).filter(Boolean);

  if (configs.length === 0) {
    console.error(`No valid viewports. Use: desktop, tablet, mobile`);
    process.exit(1);
  }

  console.error(`Generating responsive variants: ${configs.map(c => c.desc).join(", ")}...`);
  const startTime = Date.now();
  const logPath = resolveLogPath("variants-responsive");
  const specs = configs.map((config) => ({
    config,
    path: path.join(outputDir, `responsive-${config.suffix}.png`),
  }));

  const codexStatus = await runCodexJson<ImageTaskResponse>({
    prompt: [
      "Create responsive UI mockup variants for the same brief.",
      "",
      `Base brief: ${baseBrief}`,
      ...imageModelGuardrails(path.join(outputDir, "responsive-desktop.png"), "1536x1024", quality),
      "",
      "Write PNG files exactly to these paths:",
      ...specs.map(({ config, path: outputPath }) => {
        const extra = config.suffix === "mobile"
          ? "Use a single-column layout, larger touch targets, and mobile navigation patterns."
          : config.suffix === "tablet"
            ? "Use a responsive layout that works for medium screens."
            : "Use a desktop-appropriate layout.";
        return `- ${path.resolve(outputPath)} — ${config.desc}. ${extra}`;
      }),
      "",
      "Adapt the same product to each viewport while preserving visual consistency across the set.",
      "Apply the native image-generation requirement to every requested viewport file.",
      '- Return JSON only.',
      '- If you successfully create and write all requested PNGs, return: {"status":"ok","writtenFiles":["absolute-path-1","absolute-path-2"],"generationMethod":"native_image_generation","notes":""}.',
      '- If native image generation or direct file writing is unavailable, return: {"status":"unavailable","writtenFiles":[],"generationMethod":"unavailable","notes":"explain why"}.',
      '- Do not claim success if every requested file was not actually written.',
    ].join("\n"),
    logPath,
    outputSchema: buildImageTaskSchema(specs.length),
    writablePaths: specs.map((spec) => spec.path),
    timeoutMs: 8 * 60_000,
  });

  validateImageTaskResponse(codexStatus, specs.map((spec) => spec.path));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const succeeded: string[] = [];
  for (const spec of specs) {
    try {
      const imageInfo = validateGeneratedPng(spec.path, spec.config.size);
      console.error(`  ✓ ${path.basename(spec.path)} (${(imageInfo.bytes / 1024).toFixed(0)}KB, ${imageInfo.width}x${imageInfo.height})`);
      succeeded.push(spec.path);
    } catch (error: any) {
      console.error(`  ✗ ${path.basename(spec.path)}: ${error.message}`);
    }
  }

  if (succeeded.length !== configs.length) {
    throw new Error(`Responsive variant generation failed for ${configs.length - succeeded.length}/${configs.length} files. Log: ${logPath}`);
  }

  console.error(`\n${succeeded.length}/${configs.length} responsive variants generated (${elapsed}s)`);
  console.log(JSON.stringify({
    outputDir,
    viewports: viewportList,
    succeeded: succeeded.length,
    paths: succeeded,
    logPath,
    codexStatus,
  }, null, 2));
}
