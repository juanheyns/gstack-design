/**
 * Screenshot-to-Mockup Evolution.
 * Takes a screenshot of the live site and generates a mockup showing
 * how it SHOULD look based on a design brief.
 * Starts from reality, not blank canvas.
 *
 * Strategy depends on provider:
 *   - imageEdit (Gemini): single call sending screenshot + brief.
 *   - else (OpenAI): analyze screenshot → text, then regenerate.
 */

import fs from "fs";
import path from "path";
import { getProvider } from "./providers";

export interface EvolveOptions {
  screenshot: string;
  brief: string;
  output: string;
}

const EVOLVE_SIZE = "1536x1024";
const EVOLVE_QUALITY = "high";

export async function evolve(options: EvolveOptions): Promise<void> {
  const provider = getProvider();
  const screenshotData = fs.readFileSync(options.screenshot).toString("base64");

  console.error(`Evolving ${options.screenshot} with: "${options.brief}"`);
  const startTime = Date.now();

  let imageData: string;

  if (provider.capabilities.imageEdit) {
    const prompt = [
      "Generate an improved version of the UI shown in the reference image.",
      "Keep the existing layout structure but apply the requested changes.",
      "",
      "REQUESTED CHANGES:",
      options.brief,
      "",
      "The result should look like a real production UI. All text must be readable.",
    ].join("\n");

    const result = await provider.editImage({
      prompt,
      sourceImage: screenshotData,
      size: EVOLVE_SIZE,
      quality: EVOLVE_QUALITY,
    });
    imageData = result.imageData;
  } else {
    const analysis = await provider.analyze({
      images: [screenshotData],
      prompt:
        "Describe this UI in detail for re-creation. Include: overall layout structure, " +
        "color scheme (hex values), typography (sizes, weights), specific text content visible, " +
        "spacing between elements, alignment patterns, and any decorative elements. " +
        "Be precise enough that someone could recreate this UI from your description alone. 200 words max.",
      maxTokens: 400,
      timeoutMs: 30_000,
    });
    console.error(`  Analyzed current design: ${analysis.slice(0, 100)}...`);

    const evolvedPrompt = [
      "Generate a pixel-perfect UI mockup that is an improved version of an existing design.",
      "",
      "CURRENT DESIGN (what exists now):",
      analysis,
      "",
      "REQUESTED CHANGES:",
      options.brief,
      "",
      "Generate a new mockup that keeps the existing layout structure but applies the requested changes.",
      "The result should look like a real production UI. All text must be readable.",
      "1536x1024 pixels.",
    ].join("\n");

    const result = await provider.generateImage({
      prompt: evolvedPrompt,
      size: EVOLVE_SIZE,
      quality: EVOLVE_QUALITY,
    });
    imageData = result.imageData;
  }

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const imageBuffer = Buffer.from(imageData, "base64");
  fs.writeFileSync(options.output, imageBuffer);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.error(`Generated (${elapsed}s, ${(imageBuffer.length / 1024).toFixed(0)}KB) → ${options.output}`);

  console.log(JSON.stringify({
    outputPath: options.output,
    sourceScreenshot: options.screenshot,
    brief: options.brief,
  }, null, 2));
}
