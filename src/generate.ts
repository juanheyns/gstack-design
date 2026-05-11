/**
 * Generate UI mockups via Codex.
 */

import fs from "fs";
import path from "path";
import { requireCodexAuth } from "./auth";
import { parseBrief } from "./brief";
import { imageModelGuardrails, runCodexJson } from "./codex";
import { buildImageTaskSchema, type ImageTaskResponse, validateGeneratedPng, validateImageTaskResponse } from "./image-task";
import { resolveLogPath } from "./project-dir";
import { createSession, sessionPath } from "./session";
import { checkMockup } from "./check";

export interface GenerateOptions {
  brief?: string;
  briefFile?: string;
  output: string;
  check?: boolean;
  retry?: number;
  size?: string;
  quality?: string;
}

export interface GenerateResult {
  outputPath: string;
  sessionFile: string;
  responseId: string;
  logPath: string;
  codexStatus: ImageTaskResponse;
  checkResult?: { pass: boolean; issues: string };
}

function buildGenerationPrompt(
  prompt: string,
  outputPath: string,
  size: string,
  quality: string,
): string {
  return [
    "Create a production-quality UI mockup from the brief below.",
    ...imageModelGuardrails(outputPath, size, quality),
    "",
    "Design brief:",
    prompt,
    "",
    "Requirements:",
    "- The result must look like a real, polished product UI rather than concept art.",
    "- Do not rename the file or substitute another format.",
    '- Return JSON only.',
    '- If you successfully create and write the PNG, return: {"status":"ok","writtenFiles":["absolute-path"],"generationMethod":"native_image_generation","notes":""}.',
    '- If native image generation or direct file writing is unavailable, return: {"status":"unavailable","writtenFiles":[],"generationMethod":"unavailable","notes":"explain why"}.',
    '- Do not claim success if the file was not actually written.',
  ].join("\n");
}

/**
 * Generate a single mockup from a brief.
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  requireCodexAuth();

  // Parse the brief
  const basePrompt = options.briefFile
    ? parseBrief(options.briefFile, true)
    : parseBrief(options.brief!, false);

  const size = options.size || "1536x1024";
  const quality = options.quality || "high";
  const maxRetries = options.retry ?? 0;

  let lastResult: GenerateResult | null = null;
  let currentPrompt = basePrompt;
  const logPath = resolveLogPath("generate");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.error(`Retry ${attempt}/${maxRetries}...`);
    }

    const startTime = Date.now();
    const outputDir = path.dirname(options.output);
    fs.mkdirSync(outputDir, { recursive: true });

    const codexStatus = await runCodexJson<ImageTaskResponse>({
      prompt: buildGenerationPrompt(currentPrompt, options.output, size, quality),
      logPath,
      outputSchema: buildImageTaskSchema(1),
      writablePaths: [options.output],
      timeoutMs: 5 * 60_000,
    });

    validateImageTaskResponse(codexStatus, [options.output]);
    const imageInfo = validateGeneratedPng(options.output, size);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    // Create session
    const responseId = `codex-${Date.now()}`;
    const session = createSession(responseId, basePrompt, options.output);

    console.error(`Generated (${elapsed}s, ${(imageInfo.bytes / 1024).toFixed(0)}KB, ${imageInfo.width}x${imageInfo.height}) → ${options.output}`);

    lastResult = {
      outputPath: options.output,
      sessionFile: sessionPath(session.id),
      responseId,
      logPath,
      codexStatus,
    };

    // Quality check if requested
    if (options.check) {
      const checkResult = await checkMockup(options.output, basePrompt);
      lastResult.checkResult = checkResult;

      if (checkResult.pass) {
        console.error(`Quality check: PASS`);
        break;
      } else {
        console.error(`Quality check: FAIL — ${checkResult.issues}`);
        if (attempt < maxRetries) {
          console.error("Will retry...");
          currentPrompt = [
            basePrompt,
            "",
            "The previous attempt failed quality review.",
            `Address these issues in the next attempt: ${checkResult.issues}`,
          ].join("\n");
        }
      }
    } else {
      break;
    }
  }

  // Output result as JSON to stdout
  console.log(JSON.stringify(lastResult, null, 2));
  return lastResult!;
}
