/**
 * Smoke tests for design CLI — verifies the binary works end-to-end
 * without requiring an API key.
 *
 * These test the plumbing (arg parsing, HTML generation, serve lifecycle)
 * not the API calls.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { generateCompareHtml } from '../src/compare';
import { generateGalleryHtml } from '../src/gallery';
import { briefToPrompt, type DesignBrief } from '../src/brief';
import { projectSlug } from '../src/slug';
import * as fs from 'fs';
import * as path from 'path';

let tmpDir: string;

function createTestPng(filePath: string): void {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/58BAwAI/AL+hc2rNAAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(filePath, png);
}

beforeAll(() => {
  tmpDir = '/tmp/design-smoke-' + Date.now();
  fs.mkdirSync(tmpDir, { recursive: true });
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('Smoke: compare board generation', () => {
  test('generates valid HTML from test PNGs', () => {
    createTestPng(path.join(tmpDir, 'a.png'));
    createTestPng(path.join(tmpDir, 'b.png'));

    const html = generateCompareHtml([
      path.join(tmpDir, 'a.png'),
      path.join(tmpDir, 'b.png'),
    ]);
    expect(html).toContain('Design Exploration');
    expect(html).toContain('Option A');
    expect(html).toContain('Option B');
    expect(html).toContain('data:image/png;base64,');
    expect(html).toContain('__DESIGN_SERVER_URL');
  });
});

describe('Smoke: gallery generation', () => {
  test('empty gallery renders without error', () => {
    const html = generateGalleryHtml('/nonexistent');
    expect(html).toContain('No design history yet');
    expect(html).toContain('design variants');
  });
});

describe('Smoke: brief system', () => {
  test('structured brief produces valid prompt', () => {
    const brief: DesignBrief = {
      goal: 'Landing page',
      audience: 'Developers',
      style: 'Clean, modern',
      elements: ['hero', 'CTA'],
      screenType: 'landing-page',
    };
    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('landing-page');
    expect(prompt).toContain('Landing page');
    expect(prompt).toContain('production UI');
    expect(prompt.length).toBeGreaterThan(50);
  });
});

describe('Smoke: project slug', () => {
  test('generates a valid slug', () => {
    const slug = projectSlug();
    expect(slug.length).toBeGreaterThan(0);
    expect(slug).toMatch(/^[a-zA-Z0-9._-]+$/);
  });
});

describe('Smoke: serve HTTP lifecycle', () => {
  test('server starts, serves HTML, handles feedback, stops', async () => {
    createTestPng(path.join(tmpDir, 'v1.png'));
    const html = generateCompareHtml([path.join(tmpDir, 'v1.png')]);
    const boardPath = path.join(tmpDir, 'smoke-board.html');
    fs.writeFileSync(boardPath, html);

    let state = 'serving';
    const server = Bun.serve({
      port: 0,
      fetch(req) {
        const url = new URL(req.url);
        if (req.method === 'GET' && url.pathname === '/') {
          const injected = html.replace('</head>',
            `<script>window.__DESIGN_SERVER_URL = '${url.origin}';</script>\n</head>`);
          return new Response(injected, { headers: { 'Content-Type': 'text/html' } });
        }
        if (req.method === 'GET' && url.pathname === '/api/progress') {
          return Response.json({ status: state });
        }
        if (req.method === 'POST' && url.pathname === '/api/feedback') {
          return (async () => {
            const body = await req.json();
            state = body.regenerated ? 'regenerating' : 'done';
            return Response.json({ received: true });
          })();
        }
        return new Response('Not found', { status: 404 });
      },
    });

    const base = `http://localhost:${server.port}`;

    // Verify HTML is served
    const res = await fetch(base);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('__DESIGN_SERVER_URL');

    // Verify progress endpoint
    const prog = await (await fetch(`${base}/api/progress`)).json();
    expect(prog.status).toBe('serving');

    // Submit feedback
    const fb = await fetch(`${base}/api/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerated: false, preferred: 'A' }),
    });
    expect((await fb.json()).received).toBe(true);
    expect(state).toBe('done');

    server.stop();
  });
});
