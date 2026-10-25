import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

/**
 * Firebase web configuration for Lecvy.
 *
 * These values are public by design (they ship in the browser bundle) and are
 * read from the environment so no credentials are ever hardcoded. See
 * `.env.example` for the full list and where to find each value.
 */
const env = import.meta.env as Record<string, string | undefined>

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? '',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.VITE_FIREBASE_APP_ID ?? '',
}

/** Keys without which Firebase Authentication cannot start. */
const REQUIRED_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'] as const

/** Human-friendly description of anything missing, empty when fully configured. */
export function missingConfigKeys(): string[] {
  const labels: Record<string, string> = {
    apiKey: 'VITE_FIREBASE_API_KEY',
    authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
    projectId: 'VITE_FIREBASE_PROJECT_ID',
    appId: 'VITE_FIREBASE_APP_ID',
  }
  return REQUIRED_KEYS.filter((key) => !firebaseConfig[key]).map((key) => labels[key])
}

/**
 * False until the Firebase web config has been supplied. Auth actions stay
 * inert (and say so) instead of crashing when this is false.
 */
export const isFirebaseConfigured = missingConfigKeys().length === 0

let app: FirebaseApp | null = null
let authInstance: Auth | null = null

if (isFirebaseConfigured) {
  app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig)
  authInstance = getAuth(app)
}

/**
 * Throws when Firebase is not configured yet — callers surface a setup notice
 * instead of a generic failure.
 */
export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    throw new Error(`FIREBASE_NOT_CONFIGURED: ${missingConfigKeys().join(', ')}`)
  }
  return authInstance
}
