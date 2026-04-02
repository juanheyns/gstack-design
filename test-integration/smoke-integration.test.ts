/**
 * Integration smoke tests — require both `design` and `browse` binaries.
 *
 * Tests the full feedback pipeline:
 *   Browser click → JS fetch() → HTTP POST → server writes file → agent polls file
 *
 * These are post-install validation tests. They skip gracefully if `browse`
 * is not available on PATH.
 *
 * Run: bun run smoke:integration
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateCompareHtml } from '../src/compare';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// ─── Pre-flight: check if browse is available ────────────────────

let browseBin: string | null = null;

try {
  browseBin = execSync('which browse', { encoding: 'utf-8', timeout: 5000 }).trim();
  if (!browseBin || !fs.existsSync(browseBin)) browseBin = null;
} catch {
  browseBin = null;
}

const hasBrowse = browseBin !== null;

if (!hasBrowse) {
  console.log('SKIP: browse binary not found on PATH — integration smoke tests require both design and browse.');
  console.log('Install browse: brew tap juanheyns/gstack && brew install browse');
}

// ─── Helpers ─────────────────────────────────────────────────────

function createTestPng(filePath: string): void {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(filePath, png);
}

function browseExec(cmd: string): string {
  return execSync(`${browseBin} ${cmd}`, {
    encoding: 'utf-8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
}

// ─── Test setup ──────────────────────────────────────────────────

let tmpDir: string;
let boardHtmlPath: string;
let server: ReturnType<typeof Bun.serve>;
let baseUrl: string;
let serverState: string;

const describeIntegration = hasBrowse ? describe : describe.skip;

describeIntegration('Integration: browser click → feedback.json on disk', () => {
  beforeAll(() => {
    tmpDir = '/tmp/design-integration-' + Date.now();
    fs.mkdirSync(tmpDir, { recursive: true });

    createTestPng(path.join(tmpDir, 'variant-A.png'));
    createTestPng(path.join(tmpDir, 'variant-B.png'));
    createTestPng(path.join(tmpDir, 'variant-C.png'));

    const html = generateCompareHtml([
      path.join(tmpDir, 'variant-A.png'),
      path.join(tmpDir, 'variant-B.png'),
      path.join(tmpDir, 'variant-C.png'),
    ]);
    boardHtmlPath = path.join(tmpDir, 'design-board.html');
    fs.writeFileSync(boardHtmlPath, html);

    serverState = 'serving';
    let currentHtml = html;

    server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);

        if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
          const injected = currentHtml.replace(
            '</head>',
            `<script>window.__DESIGN_SERVER_URL = '${url.origin}';</script>\n</head>`
          );
          return new Response(injected, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          });
        }

        if (req.method === 'GET' && url.pathname === '/api/progress') {
          return Response.json({ status: serverState });
        }

        if (req.method === 'POST' && url.pathname === '/api/feedback') {
          return (async () => {
            let body: any;
            try { body = await req.json(); } catch {
              return Response.json({ error: 'Invalid JSON' }, { status: 400 });
            }
            const isSubmit = body.regenerated === false;
            const feedbackFile = isSubmit ? 'feedback.json' : 'feedback-pending.json';
            fs.writeFileSync(path.join(tmpDir, feedbackFile), JSON.stringify(body, null, 2));
            if (isSubmit) {
              serverState = 'done';
              return Response.json({ received: true, action: 'submitted' });
            }
            serverState = 'regenerating';
            return Response.json({ received: true, action: 'regenerate' });
          })();
        }

        if (req.method === 'POST' && url.pathname === '/api/reload') {
          return (async () => {
            const body = await req.json();
            if (body.html && fs.existsSync(body.html)) {
              currentHtml = fs.readFileSync(body.html, 'utf-8');
              serverState = 'serving';
              return Response.json({ reloaded: true });
            }
            return Response.json({ error: 'Not found' }, { status: 400 });
          })();
        }

        return new Response('Not found', { status: 404 });
      },
    });

    baseUrl = `http://localhost:${server.port}`;

    // Start browse and navigate to the board
    browseExec(`goto ${baseUrl}`);
  });

  afterAll(() => {
    try { server.stop(); } catch {}
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('__DESIGN_SERVER_URL is injected into the page', () => {
    const result = browseExec('js "!!window.__DESIGN_SERVER_URL"');
    expect(result).toBe('true');
  });

  test('clicking Submit writes feedback.json to disk', async () => {
    const feedbackPath = path.join(tmpDir, 'feedback.json');
    if (fs.existsSync(feedbackPath)) fs.unlinkSync(feedbackPath);
    serverState = 'serving';

    // Navigate fresh
    browseExec(`goto ${baseUrl}`);

    // Pick variant A
    browseExec('js "document.querySelectorAll(\\"input[name=\\\\\\\"preferred\\\\\\\"]\\")" [0].click()');

    // Add overall feedback
    browseExec('js "document.getElementById(\\"overall-feedback\\").value = \\"Ship variant A\\""');

    // Click submit
    browseExec('js "document.getElementById(\\"submit-btn\\").click()"');

    // Wait for async POST
    await new Promise(r => setTimeout(r, 500));

    // Verify feedback.json exists on disk
    expect(fs.existsSync(feedbackPath)).toBe(true);

    const feedback = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'));
    expect(feedback.preferred).toBe('A');
    expect(feedback.regenerated).toBe(false);
  });

  test('clicking Regenerate writes feedback-pending.json to disk', async () => {
    const pendingPath = path.join(tmpDir, 'feedback-pending.json');
    if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
    serverState = 'serving';

    // Navigate fresh
    browseExec(`goto ${baseUrl}`);

    // Click "Totally different" chiclet then Regenerate
    browseExec('js "document.querySelector(\\".regen-chiclet[data-action=\\\\\\\"different\\\\\\\"]\\").click()"');
    browseExec('js "document.getElementById(\\"regen-btn\\").click()"');

    await new Promise(r => setTimeout(r, 500));

    expect(fs.existsSync(pendingPath)).toBe(true);
    const pending = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
    expect(pending.regenerated).toBe(true);
    expect(pending.regenerateAction).toBe('different');
  });

  test('full round-trip: regenerate → reload → submit', async () => {
    const pendingPath = path.join(tmpDir, 'feedback-pending.json');
    const feedbackPath = path.join(tmpDir, 'feedback.json');
    if (fs.existsSync(pendingPath)) fs.unlinkSync(pendingPath);
    if (fs.existsSync(feedbackPath)) fs.unlinkSync(feedbackPath);
    serverState = 'serving';

    browseExec(`goto ${baseUrl}`);

    // Step 1: User regenerates
    browseExec('js "document.querySelector(\\".regen-chiclet[data-action=\\\\\\\"match\\\\\\\"]\\").click()"');
    browseExec('js "document.getElementById(\\"regen-btn\\").click()"');
    await new Promise(r => setTimeout(r, 500));

    expect(fs.existsSync(pendingPath)).toBe(true);
    fs.unlinkSync(pendingPath);

    // Step 2: Agent generates new board and reloads
    const newBoardPath = path.join(tmpDir, 'board-v2.html');
    const newHtml = generateCompareHtml([
      path.join(tmpDir, 'variant-A.png'),
      path.join(tmpDir, 'variant-B.png'),
    ]);
    fs.writeFileSync(newBoardPath, newHtml);

    const reloadRes = await fetch(`${baseUrl}/api/reload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: newBoardPath }),
    });
    expect((await reloadRes.json()).reloaded).toBe(true);

    // Step 3: User submits on round 2
    browseExec(`goto ${baseUrl}`);
    browseExec('js "document.querySelectorAll(\\"input[name=\\\\\\\"preferred\\\\\\\"]\\")" [1].click()');
    browseExec('js "document.getElementById(\\"submit-btn\\").click()"');
    await new Promise(r => setTimeout(r, 500));

    expect(fs.existsSync(feedbackPath)).toBe(true);
    const final = JSON.parse(fs.readFileSync(feedbackPath, 'utf-8'));
    expect(final.preferred).toBe('B');
    expect(final.regenerated).toBe(false);
  });
});
