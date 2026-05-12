/**
 * Multi-turn design iteration.
 *
 * Strategy depends on provider capabilities:
 *   - sessionThreading (OpenAI): use providerRef to thread follow-ups.
 *   - imageEdit (Gemini): send the previous image + feedback for a direct edit.
 *   - Neither: regenerate from the original brief + accumulated feedback.
 */

import fs from "fs";
import path from "path";
import { getProvider } from "./providers";
import { readSession, updateSession } from "./session";

export interface IterateOptions {
  session: string;
  feedback: string;
  output: string;
}

const ITERATE_SIZE = "1536x1024";
const ITERATE_QUALITY = "high";

export async function iterate(options: IterateOptions): Promise<void> {
  const provider = getProvider();
  const session = readSession(options.session);

  console.error(`Iterating on session ${session.id}...`);
  console.error(`  Previous iterations: ${session.feedbackHistory.length}`);
  console.error(`  Feedback: "${options.feedback}"`);

  const startTime = Date.now();
  let imageData: string;
  let providerRef = "";

  if (provider.capabilities.sessionThreading && session.lastResponseId) {
    try {
      const result = await provider.generateImage({
        prompt: `Based on the previous design, make these changes: ${options.feedback}`,
        size: ITERATE_SIZE,
        quality: ITERATE_QUALITY,
        previousRef: session.lastResponseId,
      });
      imageData = result.imageData;
      providerRef = result.providerRef ?? "";
    } catch (err: any) {
      console.error(`  Threading failed: ${err.message}`);
      ({ imageData, providerRef } = await fallback(provider, session, options.feedback));
    }
  } else if (provider.capabilities.imageEdit && session.outputPaths.length > 0) {
    const lastImage = session.outputPaths[session.outputPaths.length - 1];
    const sourceImage = fs.readFileSync(lastImage).toString("base64");
    const result = await provider.editImage({
      prompt: `Make these changes to the design: ${options.feedback}`,
      sourceImage,
      size: ITERATE_SIZE,
      quality: ITERATE_QUALITY,
    });
    imageData = result.imageData;
    providerRef = result.providerRef ?? "";
  } else {
    ({ imageData, providerRef } = await fallback(provider, session, options.feedback));
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.writeFileSync(options.output, Buffer.from(imageData, "base64"));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const size = fs.statSync(options.output).size;
  console.error(`Generated (${elapsed}s, ${(size / 1024).toFixed(0)}KB) → ${options.output}`);

  updateSession(session, providerRef, options.feedback, options.output);

  console.log(JSON.stringify({
    outputPath: options.output,
    sessionFile: options.session,
    responseId: providerRef,
    iteration: session.feedbackHistory.length,
  }, null, 2));
}

async function fallback(
  provider: ReturnType<typeof getProvider>,
  session: ReturnType<typeof readSession>,
  feedback: string,
): Promise<{ imageData: string; providerRef: string }> {
  console.error("  Falling back to re-generation with accumulated feedback...");
  const accumulatedPrompt = buildAccumulatedPrompt(
    session.originalBrief,
    [...session.feedbackHistory, feedback],
  );
  const result = await provider.generateImage({
    prompt: accumulatedPrompt,
    size: ITERATE_SIZE,
    quality: ITERATE_QUALITY,
  });
  return { imageData: result.imageData, providerRef: result.providerRef ?? "" };
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
    "The result should look like a real production UI, not a wireframe.",
  );
  return lines.join("\n");
}
