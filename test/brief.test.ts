import { describe, it, expect } from 'bun:test';
import { briefToPrompt, type DesignBrief } from '../src/brief';

describe('brief', () => {
  it('converts a structured brief to a prompt string', () => {
    const brief: DesignBrief = {
      goal: 'Dashboard for metrics',
      audience: 'Engineers',
      style: 'Dark theme, minimal',
      elements: ['chart', 'sidebar'],
      screenType: 'desktop-dashboard',
    };
    const prompt = briefToPrompt(brief);
    expect(prompt).toContain('desktop-dashboard');
    expect(prompt).toContain('Dashboard for metrics');
    expect(prompt).toContain('chart, sidebar');
    expect(prompt).toContain('production UI');
  });
});
