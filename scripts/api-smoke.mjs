/**
 * Lecvy API smoke test.
 *
 * Runs against a local `wrangler dev` (workerd) instance with real local D1 and
 * R2 bindings. Authentication is exercised through the local-only
 * DEV_AUTH_BYPASS header; the production Worker has no such bypass.
 *
 *   node scripts/api-smoke.mjs            # local wrangler on :8787
 *   API_BASE=https://lecvy.freebuff.page node scripts/api-smoke.mjs   # live 401 checks
 */

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:8787'
const run = Date.now().toString(36)
let failures = 0

function check(name, condition, extra) {
  if (condition) {
    console.log(`PASS  ${name}`)
  } else {
    failures += 1
    console.log(`FAIL  ${name}${extra ? ` -> ${JSON.stringify(extra)}` : ''}`)
  }
}

async function api(path, { uid, method = 'GET', body, rawBody, headers = {} } = {}) {
  const finalHeaders = { ...headers }
  if (uid) finalHeaders['x-dev-uid'] = uid
  let payload = rawBody
  if (body !== undefined) {
    finalHeaders['content-type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  const response = await fetch(`${BASE}${path}`, { method, headers: finalHeaders, body: payload })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = null
  }
  return { status: response.status, json, text, headers: response.headers }
}

const pngBytes = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  ),
)

async function uploadAvatar(uid, bytes = pngBytes, type = 'image/png', name = 'avatar.png') {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), name)
  return api('/api/onboarding/photo', { uid, method: 'POST', rawBody: form })
}

const userA = `smoke-a-${run}`
const userB = `smoke-b-${run}`
const userC = `smoke-c-${run}`
const userD = `smoke-d-${run}`
const userE = `smoke-e-${run}`
const usernameA = `ada_${run}`

// 1. Unauthenticated access is rejected.
const noAuth = await api('/api/me')
check('GET /api/me without a token is 401', noAuth.status === 401, noAuth.json)

const forged = await api('/api/me', { headers: { authorization: 'Bearer not.a.token' } })
check('forged bearer token is 401', forged.status === 401, forged.json)

// 2. A new user gets a profile and starts at step 1.
const meA = await api('/api/me', { uid: userA })
check('new user gets a profile', meA.status === 200 && meA.json?.profile?.uid === userA, meA.json)
check('new user starts at the name step', meA.json?.onboarding?.nextStep === 'name', meA.json?.onboarding)

// 3. Out-of-order steps are blocked.
const earlyDob = await api('/api/onboarding/dob', {
  uid: userE,
  method: 'POST',
  body: { dateOfBirth: '2000-01-01' },
})
check('date of birth before earlier steps is 409', earlyDob.status === 409, earlyDob.json)

// 4. Display name.
const badName = await api('/api/onboarding/name', { uid: userA, method: 'POST', body: { displayName: ' ' } })
check('blank display name is 400', badName.status === 400, badName.json)

const nameA = await api('/api/onboarding/name', {
  uid: userA,
  method: 'POST',
  body: { displayName: 'Ada Lovelace' },
})
check('display name is saved', nameA.status === 200 && nameA.json?.profile?.displayName === 'Ada Lovelace', nameA.json)
check('next step is username', nameA.json?.onboarding?.nextStep === 'username', nameA.json?.onboarding)

// 5. Username availability and validation.
const spaceName = await api('/api/onboarding/username', { uid: userA, method: 'POST', body: { username: 'ada lovelace' } })
check('username with spaces is 400', spaceName.status === 400, spaceName.json)

const available = await api(`/api/onboarding/username?value=${usernameA}`, { uid: userA })
check('username availability check says available', available.json?.available === true, available.json)

const claimA = await api('/api/onboarding/username', {
  uid: userA,
  method: 'POST',
  body: { username: usernameA },
})
check('username is claimed', claimA.status === 200 && claimA.json?.profile?.username === usernameA, claimA.json)
check('next step is photo', claimA.json?.onboarding?.nextStep === 'photo', claimA.json?.onboarding)

// 6. Duplicate username rejected for another user.
await api('/api/onboarding/name', { uid: userB, method: 'POST', body: { displayName: 'Grace Hopper' } })
const takenB = await api('/api/onboarding/username', { uid: userB, method: 'POST', body: { username: usernameA } })
check('duplicate username is 409', takenB.status === 409, takenB.json)

