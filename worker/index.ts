import {
  AuthError,
  verifyFirebaseToken,
  type VerifiedUser,
} from './auth'
import { ALLOWED_IMAGE_TYPES, MAX_AVATAR_BYTES, type Env } from './config'
import {
  deriveOnboarding,
  ensureProfile,
  ensureSchema,
  getAvatarKey,
  getProfile,
  getPublicProfile,
  isUsernameTaken,
  markOnboardingComplete,
  setAvatar,
  setDateOfBirth,
  setDisplayName,
  setUsername,
  skipPhoto,
  toOwnerProfile,
  toPublicProfile,
  type ProfileRow,
} from './db'
import {
  validateDateOfBirth,
  validateDisplayName,
  validateUsername,
} from '../shared/validation'

class ApiError extends Error {
  status: number
  code: string
  constructor(status: number, message: string, code: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS })
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    throw new ApiError(400, 'Send a valid JSON body.', 'invalid_body')
  }
}

/** Resolves the caller from a verified Firebase token — never from client IDs. */
async function requireUser(request: Request, env: Env): Promise<VerifiedUser> {
  if (env.DEV_AUTH_BYPASS === '1') {
    const devUid = request.headers.get('x-dev-uid')
    if (devUid) {
      return {
        uid: devUid,
        email: `${devUid}@local.test`,
        emailVerified: true,
        provider: 'password',
        name: null,
      }
    }
  }

  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) throw new ApiError(401, 'Sign in to continue.', 'missing_token')

  let user: VerifiedUser
  try {
    user = await verifyFirebaseToken(token)
  } catch (error) {
    if (error instanceof AuthError) throw new ApiError(error.status, error.message, error.code)
    throw error
  }

  if (user.provider === 'password' && !user.emailVerified) {
    throw new ApiError(403, 'Verify your email address before continuing.', 'email_unverified')
  }
  return user
}

function requirePreviousSteps(row: ProfileRow, step: 'username' | 'photo' | 'dob'): void {
  if (step === 'username' && !row.display_name) {
    throw new ApiError(409, 'Add your name first.', 'steps_out_of_order')
  }
  if (step !== 'username' && !(row.display_name && row.username)) {
    throw new ApiError(409, 'Finish the earlier steps first.', 'steps_out_of_order')
  }
}

async function profileState(env: Env, row: ProfileRow) {
  let current = row
  const onboarding = deriveOnboarding(row)
  if (onboarding.nextStep === 'complete' && !row.onboarding_completed) {
    current = await markOnboardingComplete(env, row.firebase_uid)
  }
  return {
    profile: toOwnerProfile(current),
    onboarding: deriveOnboarding(current),
  }
}

