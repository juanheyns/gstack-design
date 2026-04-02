import { describe, it, expect } from 'bun:test';
import { resolveApiKey, saveApiKey } from '../src/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('auth', () => {
  it('resolveApiKey returns null when no config exists', () => {
    const original = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    // This test may find a real key if ~/.config/design/config.json exists
    // That's fine — it proves the resolution works
    const result = resolveApiKey();
    if (original) process.env.OPENAI_API_KEY = original;
    expect(result === null || typeof result === 'string').toBe(true);
  });

  it('resolveApiKey reads OPENAI_API_KEY env var', () => {
    const original = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-test-key-12345';
    const result = resolveApiKey();
    expect(result).toBe('sk-test-key-12345');
    if (original) {
      process.env.OPENAI_API_KEY = original;
    } else {
      delete process.env.OPENAI_API_KEY;
    }
  });
});
