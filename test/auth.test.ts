import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { resolveApiKey, resolveProviderConfig, saveConfig } from '../src/auth';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Isolate every test from the user's real ~/.config/design/config.json by
 * pointing DESIGN_HOME at a temp dir and HOME at another temp dir (so the
 * legacy ~/.gstack/openai.json lookup also misses).
 */
let tmpDesignHome: string;
let tmpHome: string;
const saved: Record<string, string | undefined> = {};

function save(key: string) { saved[key] = process.env[key]; }
function restore(key: string) {
  if (saved[key] === undefined) delete process.env[key];
  else process.env[key] = saved[key];
}

beforeEach(() => {
  tmpDesignHome = fs.mkdtempSync(path.join(os.tmpdir(), 'design-test-'));
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'design-home-'));
  for (const k of ['DESIGN_HOME', 'HOME', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'DESIGN_PROVIDER']) save(k);
  process.env.DESIGN_HOME = tmpDesignHome;
  process.env.HOME = tmpHome;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.DESIGN_PROVIDER;
});

afterEach(() => {
  for (const k of ['DESIGN_HOME', 'HOME', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'DESIGN_PROVIDER']) restore(k);
  fs.rmSync(tmpDesignHome, { recursive: true, force: true });
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe('auth', () => {
  it('returns null when nothing is configured', () => {
    expect(resolveProviderConfig()).toBeNull();
    expect(resolveApiKey()).toBeNull();
  });

  it('reads OPENAI_API_KEY env var', () => {
    process.env.OPENAI_API_KEY = 'sk-test-key-12345';
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('openai');
    expect(cfg?.apiKey).toBe('sk-test-key-12345');
  });

  it('GEMINI_API_KEY env var selects gemini provider', () => {
    process.env.GEMINI_API_KEY = 'AIza-test-gemini-key';
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('gemini');
    expect(cfg?.apiKey).toBe('AIza-test-gemini-key');
  });

  it('DESIGN_PROVIDER=gemini picks gemini when both keys are set', () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    process.env.GEMINI_API_KEY = 'AIza-test';
    process.env.DESIGN_PROVIDER = 'gemini';
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('gemini');
    expect(cfg?.apiKey).toBe('AIza-test');
  });

  it('legacy config with only api_key field defaults to openai provider', () => {
    fs.writeFileSync(
      path.join(tmpDesignHome, 'config.json'),
      JSON.stringify({ api_key: 'sk-legacy-12345' }),
    );
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('openai');
    expect(cfg?.apiKey).toBe('sk-legacy-12345');
  });

  it('saveConfig + resolveProviderConfig round trip for gemini', () => {
    saveConfig({ provider: 'gemini', apiKey: 'AIza-round-trip', models: { image: 'gemini-2.5-flash-image' } });
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('gemini');
    expect(cfg?.apiKey).toBe('AIza-round-trip');
    expect(cfg?.models?.image).toBe('gemini-2.5-flash-image');
  });

  it('config file takes precedence over env var', () => {
    process.env.OPENAI_API_KEY = 'sk-env-should-be-ignored';
    saveConfig({ provider: 'gemini', apiKey: 'AIza-file-wins' });
    const cfg = resolveProviderConfig();
    expect(cfg?.provider).toBe('gemini');
    expect(cfg?.apiKey).toBe('AIza-file-wins');
  });
});
