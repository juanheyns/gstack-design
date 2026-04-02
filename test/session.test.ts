import { describe, it, expect } from 'bun:test';
import { createSession, readSession, sessionPath } from '../src/session';
import fs from 'fs';

describe('session', () => {
  it('creates and reads a session', () => {
    const session = createSession('resp-123', 'test brief', '/tmp/test.png');
    expect(session.lastResponseId).toBe('resp-123');
    expect(session.originalBrief).toBe('test brief');
    expect(session.feedbackHistory).toEqual([]);

    const reread = readSession(sessionPath(session.id));
    expect(reread.id).toBe(session.id);

    // Cleanup
    try { fs.unlinkSync(sessionPath(session.id)); } catch {}
  });
});
