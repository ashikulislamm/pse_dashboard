import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * Normalizes a raw phone number to E.164 format (e.g., "+8801712345678").
 * Defaults to Bangladesh ('BD') when no country code prefix is supplied.
 * Returns null if the input cannot be parsed as a valid phone number.
 */
export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = 'BD',
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    return null;
  }

  return parsed.number;
}

const SIMPLE_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes an email address (trim + lowercase).
 * Returns null if the email is empty or structurally invalid.
 */
export function normalizeEmail(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !SIMPLE_EMAIL_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}
