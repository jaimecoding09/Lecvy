-- Lecvy — initial profile schema (D1)
-- Applied idempotently by the Worker on first request; kept here as the
-- canonical migration record.

CREATE TABLE IF NOT EXISTS profiles (
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
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON profiles (username_normalized)
  WHERE username_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_uid_idx ON profiles (firebase_uid);