async function serveAvatar(env: Env, uid: string): Promise<Response> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) {
    throw new ApiError(400, 'Invalid avatar reference.', 'invalid_avatar_ref')
  }
  const key = await getAvatarKey(env, uid)
  if (!key) return new Response('Not found', { status: 404 })

  const object = await env.FILES.get(key)
  if (!object) return new Response('Not found', { status: 404 })

  const headers = new Headers()
  headers.set('content-type', object.httpMetadata?.contentType ?? 'application/octet-stream')
  headers.set('cache-control', 'public, max-age=300')
  if (object.httpEtag) headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method

  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true, service: 'lecvy-api' })
  }

  const avatarMatch = path.match(/^\/api\/avatar\/([^/]+)$/)
  if (avatarMatch && method === 'GET') {
    return serveAvatar(env, decodeURIComponent(avatarMatch[1]))
  }

  const publicMatch = path.match(/^\/api\/public\/([^/]+)$/)
  if (publicMatch && method === 'GET') {
    const row = await getPublicProfile(env, decodeURIComponent(publicMatch[1]).toLowerCase())
    if (!row) return json({ error: 'Profile not found.', code: 'not_found' }, 404)
    return json({ profile: toPublicProfile(row) })
  }

  const user = await requireUser(request, env)
  const row = await ensureProfile(env, user)

  if (path === '/api/me' && method === 'GET') {
    return json(await profileState(env, row))
  }

  if (path === '/api/onboarding/name' && method === 'POST') {
    const body = await readJson(request)
    const result = validateDisplayName(String(body.displayName ?? ''))
    if (!result.ok) throw new ApiError(400, result.message, 'invalid_display_name')
    return json(await profileState(env, await setDisplayName(env, user.uid, result.value)))
  }

  if (path === '/api/onboarding/username' && method === 'GET') {
    const result = validateUsername(url.searchParams.get('value') ?? '')
    if (!result.ok) {
      return json({ available: false, normalized: null, reason: result.message })
    }
    const taken = await isUsernameTaken(env, result.value, user.uid)
    return json({
      available: !taken,
      normalized: result.value,
      reason: taken ? 'That username is already taken.' : null,
    })
  }

  if (path === '/api/onboarding/username' && method === 'POST') {
    requirePreviousSteps(row, 'username')
    const body = await readJson(request)
    const typed = String(body.username ?? '').trim()
    const result = validateUsername(typed)
    if (!result.ok) throw new ApiError(400, result.message, 'invalid_username')
    if (await isUsernameTaken(env, result.value, user.uid)) {
      throw new ApiError(409, 'That username is already taken.', 'username_taken')
    }
    let updated: ProfileRow
    try {
      updated = await setUsername(env, user.uid, typed, result.value)
    } catch (error) {
      // The unique index is the real arbiter under concurrent claims.
      if (String((error as Error)?.message ?? '').includes('UNIQUE')) {
        throw new ApiError(409, 'That username is already taken.', 'username_taken')
      }
      throw error
    }
    return json(await profileState(env, updated))
  }

  if (path === '/api/onboarding/photo' && method === 'POST') {
    requirePreviousSteps(row, 'photo')
    const contentType = request.headers.get('content-type') ?? ''
    if (!contentType.includes('multipart/form-data')) {
      throw new ApiError(415, 'Upload the image as form data.', 'invalid_content_type')
    }
    const declared = Number(request.headers.get('content-length') ?? '0')
    if (declared > MAX_AVATAR_BYTES + 512 * 1024) {
      throw new ApiError(413, 'Image must be 5 MB or smaller.', 'file_too_large')
    }

    let form: FormData
    try {
      form = await request.formData()
    } catch {
      throw new ApiError(400, 'The upload could not be read.', 'invalid_form')
    }

    const file = form.get('file')
    if (!(file instanceof File)) {
      throw new ApiError(400, 'Choose an image to upload.', 'missing_file')
    }
    const extension = ALLOWED_IMAGE_TYPES[file.type]
    if (!extension) {
      throw new ApiError(415, 'Use a JPG, PNG, or WebP image.', 'unsupported_type')
    }
    if (file.size === 0) throw new ApiError(400, 'That file is empty.', 'empty_file')
    if (file.size > MAX_AVATAR_BYTES) {
      throw new ApiError(413, 'Image must be 5 MB or smaller.', 'file_too_large')
    }

    const key = `avatars/${user.uid}/${crypto.randomUUID()}.${extension}`
    const bytes = await file.arrayBuffer()
    await env.FILES.put(key, bytes, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    })

    const previousKey = row.avatar_key
    const updated = await setAvatar(env, user.uid, key)
    if (previousKey && previousKey !== key) {
      try {
        await env.FILES.delete(previousKey)
      } catch {
        // A stranded old object is harmless; the new key is already stored.
      }
    }
    return json(await profileState(env, updated))
  }

  if (path === '/api/onboarding/photo/skip' && method === 'POST') {
    requirePreviousSteps(row, 'photo')
    return json(await profileState(env, await skipPhoto(env, user.uid)))
  }

  if (path === '/api/onboarding/dob' && method === 'POST') {
    requirePreviousSteps(row, 'dob')
    const body = await readJson(request)
    const result = validateDateOfBirth(String(body.dateOfBirth ?? ''))
    if (!result.ok) throw new ApiError(400, result.message, 'invalid_date_of_birth')
    const updated = await setDateOfBirth(env, user.uid, result.value, result.isMinor)
    return json(await profileState(env, updated))
  }

  if (path === '/api/onboarding/complete' && method === 'POST') {
    const latest = (await getProfile(env, user.uid)) ?? row
    if (!deriveOnboarding(latest).canComplete) {
      throw new ApiError(409, 'Finish the required steps first.', 'onboarding_incomplete')
    }
    return json(await profileState(env, await markOnboardingComplete(env, user.uid)))
  }

  throw new ApiError(404, 'Not found.', 'not_found')
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      try {
        await ensureSchema(env)
        return await handleApi(request, env, url)
      } catch (error) {
        if (error instanceof ApiError) {
          return json({ error: error.message, code: error.code }, error.status)
        }
        console.error(
          'api_error',
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        )
        return json(
          { error: 'Something went wrong on our side. Please try again.', code: 'internal' },
          500,
        )
      }
    }

    return env.ASSETS.fetch(request)
  },
}
