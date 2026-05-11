/**
 * Codex backend readiness checks.
 *
 * The design CLI no longer talks to model APIs directly. Model-backed commands
 * shell out to `codex exec`, so the only auth requirement is that Codex is
 * installed and logged in.
 */

import { spawnSync } from "child_process";

export interface CodexStatus {
  available: boolean;
  loggedIn: boolean;
  message: string;
}

function codexBin(): string {
  return process.env.DESIGN_CODEX_BIN || "codex";
}

export function getCodexStatus(): CodexStatus {
  const result = spawnSync(codexBin(), ["login", "status"], {
    encoding: "utf-8",
    env: process.env,
  });

  if (result.error) {
    const error = result.error as NodeJS.ErrnoException;
    if (error.code === "ENOENT") {
      return {
        available: false,
        loggedIn: false,
        message: "Codex CLI not found on PATH.",
      };
    }

    return {
      available: false,
      loggedIn: false,
      message: error.message,
    };
  }

  const output = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
  const loggedIn = result.status === 0 && /logged in/i.test(output);

  return {
    available: true,
    loggedIn,
    message: output || (loggedIn ? "Logged in." : "Not logged in."),
  };
}

export function requireCodexAuth(): void {
  const status = getCodexStatus();

  if (!status.available) {
    console.error("Codex CLI is required for design generation.");
    console.error("");
    console.error("Install Codex and ensure `codex` is on your PATH.");
    console.error("Then run: codex login");
    console.error("");
    console.error(status.message);
    process.exit(1);
  }

  if (!status.loggedIn) {
    console.error("Codex is installed but not logged in.");
    console.error("");
    console.error("Run: codex login");
    console.error("Then re-run your design command.");
    console.error("");
    if (status.message) {
      console.error(status.message);
    }
    process.exit(1);
  }
}
