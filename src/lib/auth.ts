import {
  OAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type Auth,
  type User,
} from 'firebase/auth'

import { getFirebaseAuth, isFirebaseConfigured } from './firebase'
import {
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from './validation'

/**
 * Every auth function resolves to one of three outcomes so screens can render
 * success, error, and cancelled states without string-matching exceptions.
 */
export type AuthOutcome =
  | { status: 'success'; user: User | null; verified: boolean }
  | { status: 'cancelled'; message: string }
  | { status: 'error'; message: string; code?: string }

const CANCELLED_MESSAGE = 'Sign-in was cancelled. You can try again any time.'

const SETUP_MESSAGE = () =>
  'Firebase is not configured yet. Add the web config to .env (see .env.example) and restart the dev server.'

/** Maps Firebase error codes to friendly, actionable copy. */
export function messageForAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match. Check your details and try again.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/missing-password':
      return 'Enter your password.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try logging in instead.'
    case 'auth/weak-password':
      return 'That password is too weak. Use at least 6 characters.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.'
    case 'auth/network-request-failed':
      return 'Connection problem. Check your internet and try again.'
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.'
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow pop-ups and try again.'
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return CANCELLED_MESSAGE
    case 'auth/unauthorized-domain':
      return 'This domain isn’t authorised for sign-in. Add it in Firebase → Authentication → Settings → Authorised domains.'
    case 'auth/operation-not-allowed':
      return 'This sign-in method isn’t enabled yet. Turn it on in Firebase → Authentication → Sign-in method.'
    case 'auth/account-exists-with-different-credential':
      return 'An account with this email already exists with a different sign-in method. Try the email and password login.'
    case 'auth/requires-recent-login':
      return 'For security, please sign in again before retrying this action.'
    case 'auth/quota-exceeded':
      return 'Email quota reached. Please try again a little later.'
    case 'auth/invalid-action-code':
    case 'auth/expired-action-code':
      return 'This link has expired or was already used. Request a new one.'
    case 'auth/missing-continue-uri':
    case 'auth/invalid-continue-uri':
      return 'The reset link could not be created. Please contact support.'
    default:
      return 'Something went wrong. Please try again.'
  }
}

type FirebaseLikeError = { code?: string; message?: string }

function normalizeError(error: unknown): AuthOutcome {
  const err = error as FirebaseLikeError
  const code = typeof err?.code === 'string' ? err.code : undefined

  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return { status: 'cancelled', message: CANCELLED_MESSAGE }
  }

  return {
    status: 'error',
    message: code ? messageForAuthError(code) : 'Something went wrong. Please try again.',
    code,
  }
}

function guard(): AuthOutcome | null {
  if (!isFirebaseConfigured) {
    return { status: 'error', message: SETUP_MESSAGE(), code: 'app/not-configured' }
  }
  return null
}

async function run(operation: () => Promise<AuthOutcome>): Promise<AuthOutcome> {
  const blocked = guard()
  if (blocked) return blocked
  try {
    return await operation()
  } catch (error) {
    return normalizeError(error)
  }
}

function auth(): Auth {
  return getFirebaseAuth()
}

export function subscribeToAuth(
  callback: (user: User | null) => void,
): () => void {
  return onAuthStateChanged(auth(), callback)
}

export async function signUpWithEmail(input: {
  displayName: string
  username: string
  email: string
  password: string
}): Promise<AuthOutcome> {
  return run(async () => {
    const name = validateDisplayName(input.displayName)
    if (!name.ok) return { status: 'error', message: name.message }
    const email = validateEmail(input.email)
    if (!email.ok) return { status: 'error', message: email.message }
    const password = validateNewPassword(input.password)
    if (!password.ok) return { status: 'error', message: password.message }

    const credential = await createUserWithEmailAndPassword(
      auth(),
      email.value,
      password.value,
    )
    await updateProfile(credential.user, { displayName: name.value })
    await sendEmailVerification(credential.user)
    return {
      status: 'success',
      user: credential.user,
      verified: credential.user.emailVerified,
    }
  })
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<AuthOutcome> {
  return run(async () => {
    const checkedEmail = validateEmail(email)
    if (!checkedEmail.ok) return { status: 'error', message: checkedEmail.message }
    if (!password) return { status: 'error', message: 'Enter your password.' }

    const credential = await signInWithEmailAndPassword(
      auth(),
      checkedEmail.value,
      password,
    )
    return {
      status: 'success',
      user: credential.user,
      verified: credential.user.emailVerified,
    }
  })
}

export async function signInWithGoogle(): Promise<AuthOutcome> {
  return run(async () => {
    const credential = await signInWithPopup(auth(), new GoogleAuthProvider())
    return {
      status: 'success',
      user: credential.user,
      verified: credential.user.emailVerified,
    }
  })
}

export async function signInWithApple(): Promise<AuthOutcome> {
  return run(async () => {
    const provider = new OAuthProvider('apple.com')
    const credential = await signInWithPopup(auth(), provider)
    return {
      status: 'success',
      user: credential.user,
      verified: credential.user.emailVerified,
    }
  })
}

export async function sendPasswordReset(email: string): Promise<AuthOutcome> {
  return run(async () => {
    const checked = validateEmail(email)
    if (!checked.ok) return { status: 'error', message: checked.message }
    await sendPasswordResetEmail(auth(), checked.value)
    return { status: 'success', user: null, verified: false }
  })
}

/** Re-reads the current user so a just-verified email is picked up. */
export async function refreshCurrentUser(): Promise<AuthOutcome> {
  return run(async () => {
    const user = auth().currentUser
    if (!user) {
      return {
        status: 'error',
        message: 'Your session has ended. Please sign in again.',
        code: 'auth/no-current-user',
      }
    }
    await reload(user)
    return { status: 'success', user, verified: user.emailVerified }
  })
}

export async function resendVerificationEmail(): Promise<AuthOutcome> {
  return run(async () => {
    const user = auth().currentUser
    if (!user) {
      return {
        status: 'error',
        message: 'Your session has ended. Please sign in again.',
        code: 'auth/no-current-user',
      }
    }
    await sendEmailVerification(user)
    return { status: 'success', user, verified: user.emailVerified }
  })
}

export async function signOutUser(): Promise<AuthOutcome> {
  return run(async () => {
    await signOut(auth())
    return { status: 'success', user: null, verified: false }
  })
}
