import fs from "fs";
import os from "os";
import path from "path";
import { spawn } from "child_process";

const DEFAULT_TIMEOUT_MS = 5 * 60_000;

export interface CodexTaskOptions {
  prompt: string;
  cwd?: string;
  images?: string[];
  writablePaths?: string[];
  timeoutMs?: number;
  outputSchema?: unknown;
  logPath?: string;
  streamOutput?: boolean;
}

export interface CodexTaskResult {
  lastMessage: string;
  stdout: string;
  stderr: string;
  logPath: string;
}

export function imageModelGuardrails(outputPath: string, size: string, quality: string): string[] {
  return [
    `Write the final result as a PNG file to: ${path.resolve(outputPath)}`,
    `Target size: ${size}`,
    `Requested quality: ${quality}`,
    "You MUST use a dedicated native image-generation model or image-generation tool for the final image.",
    "Do NOT create SVG, HTML, Canvas, CSS art, screenshots, or any other locally rendered intermediate and convert it to PNG.",
    "Do NOT use local rasterization or conversion tools such as browser screenshots, ImageMagick, sharp, ffmpeg, inkscape, or similar workarounds.",
    "If native image generation is unavailable in this Codex environment, fail explicitly instead of faking the output locally.",
    "The final artifact must be a real generated PNG at the exact path above.",
  ];
}

function createPrefixedWriter(prefix: string, write: (text: string) => void): (chunk: Buffer) => void {
  let atLineStart = true;

  return (chunk: Buffer) => {
    const text = chunk.toString("utf-8");
    let output = "";

    for (const char of text) {
      if (atLineStart) {
        output += prefix;
        atLineStart = false;
      }

      output += char;

      if (char === "\n") {
        atLineStart = true;
      }
    }

    write(output);
  };
}

function createProgressWriter(symbol = "."): {
  write: (chunk: Buffer) => void;
  finish: () => void;
} {
  let pending = "";
  let wroteAny = false;
  let lineCount = 0;

  return {
    write(chunk: Buffer) {
      pending += chunk.toString("utf-8");

      let newlineIndex = pending.indexOf("\n");
      while (newlineIndex !== -1) {
        process.stderr.write(symbol);
        wroteAny = true;
        lineCount++;
        if (lineCount % 80 === 0) {
          process.stderr.write("\n");
        }
        pending = pending.slice(newlineIndex + 1);
        newlineIndex = pending.indexOf("\n");
      }
    },
    finish() {
      if (pending.length > 0) {
        process.stderr.write(symbol);
        wroteAny = true;
      }
      if (wroteAny) {
        process.stderr.write("\n");
      }
    },
  };
}

function resolveCodexBin(): string {
  return process.env.DESIGN_CODEX_BIN || "codex";
}

function collectAccessibleDirs(
  cwd: string,
  images: string[],
  writablePaths: string[],
): string[] {
  const dirs = new Set<string>();
  const addDir = (value: string) => {
    const abs = path.resolve(value);
    const dir = fs.existsSync(abs) && fs.statSync(abs).isDirectory()
      ? abs
      : path.dirname(abs);
    if (dir !== cwd && !dir.startsWith(`${cwd}${path.sep}`)) {
      dirs.add(dir);
    }
  };

  images.forEach(addDir);
  writablePaths.forEach(addDir);

  return [...dirs].sort();
}

function stripJsonFences(input: string): string {
  const trimmed = input.trim();
  if (!trimmed.startsWith("```")) return trimmed;

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

export async function runCodexTask(options: CodexTaskOptions): Promise<CodexTaskResult> {
  const cwd = path.resolve(options.cwd || process.cwd());
  const images = (options.images || []).map((value) => path.resolve(value));
  const writablePaths = (options.writablePaths || []).map((value) => path.resolve(value));
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const streamOutput = options.streamOutput ?? process.env.DESIGN_STREAM_CODEX_OUTPUT === "1";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "design-codex-"));
  const lastMessagePath = path.join(tempDir, "last-message.txt");
  const logPath = path.resolve(
    options.logPath || path.join(os.tmpdir(), "design-logs", `codex-${Date.now()}.log`)
  );
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, "");
  const appendLog = (text: string) => fs.appendFileSync(logPath, text);
  const logStdout = createPrefixedWriter("[codex stdout] ", appendLog);
  const logStderr = createPrefixedWriter("[codex stderr] ", appendLog);
  const streamStdout = createPrefixedWriter("[codex stdout] ", (text) => process.stderr.write(text));
  const streamStderr = createPrefixedWriter("[codex stderr] ", (text) => process.stderr.write(text));
  const progress = createProgressWriter(".");
  const args = [
    "exec",
    "--skip-git-repo-check",
    "-C",
    cwd,
    "-s",
    "workspace-write",
    "--color",
    "never",
    "--output-last-message",
    lastMessagePath,
  ];

  try {
    const extraDirs = collectAccessibleDirs(cwd, images, writablePaths);
    for (const dir of extraDirs) {
      args.push("--add-dir", dir);
    }

    if (options.outputSchema) {
      const schemaPath = path.join(tempDir, "output-schema.json");
      fs.writeFileSync(schemaPath, JSON.stringify(options.outputSchema, null, 2));
      args.push("--output-schema", schemaPath);
    }

    for (const imagePath of images) {
      args.push("-i", imagePath);
    }

    args.push("-");

    fs.appendFileSync(logPath, [
      `timestamp: ${new Date().toISOString()}`,
      `cwd: ${cwd}`,
      `images: ${images.join(", ") || "(none)"}`,
      `writablePaths: ${writablePaths.join(", ") || "(none)"}`,
      `args: ${args.join(" ")}`,
      "",
      "prompt:",
      options.prompt,
      "",
      "stream:",
    ].join("\n") + "\n");

    const child = spawn(resolveCodexBin(), args, {
      cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      logStdout(chunk);
      if (streamOutput) streamStdout(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrChunks.push(chunk);
      logStderr(chunk);
      if (streamOutput) {
        streamStderr(chunk);
      } else {
        progress.write(chunk);
      }
    });

    const exitCode = await new Promise<number>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill("SIGTERM");
        reject(new Error(`codex exec timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      child.on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve(code ?? 1);
      });

      child.stdin.end(options.prompt);
    });

    const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
    const stderr = Buffer.concat(stderrChunks).toString("utf-8");
    const lastMessage = fs.existsSync(lastMessagePath)
      ? fs.readFileSync(lastMessagePath, "utf-8").trim()
      : "";

    if (exitCode !== 0) {
      if (!streamOutput) {
        progress.finish();
      }
      const detail = [stderr.trim(), stdout.trim(), lastMessage].find(Boolean) || `exit code ${exitCode}`;
      throw new Error(`codex exec failed: ${detail}\nLog: ${logPath}`);
    }

    if (!streamOutput) {
      progress.finish();
    }

    return { lastMessage, stdout, stderr, logPath };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function runCodexJson<T>(options: CodexTaskOptions): Promise<T> {
  const result = await runCodexTask(options);
  const raw = stripJsonFences(result.lastMessage);

  try {
    return JSON.parse(raw) as T;
  } catch (error: any) {
    throw new Error(`Failed to parse Codex JSON response: ${error.message}\n${raw.slice(0, 400)}`);
  }
}
