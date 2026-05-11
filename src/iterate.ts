/**
 * Multi-turn design iteration using Codex.
 */

import fs from "fs";
import path from "path";
import { requireCodexAuth } from "./auth";
import { imageModelGuardrails, runCodexJson } from "./codex";
import { buildImageTaskSchema, type ImageTaskResponse, validateGeneratedPng, validateImageTaskResponse } from "./image-task";
import { resolveLogPath } from "./project-dir";
import { readSession, updateSession } from "./session";

export interface IterateOptions {
  session: string;   // Path to session JSON file
  feedback: string;  // User feedback text
  output: string;    // Output path for new PNG
}

/**
 * Iterate on an existing design using session state.
 */
export async function iterate(options: IterateOptions): Promise<void> {
  requireCodexAuth();
  const session = readSession(options.session);

  console.error(`Iterating on session ${session.id}...`);
  console.error(`  Previous iterations: ${session.feedbackHistory.length}`);
  console.error(`  Feedback: "${options.feedback}"`);

  const startTime = Date.now();
  const accumulatedPrompt = buildAccumulatedPrompt(
    session.originalBrief,
    [...session.feedbackHistory, options.feedback]
  );
  const referenceImage = [...session.outputPaths].reverse().find((value) => fs.existsSync(value));
  const logPath = resolveLogPath("iterate");
  const outputSize = "1536x1024";

  fs.mkdirSync(path.dirname(options.output), { recursive: true });

  const codexStatus = await runCodexJson<ImageTaskResponse>({
    prompt: [
      "Refine the attached UI mockup using the feedback below.",
      ...imageModelGuardrails(options.output, outputSize, "high"),
      "",
      accumulatedPrompt,
      "",
      "Use the attached image as the current design baseline.",
      "Preserve the overall product context while applying all requested changes.",
      '- Return JSON only.',
      '- If you successfully create and write the PNG, return: {"status":"ok","writtenFiles":["absolute-path"],"generationMethod":"native_image_generation","notes":""}.',
      '- If native image generation or direct file writing is unavailable, return: {"status":"unavailable","writtenFiles":[],"generationMethod":"unavailable","notes":"explain why"}.',
      '- Do not claim success if the file was not actually written.',
    ].join("\n"),
    images: referenceImage ? [referenceImage] : [],
    logPath,
    outputSchema: buildImageTaskSchema(1),
    writablePaths: [options.output],
    timeoutMs: 5 * 60_000,
  });

  validateImageTaskResponse(codexStatus, [options.output]);
  const imageInfo = validateGeneratedPng(options.output, outputSize);

  const responseId = `codex-${Date.now()}`;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`Generated (${elapsed}s, ${(imageInfo.bytes / 1024).toFixed(0)}KB, ${imageInfo.width}x${imageInfo.height}) → ${options.output}`);

  // Update session
  updateSession(session, responseId, options.feedback, options.output);

  console.log(JSON.stringify({
    outputPath: options.output,
    sessionFile: options.session,
    responseId,
    iteration: session.feedbackHistory.length + 1,
    logPath,
    codexStatus,
  }, null, 2));
}

function buildAccumulatedPrompt(originalBrief: string, feedback: string[]): string {
  const lines = [
    originalBrief,
    "",
    "Previous feedback (apply all of these changes):",
  ];

  feedback.forEach((f, i) => {
    lines.push(`${i + 1}. ${f}`);
  });

  lines.push(
    "",
    "Generate a new mockup incorporating ALL the feedback above.",
    "The result should look like a real production UI, not a wireframe."
  );

  return lines.join("\n");
}
