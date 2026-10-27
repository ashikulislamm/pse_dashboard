import { describe, expect, it, vi } from 'vitest';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './session';

describe('JWT session token signing and verification', () => {
  it('signs and verifies a standard 3-part HS256 JWT', () => {
    const token = signSessionToken({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'safina@pse.org',
      role: 'target_manager',
    });

    // Standard JWT format: header.payload.signature
    expect(token.split('.')).toHaveLength(3);

    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload?.userId).toBe('11111111-1111-1111-1111-111111111111');
    expect(payload?.email).toBe('safina@pse.org');
    expect(payload?.role).toBe('target_manager');
  });

  it('rejects tampered JWT tokens', () => {
    const token = signSessionToken({
      userId: '11111111-1111-1111-1111-111111111111',
      email: 'safina@pse.org',
      role: 'member',
    });
    expect(verifySessionToken(`${token}tampered`)).toBeNull();
  });

  it('rejects expired JWT tokens', () => {
    const expired = signSessionToken(
      {
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'safina@pse.org',
        role: 'member',
      },
      -10,
    );
    expect(verifySessionToken(expired)).toBeNull();
  });
});

describe('AUTH_SECRET in production', () => {
  it('refuses to sign tokens without a strong secret', () => {
    const user = { userId: 'u', email: 'a@b.c', role: 'member' as const };
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('AUTH_SECRET', '');
    expect(() => signSessionToken(user)).toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'too-short');
    expect(() => signSessionToken(user)).toThrow(/AUTH_SECRET/);
    vi.stubEnv('AUTH_SECRET', 'x'.repeat(40));
    expect(() => signSessionToken(user)).not.toThrow();
    vi.unstubAllEnvs();
  });
});

describe('password hashing', () => {
  it('hashes and verifies passwords accurately', async () => {
    const hash = await hashPassword('StrongPass!2026');
    expect(await verifyPassword('StrongPass!2026', hash)).toBe(true);
    expect(await verifyPassword('WrongPass', hash)).toBe(false);
  });

  it('never matches the dummy hash used for unknown emails', async () => {
    expect(await verifyPassword('anything', DUMMY_PASSWORD_HASH)).toBe(false);
  });
});
