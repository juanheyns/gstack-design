/**
 * Screenshot-to-Mockup Evolution.
 * Takes a screenshot of the live site and generates a mockup showing
 * how it SHOULD look based on a design brief.
 * Starts from reality, not blank canvas.
 */

import fs from "fs";
import path from "path";
import { requireCodexAuth } from "./auth";
import { imageModelGuardrails, runCodexJson } from "./codex";
import { buildImageTaskSchema, type ImageTaskResponse, validateGeneratedPng, validateImageTaskResponse } from "./image-task";
import { resolveLogPath } from "./project-dir";

export interface EvolveOptions {
  screenshot: string;  // Path to current site screenshot
  brief: string;       // What to change ("make it calmer", "fix the hierarchy")
  output: string;      // Output path for evolved mockup
}

/**
 * Generate an evolved mockup from an existing screenshot + brief.
 * Sends the screenshot as context to Codex, asking it to produce a new
 * version incorporating the brief's changes.
 */
export async function evolve(options: EvolveOptions): Promise<void> {
  requireCodexAuth();

  console.error(`Evolving ${options.screenshot} with: "${options.brief}"`);
  const startTime = Date.now();
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const logPath = resolveLogPath("evolve");
  const outputSize = "1536x1024";

  const codexStatus = await runCodexJson<ImageTaskResponse>({
    prompt: [
      "Create an evolved UI mockup based on the attached screenshot.",
      ...imageModelGuardrails(options.output, outputSize, "high"),
      "",
      "Requested changes:",
      options.brief,
      "",
      "Preserve the core product context from the screenshot while applying the requested design changes.",
      "The result should look like a real production UI, not a wireframe.",
      '- Return JSON only.',
      '- If you successfully create and write the PNG, return: {"status":"ok","writtenFiles":["absolute-path"],"generationMethod":"native_image_generation","notes":""}.',
      '- If native image generation or direct file writing is unavailable, return: {"status":"unavailable","writtenFiles":[],"generationMethod":"unavailable","notes":"explain why"}.',
      '- Do not claim success if the file was not actually written.',
    ].join("\n"),
    images: [options.screenshot],
    logPath,
    outputSchema: buildImageTaskSchema(1),
    writablePaths: [options.output],
    timeoutMs: 5 * 60_000,
  });

  validateImageTaskResponse(codexStatus, [options.output]);
  const imageInfo = validateGeneratedPng(options.output, outputSize);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`Generated (${elapsed}s, ${(imageInfo.bytes / 1024).toFixed(0)}KB, ${imageInfo.width}x${imageInfo.height}) → ${options.output}`);

  console.log(JSON.stringify({
    outputPath: options.output,
    sourceScreenshot: options.screenshot,
    brief: options.brief,
    logPath,
    codexStatus,
  }, null, 2));
}
