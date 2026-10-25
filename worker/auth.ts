import { FIREBASE_PROJECT_ID } from './config'

/**
 * Verifies Firebase ID tokens inside the Worker.
 *
 * Firebase's ID tokens are RS256 JWTs signed by Google. The public keys are
 * fetchable, so no service account or Admin SDK is needed here. We check the
 * signature, issuer, audience and expiry before trusting any claim.
 */

const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

type Jwk = JsonWebKey & { kid?: string }
type KeyCache = { keys: Jwk[]; expiresAt: number }

let keyCache: KeyCache | null = null

export class AuthError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function base64UrlToJson<T>(input: string): T {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(input))) as T
}

async function loadKeys(force = false): Promise<Jwk[]> {
  if (!force && keyCache && keyCache.expiresAt > Date.now()) return keyCache.keys
  const response = await fetch(JWKS_URL, { headers: { accept: 'application/json' } })
  if (!response.ok) {
    throw new AuthError(503, 'Could not verify your session. Please try again.', 'auth_unavailable')
  }
  const body = (await response.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  keyCache = { keys, expiresAt: Date.now() + 60 * 60 * 1000 }
  return keys
}

export type VerifiedUser = {
  uid: string
  email: string | null
  emailVerified: boolean
  provider: string | null
  name: string | null
}

type TokenClaims = {
  sub?: string
  aud?: string
  iss?: string
  exp?: number
  iat?: number
  email?: string
  email_verified?: boolean
  name?: string
  firebase?: { sign_in_provider?: string }
}

export async function verifyFirebaseToken(token: string): Promise<VerifiedUser> {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'invalid_token')
  }

  let header: { alg?: string; kid?: string }
  try {
    header = base64UrlToJson<{ alg?: string; kid?: string }>(parts[0])
  } catch {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'invalid_token')
  }
  if (header.alg !== 'RS256' || !header.kid) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'invalid_token')
  }

  let keys = await loadKeys()
  let jwk = keys.find((candidate) => candidate.kid === header.kid)
  if (!jwk) {
    keys = await loadKeys(true)
    jwk = keys.find((candidate) => candidate.kid === header.kid)
  }
  if (!jwk) {
    throw new AuthError(401, 'Your session could not be verified. Please sign in again.', 'unknown_key')
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    base64UrlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  )
  if (!signatureValid) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'bad_signature')
  }

  let claims: TokenClaims
  try {
    claims = base64UrlToJson<TokenClaims>(parts[1])
  } catch {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'invalid_token')
  }
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (typeof claims.exp !== 'number' || claims.exp <= nowSeconds) {
    throw new AuthError(401, 'Your session has expired. Please sign in again.', 'expired_token')
  }
  if (claims.aud !== FIREBASE_PROJECT_ID) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'bad_audience')
  }
  if (claims.iss !== `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'bad_issuer')
  }
  if (!claims.sub) {
    throw new AuthError(401, 'Your session is invalid. Please sign in again.', 'missing_subject')
  }

  return {
    uid: claims.sub,
    email: claims.email ?? null,
    emailVerified: claims.email_verified === true,
    provider: claims.firebase?.sign_in_provider ?? null,
    name: claims.name ?? null,
  }
}
