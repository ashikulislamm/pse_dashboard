import crypto from 'node:crypto';
import { promisify } from 'node:util';
import type { AppRole } from '@/types/database';

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export const SESSION_COOKIE_NAME = 'pse_session';
const DEFAULT_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface JwtHeader {
  alg: 'HS256';
  typ: 'JWT';
}

export interface SessionPayload {
  sub: string; // Standard JWT subject (userId)
  userId: string;
  email: string;
  role: AppRole;
  iat: number; // Issued at (Unix seconds)
  exp: number; // Expiration time (Unix seconds)
}

const DEV_FALLBACK_SECRET = 'pse-dashboard-local-dev-only-secret';
const MIN_SECRET_LENGTH = 32;

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
      throw new Error(
        `AUTH_SECRET must be set to a random value of at least ${MIN_SECRET_LENGTH} characters in production.`,
      );
    }
    return secret;
  }

  return secret || DEV_FALLBACK_SECRET;
}

function signHs256(signingInput: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
}

/** Creates the HS256 JWT stored in the session cookie. */
export function signSessionToken(
  user: { userId: string; email: string; role: AppRole },
  ttlSeconds: number = DEFAULT_SESSION_TTL_SECONDS,
): string {
  const nowSeconds = Math.floor(Date.now() / 1000);

  const header: JwtHeader = {
    alg: 'HS256',
    typ: 'JWT',
  };

  const payload: SessionPayload = {
    sub: user.userId,
    userId: user.userId,
    email: user.email,
    role: user.role,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  const encodedHeader = Buffer.from(JSON.stringify(header), 'utf8').toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = signHs256(signingInput, getAuthSecret());

  return `${signingInput}.${signature}`;
}

/** Verifies the JWT and its expiry. Returns the payload, or null if invalid or expired. */
export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedPayload, signature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSig = signHs256(signingInput, getAuthSecret());

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const header = JSON.parse(
      Buffer.from(encodedHeader, 'base64url').toString('utf8'),
    ) as JwtHeader;
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const parsed = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as SessionPayload;

    if (!parsed.userId || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/** Hashes a password with scrypt (`saltHex:hashHex`). Async so login does not block the event loop. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(password, salt, 64)).toString('hex');
  return `${salt}:${derivedKey}`;
}

/** Checks a password against a `saltHex:hashHex` string. */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;

  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = await scrypt(password, salt, 64);

  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

/** Hash to verify against when the email is unknown, so timing does not reveal which emails exist. */
export const DUMMY_PASSWORD_HASH = `${'00'.repeat(16)}:${'00'.repeat(64)}`;
