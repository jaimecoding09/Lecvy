/** Firebase project that issues the ID tokens this API trusts. */
export const FIREBASE_PROJECT_ID = 'lecvy-ac3cb'

/** Profile photo limits. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type Env = {
  DB: D1Database
  FILES: R2Bucket
  ASSETS: Fetcher
  /** Only set by the local Wrangler config — never present in production. */
  DEV_AUTH_BYPASS?: string
}
