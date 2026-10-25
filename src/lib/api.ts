import { isFirebaseConfigured, getFirebaseAuth } from './firebase'

export type OnboardingStep = 'name' | 'username' | 'photo' | 'dob' | 'complete'

export type Profile = {
  uid: string
  email: string | null
  displayName: string | null
  username: string | null
  avatarUrl: string | null
  dateOfBirth: string | null
  onboardingCompleted: boolean
}

export type Onboarding = {
  nextStep: OnboardingStep
  completedSteps: OnboardingStep[]
  canComplete: boolean
}

export type MeResponse = { profile: Profile; onboarding: Onboarding }

export type UsernameCheck = {
  available: boolean
  normalized: string | null
  reason: string | null
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string }

const NETWORK_ERROR = 'Network problem. Check your connection and try again.'
const SESSION_ERROR = 'Your session has ended. Please sign in again.'

async function request<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  if (!isFirebaseConfigured) {
    return {
      ok: false,
      status: 0,
      error: 'Firebase is not configured yet. Add the web config to .env and restart.',
      code: 'not_configured',
    }
  }

  let token: string
  try {
    const user = getFirebaseAuth().currentUser
    if (!user) return { ok: false, status: 401, error: SESSION_ERROR, code: 'no_session' }
    token = await user.getIdToken()
  } catch {
    return { ok: false, status: 401, error: SESSION_ERROR, code: 'no_session' }
  }

  const headers = new Headers(init.headers)
  headers.set('authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(path, { ...init, headers })
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR, code: 'network' }
  }

  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }

  if (!response.ok) {
    const body = payload as { error?: string; code?: string } | null
    return {
      ok: false,
      status: response.status,
      error: body?.error ?? 'Something went wrong. Please try again.',
      code: body?.code,
    }
  }

  return { ok: true, data: payload as T }
}

function postJson<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function getMe(): Promise<ApiResult<MeResponse>> {
  return request<MeResponse>('/api/me')
}

export function saveDisplayName(displayName: string): Promise<ApiResult<MeResponse>> {
  return postJson<MeResponse>('/api/onboarding/name', { displayName })
}

export function checkUsername(value: string): Promise<ApiResult<UsernameCheck>> {
  return request<UsernameCheck>(`/api/onboarding/username?value=${encodeURIComponent(value)}`)
}

export function saveUsername(username: string): Promise<ApiResult<MeResponse>> {
  return postJson<MeResponse>('/api/onboarding/username', { username })
}

export function uploadAvatar(file: File): Promise<ApiResult<MeResponse>> {
  const form = new FormData()
  form.append('file', file)
  // No explicit content-type: the browser must add the multipart boundary.
  return request<MeResponse>('/api/onboarding/photo', { method: 'POST', body: form })
}

export function skipAvatar(): Promise<ApiResult<MeResponse>> {
  return postJson<MeResponse>('/api/onboarding/photo/skip', {})
}

export function saveDateOfBirth(dateOfBirth: string): Promise<ApiResult<MeResponse>> {
  return postJson<MeResponse>('/api/onboarding/dob', { dateOfBirth })
}

export function completeOnboarding(): Promise<ApiResult<MeResponse>> {
  return postJson<MeResponse>('/api/onboarding/complete', {})
}
