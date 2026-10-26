import { describe, expect, it } from 'vitest';
import {
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

describe('password hashing', () => {
  it('hashes and verifies passwords accurately', () => {
    const hash = hashPassword('StrongPass!2026');
    expect(verifyPassword('StrongPass!2026', hash)).toBe(true);
    expect(verifyPassword('WrongPass', hash)).toBe(false);
  });
});