// 7. Concurrent claim of the same fresh username: exactly one winner.
const raceName = `race_${run}`
await api('/api/onboarding/name', { uid: userC, method: 'POST', body: { displayName: 'Race One' } })
await api('/api/onboarding/name', { uid: userD, method: 'POST', body: { displayName: 'Race Two' } })
const [raceC, raceD] = await Promise.all([
  api('/api/onboarding/username', { uid: userC, method: 'POST', body: { username: raceName } }),
  api('/api/onboarding/username', { uid: userD, method: 'POST', body: { username: raceName } }),
])
const raceStatuses = [raceC.status, raceD.status].sort()
check('concurrent username claim yields one 200 and one 409', raceStatuses[0] === 200 && raceStatuses[1] === 409, raceStatuses)

// 8. Profile photo upload to R2 and public serving.
const badType = await uploadAvatar(userA, new Uint8Array([1, 2, 3]), 'text/plain', 'notes.txt')
check('non-image upload is 415', badType.status === 415, badType.json)

const upload = await uploadAvatar(userA)
check('avatar uploads to R2', upload.status === 200 && Boolean(upload.json?.profile?.avatarUrl), upload.json)

if (upload.json?.profile?.avatarUrl) {
  const image = await fetch(`${BASE}${upload.json.profile.avatarUrl}`)
  const buffer = new Uint8Array(await image.arrayBuffer())
  check('avatar is served back', image.status === 200 && image.headers.get('content-type') === 'image/png', {
    status: image.status,
    type: image.headers.get('content-type'),
  })
  check('served avatar matches the upload', buffer.length === pngBytes.length)
}

const replace = await uploadAvatar(userA)
check('avatar can be replaced', replace.status === 200 && replace.json?.profile?.avatarUrl !== upload.json?.profile?.avatarUrl, replace.json)

// 9. Date of birth validation.
const future = await api('/api/onboarding/dob', { uid: userA, method: 'POST', body: { dateOfBirth: '2999-01-01' } })
check('future date of birth is 400', future.status === 400, future.json)

const tooYoung = await api('/api/onboarding/dob', {
  uid: userA,
  method: 'POST',
  body: { dateOfBirth: new Date().toISOString().slice(0, 10) },
})
check('under-13 date of birth is rejected', tooYoung.status === 400 && /13/.test(tooYoung.json?.error ?? ''), tooYoung.json)

const dob = await api('/api/onboarding/dob', { uid: userA, method: 'POST', body: { dateOfBirth: '1998-06-15' } })
check('valid date of birth completes onboarding', dob.status === 200 && dob.json?.profile?.onboardingCompleted === true, dob.json)
check('onboarding next step is complete', dob.json?.onboarding?.nextStep === 'complete', dob.json?.onboarding)

// 10. Resuming returns the same completed state (no duplicates).
const resume = await api('/api/me', { uid: userA })
check('returning user is still onboarded', resume.json?.profile?.onboardingCompleted === true, resume.json)
check('provider email is stored', typeof resume.json?.profile?.email === 'string', resume.json?.profile)

// 11. Public profile hides private data.
const publicProfile = await api(`/api/public/${usernameA}`)
check('public profile is readable', publicProfile.status === 200 && publicProfile.json?.profile?.username === usernameA, publicProfile.json)
check('public profile has no date of birth', !('dateOfBirth' in (publicProfile.json?.profile ?? {})), publicProfile.json)
check('public profile has no email', !('email' in (publicProfile.json?.profile ?? {})), publicProfile.json)

// 12. Skipping the photo still lets onboarding finish.
await api('/api/onboarding/name', { uid: userB, method: 'POST', body: { displayName: 'Grace Hopper' } })
await api('/api/onboarding/username', { uid: userB, method: 'POST', body: { username: `grace_${run}` } })
const skipped = await api('/api/onboarding/photo/skip', { uid: userB, method: 'POST' })
check('photo can be skipped', skipped.status === 200 && skipped.json?.onboarding?.nextStep === 'dob', skipped.json)

const dobB = await api('/api/onboarding/dob', { uid: userB, method: 'POST', body: { dateOfBirth: '1990-02-02' } })
check('second user completes onboarding', dobB.json?.profile?.onboardingCompleted === true, dobB.json)

// 13. Users are isolated from each other.
const meB = await api('/api/me', { uid: userB })
check('profiles are isolated per authenticated uid', meB.json?.profile?.uid === userB && meB.json?.profile?.username === `grace_${run}`, meB.json?.profile)

// 14. Static app is still served by the same Worker.
const site = await fetch(`${BASE}/login`)
check('SPA route still served', site.status === 200 && (await site.text()).includes('<title>Lecvy</title>'))

console.log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
