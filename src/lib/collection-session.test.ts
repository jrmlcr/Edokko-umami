import { afterEach, describe, expect, test, vi } from 'vitest';
import { resolveCollectionSession, resolveIdentifiedSession } from './collection-session';

vi.hoisted(() => {
  process.env.APP_SECRET ??= 'test-app-secret';
});

const base = {
  sourceId: '2e2fc91f-77a7-4e5d-a7b1-18a74c67b4e0',
  ip: '192.0.2.1',
  userAgent: 'Desktop Browser',
  createdAt: new Date('2026-10-15T12:00:00Z'),
};

const sessionId = (overrides: Partial<Parameters<typeof resolveCollectionSession>[0]> = {}) =>
  resolveCollectionSession({ ...base, ...overrides }).sessionId;

afterEach(() => {
  delete process.env.ENABLE_CLIENT_SALT;
});

describe('client salt', () => {
  test('is ignored unless ENABLE_CLIENT_SALT is set', () => {
    expect(sessionId({ salt: '2026-10-15' })).toBe(sessionId());
  });

  describe('with ENABLE_CLIENT_SALT', () => {
    test('leaves unsalted session IDs unchanged', () => {
      const unsalted = sessionId();
      process.env.ENABLE_CLIENT_SALT = '1';

      expect(sessionId()).toBe(unsalted);
      expect(sessionId({ salt: '' })).toBe(unsalted);
    });

    test('keeps the same salt on the same session and splits different salts', () => {
      process.env.ENABLE_CLIENT_SALT = '1';

      expect(sessionId({ salt: '2026-10-15' })).toBe(sessionId({ salt: '2026-10-15' }));
      expect(sessionId({ salt: '2026-10-15' })).not.toBe(sessionId({ salt: '2026-10-16' }));
      expect(sessionId({ salt: '2026-10-15' })).not.toBe(sessionId());
    });

    test('still rotates when the server salt period rolls over', () => {
      process.env.ENABLE_CLIENT_SALT = '1';
      const salt = 'fixed-client-value';

      expect(sessionId({ salt })).not.toBe(
        sessionId({ salt, createdAt: new Date('2026-11-15T12:00:00Z') }),
      );
    });
  });
});

describe('resolveIdentifiedSession', () => {
  const anonymous = resolveCollectionSession(base);
  const cache = {
    websiteId: base.sourceId,
    sessionId: anonymous.sessionId,
    visitId: anonymous.visitId,
    iat: Math.floor(Date.now() / 1000),
  };
  const identified = (claimSession: () => Promise<boolean>) =>
    resolveIdentifiedSession({
      ...base,
      websiteId: base.sourceId,
      distinctId: 'user-1',
      cache,
      claimSession,
    });

  test('reuses the anonymous session once the identity claims it', async () => {
    const session = await identified(async () => true);

    expect(session.sessionId).toBe(anonymous.sessionId);
    expect(session.visitId).toBe(anonymous.visitId);
    expect(session.sessionDrift).toBe(false);
  });

  test('starts an identified session when the claim is refused', async () => {
    const session = await identified(async () => false);

    expect(session.sessionId).toBe(sessionId({ distinctId: 'user-1' }));
  });

  test('starts an identified session when the claim fails', async () => {
    const session = await identified(async () => {
      throw new Error('unavailable');
    });

    expect(session.sessionId).toBe(sessionId({ distinctId: 'user-1' }));
  });
});

// Edokko #322: the CNIL's condition for audience measurement without consent.
describe('the IP in the session identifier', () => {
  test('two addresses differing only in their last byte make the same session', () => {
    const a = resolveCollectionSession({ ...base, ip: '203.0.113.42' });
    const b = resolveCollectionSession({ ...base, ip: '203.0.113.7' });
    expect(a.sessionId).toBe(b.sessionId);
  });

  test('two IPv6 addresses sharing their first 48 bits make the same session', () => {
    const a = resolveCollectionSession({ ...base, ip: '2001:db8:85a3:8d3:1319:8a2e:370:7348' });
    const b = resolveCollectionSession({ ...base, ip: '2001:db8:85a3:ffff::1' });
    expect(a.sessionId).toBe(b.sessionId);
  });

  test('another network makes another session', () => {
    const a = resolveCollectionSession({ ...base, ip: '203.0.113.42' });
    const b = resolveCollectionSession({ ...base, ip: '203.0.114.42' });
    expect(a.sessionId).not.toBe(b.sessionId);
  });
});
