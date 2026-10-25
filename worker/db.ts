import type { Env } from './config'

/**
 * Schema is applied lazily (and idempotently) on the first API request of each
 * isolate. Freebuff Sites owns the D1 instance, so there is no separate
 * migration runner with credentials — the statements below are the migration,
 * mirrored in `migrations/0001_init.sql`.
 */
export const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT NOT NULL,
    email TEXT,
    sign_in_provider TEXT,
    display_name TEXT,
    username TEXT,
    username_normalized TEXT,
    avatar_key TEXT,
    photo_skipped INTEGER NOT NULL DEFAULT 0,
    date_of_birth TEXT,
    is_minor INTEGER NOT NULL DEFAULT 0,
    onboarding_completed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (firebase_uid)
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
     ON profiles (username_normalized)
     WHERE username_normalized IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS profiles_uid_idx ON profiles (firebase_uid)`,
]

let schemaReady: Promise<void> | null = null

export function ensureSchema(env: Env): Promise<void> {
  if (!schemaReady) {
    schemaReady = env.DB.batch(SCHEMA_STATEMENTS.map((sql) => env.DB.prepare(sql)))
      .then(() => undefined)
      .catch((error: unknown) => {
        schemaReady = null
        throw error
      })
  }
  return schemaReady
}

export type ProfileRow = {
  id: number
  firebase_uid: string
  email: string | null
  sign_in_provider: string | null
  display_name: string | null
  username: string | null
  username_normalized: string | null
  avatar_key: string | null
  photo_skipped: number
  date_of_birth: string | null
  is_minor: number
  onboarding_completed: number
  created_at: string
  updated_at: string
}

export const PROFILE_COLUMNS = `id, firebase_uid, email, sign_in_provider, display_name,
  username, username_normalized, avatar_key, photo_skipped, date_of_birth, is_minor,
  onboarding_completed, created_at, updated_at`

const now = () => new Date().toISOString()

export async function ensureProfile(
  env: Env,
  user: { uid: string; email: string | null; provider: string | null; name: string | null },
): Promise<ProfileRow> {
  const timestamp = now()
  await env.DB.prepare(
    `INSERT INTO profiles (firebase_uid, email, sign_in_provider, display_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (firebase_uid) DO NOTHING`,
  )
    .bind(user.uid, user.email, user.provider, user.name, timestamp, timestamp)
    .run()

  const row = await getProfile(env, user.uid)
  if (!row) throw new Error('profile_missing_after_insert')
  return row
}

export async function getProfile(env: Env, uid: string): Promise<ProfileRow | null> {
  const row = await env.DB.prepare(
    `SELECT ${PROFILE_COLUMNS} FROM profiles WHERE firebase_uid = ?`,
  )
    .bind(uid)
    .first<ProfileRow>()
  return row ?? null
}

export async function setDisplayName(env: Env, uid: string, value: string): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET display_name = ?, updated_at = ? WHERE firebase_uid = ?`,
  )
    .bind(value, now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function isUsernameTaken(
  env: Env,
  normalized: string,
  exceptUid: string,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT 1 AS hit FROM profiles WHERE username_normalized = ? AND firebase_uid != ? LIMIT 1`,
  )
    .bind(normalized, exceptUid)
    .first<{ hit: number }>()
  return Boolean(row)
}

export async function setUsername(
  env: Env,
  uid: string,
  raw: string,
  normalized: string,
): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET username = ?, username_normalized = ?, updated_at = ?
     WHERE firebase_uid = ?`,
  )
    .bind(raw, normalized, now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function setAvatar(env: Env, uid: string, key: string): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET avatar_key = ?, photo_skipped = 0, updated_at = ?
     WHERE firebase_uid = ?`,
  )
    .bind(key, now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function skipPhoto(env: Env, uid: string): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET photo_skipped = 1, updated_at = ? WHERE firebase_uid = ?`,
  )
    .bind(now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function setDateOfBirth(
  env: Env,
  uid: string,
  dateOfBirth: string,
  isMinor: boolean,
): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET date_of_birth = ?, is_minor = ?, updated_at = ?
     WHERE firebase_uid = ?`,
  )
    .bind(dateOfBirth, isMinor ? 1 : 0, now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function markOnboardingComplete(env: Env, uid: string): Promise<ProfileRow> {
  await env.DB.prepare(
    `UPDATE profiles SET onboarding_completed = 1, updated_at = ?
     WHERE firebase_uid = ? AND onboarding_completed = 0`,
  )
    .bind(now(), uid)
    .run()
  return mustProfile(env, uid)
}

export async function getAvatarKey(env: Env, uid: string): Promise<string | null> {
  const row = await env.DB.prepare(
    `SELECT avatar_key FROM profiles WHERE firebase_uid = ?`,
  )
    .bind(uid)
    .first<{ avatar_key: string | null }>()
  return row?.avatar_key ?? null
}

export async function getPublicProfile(
  env: Env,
  normalizedUsername: string,
): Promise<Pick<ProfileRow, 'firebase_uid' | 'display_name' | 'username' | 'avatar_key' | 'created_at' | 'updated_at'> | null> {
  const row = await env.DB.prepare(
    `SELECT firebase_uid, display_name, username, avatar_key, created_at, updated_at
     FROM profiles WHERE username_normalized = ? AND onboarding_completed = 1 LIMIT 1`,
  )
    .bind(normalizedUsername)
    .first<Pick<ProfileRow, 'firebase_uid' | 'display_name' | 'username' | 'avatar_key' | 'created_at' | 'updated_at'>>()
  return row ?? null
}

async function mustProfile(env: Env, uid: string): Promise<ProfileRow> {
  const row = await getProfile(env, uid)
  if (!row) throw new Error('profile_missing')
  return row
}

/* -------------------------------------------------------------------------- */
/* Onboarding state                                                            */
/* -------------------------------------------------------------------------- */

export type OnboardingStep = 'name' | 'username' | 'photo' | 'dob' | 'complete'

const REQUIRED_STEPS: OnboardingStep[] = ['name', 'username', 'photo', 'dob']

export function deriveOnboarding(row: ProfileRow): {
  nextStep: OnboardingStep
  completedSteps: OnboardingStep[]
  canComplete: boolean
} {
  const completedSteps: OnboardingStep[] = []
  if (row.display_name) completedSteps.push('name')
  if (row.username) completedSteps.push('username')
  if (row.avatar_key || row.photo_skipped) completedSteps.push('photo')
  if (row.date_of_birth) completedSteps.push('dob')

  const nextStep = REQUIRED_STEPS.find((step) => !completedSteps.includes(step)) ?? 'complete'
  return {
    nextStep,
    completedSteps,
    canComplete: Boolean(row.display_name && row.username && row.date_of_birth),
  }
}

/** Owner-only view. Includes private fields (never returned by public routes). */
export function toOwnerProfile(row: ProfileRow) {
  return {
    uid: row.firebase_uid,
    email: row.email,
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_key
      ? `/api/avatar/${encodeURIComponent(row.firebase_uid)}?v=${encodeURIComponent(row.updated_at)}`
      : null,
    dateOfBirth: row.date_of_birth,
    onboardingCompleted: Boolean(row.onboarding_completed),
  }
}

export function toPublicProfile(row: {
  display_name: string | null
  username: string | null
  avatar_key: string | null
  firebase_uid: string
  updated_at: string
}) {
  return {
    displayName: row.display_name,
    username: row.username,
    avatarUrl: row.avatar_key
      ? `/api/avatar/${encodeURIComponent(row.firebase_uid)}?v=${encodeURIComponent(row.updated_at)}`
      : null,
  }
}
