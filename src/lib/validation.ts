/**
 * Client-side validation for the Lecvy authentication forms.
 *
 * Rules are intentionally shared so every screen reports the same wording.
 * Uniqueness of a username needs a database lookup and is enforced when the
 * backend lands; format validation lives here.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const USERNAME_PATTERN = /^[a-z0-9._]+$/i

export type FieldResult = { ok: true; value: string } | { ok: false; message: string }

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
  if (raw.length < 6) {
    return { ok: false, message: 'Use at least 6 characters.' }
  }
  return { ok: true, value: raw }
}

export function validateDisplayName(raw: string): FieldResult {
  const value = raw.trim()
  if (!value) return { ok: false, message: 'Enter a display name.' }
  if (value.length < 2) {
    return { ok: false, message: 'Display name must be at least 2 characters.' }
  }
  if (value.length > 30) {
    return { ok: false, message: 'Display name must be 30 characters or fewer.' }
  }
  return { ok: true, value }
}

/**
 * Usernames are unique (enforced by the backend), contain no spaces, and are
 * stored lowercased so @Name and @name resolve to the same account.
 */
export function validateUsername(raw: string): FieldResult {
  const trimmed = raw.trim()
  if (!trimmed) return { ok: false, message: 'Choose a username.' }
  if (/\s/.test(trimmed)) {
    return { ok: false, message: 'Usernames cannot contain spaces.' }
  }
  if (trimmed.length < 3) {
    return { ok: false, message: 'Username must be at least 3 characters.' }
  }
  if (trimmed.length > 20) {
    return { ok: false, message: 'Username must be 20 characters or fewer.' }
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return {
      ok: false,
      message: 'Use only letters, numbers, dots, and underscores.',
    }
  }
  if (/^[._]/.test(trimmed)) {
    return { ok: false, message: 'Start with a letter or number.' }
  }
  return { ok: true, value: trimmed.toLowerCase() }
}
