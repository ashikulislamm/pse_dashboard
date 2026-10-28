import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/** Normalises to E.164. Assumes Bangladesh (BD) when there is no country code. Returns null if invalid. */
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

/** Trims and lowercases an email. Returns null if empty or invalid. */
export function normalizeEmail(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || !SIMPLE_EMAIL_REGEX.test(normalized)) {
    return null;
  }
  return normalized;
}
