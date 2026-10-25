/**
 * Temporary local storage for the @username chosen during sign-up.
 *
 * Firebase Auth profiles only hold displayName and photoURL, and the database
 * that will own usernames (and enforce uniqueness globally) arrives in a later
 * iteration. Until then the username is kept on this device so the account
 * screen can show it. This is explicitly a bridge, not the source of truth.
 */

const KEY_PREFIX = 'lecvy.username.'

export function saveUsernameLocally(uid: string, username: string): void {
  try {
    localStorage.setItem(KEY_PREFIX + uid, username)
  } catch {
    // Storage can be unavailable (private mode); the sign-up still succeeds.
  }
}

export function readUsernameLocally(uid: string): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + uid)
  } catch {
    return null
  }
}
