/**
 * Validation rules shared by the browser app and the Cloudflare Worker API so
 * both sides always agree. The server is authoritative; the client mirrors
 * these for instant feedback.
 */

export const MIN_AGE_YEARS = 13
export const MAX_AGE_YEARS = 120

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[a-z0-9._]+$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export type FieldResult = { ok: true; value: string } | { ok: false; message: string }

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase()
}

export function validateEmail(raw: string): FieldResult {
  const value = raw.trim()
  if (!value) return { ok: false, message: 'Enter your email address.' }
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) {
    return { ok: false, message: 'Enter a valid email address.' }
  }
  return { ok: true, value }
}

export function validatePassword(raw: string): FieldResult {
  if (!raw) return { ok: false, message: 'Enter your password.' }
  if (raw.length < 6) {
    return { ok: false, message: 'Password must be at least 6 characters.' }
  }
  return { ok: true, value: raw }
}

export function validateNewPassword(raw: string): FieldResult {
  if (!raw) return { ok: false, message: 'Choose a password.' }
  if (raw.length < 6) return { ok: false, message: 'Use at least 6 characters.' }
  return { ok: true, value: raw }
}

export function validateDisplayName(raw: string): FieldResult {
  const value = raw.trim().replace(/\s+/g, ' ')
  if (!value) return { ok: false, message: 'Enter a display name.' }
  if (value.length < 2) {
    return { ok: false, message: 'Display name must be at least 2 characters.' }
  }
  if (value.length > 30) {
    return { ok: false, message: 'Display name must be 30 characters or fewer.' }
  }
  return { ok: true, value }
}

export function validateUsername(raw: string): FieldResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, message: 'Choose a username.' }
  if (/\s/.test(trimmed)) {
    return { ok: false, message: 'Usernames cannot contain spaces.' }
  }
  if (trimmed.length < USERNAME_MIN) {
    return { ok: false, message: `Username must be at least ${USERNAME_MIN} characters.` }
  }
  if (trimmed.length > USERNAME_MAX) {
    return { ok: false, message: `Username must be ${USERNAME_MAX} characters or fewer.` }
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return { ok: false, message: 'Use only letters, numbers, dots, and underscores.' }
  }
  if (/^[._]/.test(trimmed)) {
    return { ok: false, message: 'Start with a letter or number.' }
  }
  return { ok: true, value: normalizeUsername(trimmed) }
}

export type DateOfBirthResult =
  | { ok: true; value: string; age: number; isMinor: boolean }
  | { ok: false; message: string }

/**
 * Validates a `YYYY-MM-DD` date of birth. Rejects malformed dates, dates in the
 * future, implausible ages, and anyone below the minimum age.
 */
export function validateDateOfBirth(raw: string, today = new Date()): DateOfBirthResult {
  const value = raw.trim()
  if (!value) return { ok: false, message: 'Enter your date of birth.' }
  if (!DATE_PATTERN.test(value)) {
    return { ok: false, message: 'Enter a valid date of birth.' }
  }

  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { ok: false, message: 'Enter a valid date of birth.' }
  }

  const todayUtc = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  if (parsed.getTime() > todayUtc.getTime()) {
    return { ok: false, message: 'Date of birth cannot be in the future.' }
  }

  let age = todayUtc.getUTCFullYear() - year
  const birthdayThisYear = Date.UTC(
    todayUtc.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
  )
  if (todayUtc.getTime() < birthdayThisYear) age -= 1

  if (age < 0) {
    return { ok: false, message: 'Date of birth cannot be in the future.' }
  }
  if (age < MIN_AGE_YEARS) {
    return {
      ok: false,
      message: `You must be at least ${MIN_AGE_YEARS} years old to use Lecvy.`,
    }
  }
  if (age > MAX_AGE_YEARS) {
    return { ok: false, message: 'Enter a valid date of birth.' }
  }

  return { ok: true, value, age, isMinor: age < 18 }
}
