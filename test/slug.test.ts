import { describe, it, expect } from 'bun:test';
import { projectSlug } from '../src/slug';

describe('slug', () => {
  it('returns a non-empty string', () => {
    const slug = projectSlug();
    expect(typeof slug).toBe('string');
    expect(slug.length).toBeGreaterThan(0);
  });

  it('contains only safe characters', () => {
    const slug = projectSlug();
    expect(slug).toMatch(/^[a-zA-Z0-9._-]+$/);
  });
});
