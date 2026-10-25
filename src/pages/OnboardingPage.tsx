import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'

import { ProfileAvatar } from '../components/Avatar'
import {
  AuthLayout,
  Notice,
  PrimaryButton,
  SecondaryButton,
  TextButton,
  TextField,
} from '../components/Form'
import { useAuthState } from '../hooks/useAuthState'
import {
  checkUsername,
  getMe,
  saveDateOfBirth,
  saveDisplayName,
  saveUsername,
  skipAvatar,
  uploadAvatar,
  type MeResponse,
} from '../lib/api'
import {
  validateDateOfBirth,
  validateDisplayName,
  validateUsername,
} from '../lib/validation'

const STEP_KEYS = ['name', 'username', 'photo', 'dob'] as const
type StepKey = (typeof STEP_KEYS)[number]

const STEP_SUBTITLES: Partial<Record<StepKey, string>> = {
  name: 'This is the name shown on your profile and posts.',
  username: 'People can find you with this. You can’t change it later — no spaces.',
  photo: 'Optional — you can add one later.',
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function nextPath(nextStep: string): string {
  return nextStep === 'complete' ? '/onboarding/done' : `/onboarding/${nextStep}`
}

function progressIndex(step: StepKey): number {
  return STEP_KEYS.indexOf(step) + 1
}

export default function OnboardingPage() {
  const { step: rawStep } = useParams<{ step: string }>()
  const navigate = useNavigate()
  const { user, loading: sessionLoading } = useAuthState()

  const step = (rawStep === 'done' ? 'done' : (rawStep as StepKey)) as StepKey | 'done'
  const known = step === 'done' || STEP_KEYS.includes(step as StepKey)

  const [me, setMe] = useState<MeResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setMe(result.data)
        setLoadError(null)
      } else {
        setLoadError(result.error)
      }
      setLoadingProfile(false)
    })
    return () => {
      cancelled = true
    }
  }, [user, reloadKey])

  const retry = () => {
    setLoadingProfile(true)
    setReloadKey((key) => key + 1)
  }

  if (sessionLoading) return <WizardShell><p className="auth__subtitle">Loading…</p></WizardShell>
  if (!user) return <Navigate to="/login" replace />
  if (rawStep && !known) return <Navigate to="/onboarding" replace />

  if (loadingProfile && !me) {
    return (
      <WizardShell>
        <p className="auth__subtitle">Loading your onboarding…</p>
      </WizardShell>
    )
  }

  if (loadError && !me) {
    return (
      <WizardShell>
        <Notice kind="error" title="Couldn’t load your progress">
          {loadError}
        </Notice>
        <PrimaryButton onClick={retry}>Try again</PrimaryButton>
        <TextButton onClick={() => navigate('/login', { replace: true })}>Back to log in</TextButton>
      </WizardShell>
    )
  }

  if (!me) return null
  if (!rawStep) return <Navigate to={nextPath(me.onboarding.nextStep)} replace />

  const { profile, onboarding } = me
  if (profile.onboardingCompleted) return <Navigate to="/home" replace />

  const requiredStep = onboarding.nextStep
  if (requiredStep === 'complete' && step !== 'done') {
    return <Navigate to="/onboarding/done" replace />
  }
  if (requiredStep !== 'complete' && step === 'done') {
    return <Navigate to={nextPath(requiredStep)} replace />
  }

  const currentIndex = step === 'done' ? STEP_KEYS.length : progressIndex(step)
  const requiredIndex =
    requiredStep === 'complete' ? STEP_KEYS.length : progressIndex(requiredStep as StepKey)
  if (step !== 'done' && currentIndex > requiredIndex) {
    return <Navigate to={nextPath(requiredStep)} replace />
  }

  const applyResult = (next: MeResponse) => {
    setMe(next)
    navigate(nextPath(next.onboarding.nextStep), { replace: true })
  }

  return (
    <WizardShell progress={currentIndex}>
      {step === 'name' ? (
        <StepName
          initialValue={profile.displayName ?? user.displayName ?? ''}
          onSaved={applyResult}
        />
      ) : null}
      {step === 'username' ? (
        <StepUsername initialValue={profile.username ?? ''} onSaved={applyResult} />
      ) : null}
      {step === 'photo' ? (
        <StepPhoto
          currentAvatarUrl={profile.avatarUrl}
          displayName={profile.displayName ?? 'You'}
          onSaved={applyResult}
        />
      ) : null}
      {step === 'dob' ? <StepDateOfBirth onSaved={applyResult} /> : null}
      {step === 'done' ? <StepDone username={profile.username ?? ''} /> : null}
    </WizardShell>
  )
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                        */
/* -------------------------------------------------------------------------- */

function WizardShell({
  children,
  progress,
}: {
  children: ReactNode
  progress?: number
}) {
  return (
    <AuthLayout>
      {typeof progress === 'number' ? (
        <div className="progress" aria-hidden="true">
          {STEP_KEYS.map((key, index) => (
            <span
              key={key}
              className={`progress__bar ${index < progress ? 'progress__bar--done' : ''}`}
            />
          ))}
        </div>
      ) : null}
      {typeof progress === 'number' ? (
        <p className="progress__label">Step {Math.min(progress, STEP_KEYS.length)} of {STEP_KEYS.length}</p>
      ) : null}
      {children}
    </AuthLayout>
  )
}

function StepHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="auth__header">
      <h1 className="auth__title">{title}</h1>
      {subtitle ? <p className="auth__subtitle">{subtitle}</p> : null}
    </header>
  )
}

function BackLink({ to }: { to: string }) {
  const navigate = useNavigate()
  return <TextButton onClick={() => navigate(to)}>Back</TextButton>
}

/* -------------------------------------------------------------------------- */
/* Step 1 — display name                                                        */
/* -------------------------------------------------------------------------- */

function StepName({
  initialValue,
  onSaved,
}: {
  initialValue: string
  onSaved: (next: MeResponse) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const checked = validateDisplayName(value)
    if (!checked.ok) {
      setError(checked.message)
      return
    }
    setError(null)
    setBusy(true)
    const result = await saveDisplayName(checked.value)
    setBusy(false)
    if (result.ok) onSaved(result.data)
    else setError(result.error)
  }

  return (
    <>
      <StepHeader title="Your name" subtitle={STEP_SUBTITLES.name} />
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Display name"
          value={value}
          onChange={(next) => {
            setValue(next)
            if (error) setError(null)
          }}
          placeholder="How people will see you"
          autoComplete="name"
          error={error}
          required
        />
        <PrimaryButton loading={busy}>Continue</PrimaryButton>
      </form>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 2 — username                                                            */
/* -------------------------------------------------------------------------- */

type AvailabilityState = 'idle' | 'invalid' | 'checking' | 'available' | 'taken'

function StepUsername({
  initialValue,
  onSaved,
}: {
  initialValue: string
  onSaved: (next: MeResponse) => void
}) {
  const [value, setValue] = useState(initialValue)
  const [checked, setChecked] = useState<{
    value: string
    available: boolean
    reason: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Availability is derived from the last server answer for the current value,
  // so no state has to be written while rendering.
  const local = validateUsername(value)
  const candidate = local.ok ? local.value : null
  const checkedForCandidate =
    candidate !== null && checked?.value === candidate ? checked : null
  const availability: AvailabilityState = !value.trim()
    ? 'idle'
    : !local.ok
      ? 'invalid'
      : checkedForCandidate
        ? checkedForCandidate.available
          ? 'available'
          : 'taken'
        : 'checking'

  useEffect(() => {
    if (!candidate) return
    if (checked?.value === candidate) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      const result = await checkUsername(candidate)
      if (cancelled || !result.ok) return
      setChecked({
        value: result.data.normalized ?? candidate,
        available: result.data.available,
        reason: result.data.reason,
      })
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [candidate, checked?.value])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const checked = validateUsername(value)
    if (!checked.ok) {
      setError(checked.message)
      return
    }
    if (availability === 'taken') {
      setError(checkedForCandidate?.reason ?? 'That username is already taken.')
      return
    }
    setError(null)
    setBusy(true)
    const result = await saveUsername(checked.value)
    setBusy(false)
    if (result.ok) {
      onSaved(result.data)
      return
    }
    setError(result.status === 409 ? 'That username was just taken. Try another.' : result.error)
  }

  const hint =
    availability === 'available'
      ? `@${local.ok ? local.value : value.trim()} is available`
      : availability === 'taken'
        ? (checkedForCandidate?.reason ?? 'That username is already taken.')
        : availability === 'invalid'
          ? (local.ok ? '' : local.message)
          : 'Letters, numbers, dots, and underscores — no spaces.'

  return (
    <>
      <StepHeader title="Pick a username" subtitle={STEP_SUBTITLES.username} />
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Username"
          prefix="@"
          value={value}
          onChange={(next) => {
            setValue(next)
            if (error) setError(null)
          }}
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={error}
          hint={error ? undefined : hint}
          required
        />
        {availability === 'checking' ? (
          <p className="field__message field__message--hint">Checking availability…</p>
        ) : null}
        <PrimaryButton loading={busy} disabled={availability === 'checking'}>
          Continue
        </PrimaryButton>
        <BackLink to="/onboarding/name" />
      </form>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 3 — profile photo                                                       */
/* -------------------------------------------------------------------------- */

function StepPhoto({
  currentAvatarUrl,
  displayName,
  onSaved,
}: {
  currentAvatarUrl: string | null
  displayName: string
  onSaved: (next: MeResponse) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'upload' | 'skip' | null>(null)
  const previewRef = useRef<string | null>(null)

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  function showPreview(next: File | null) {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current)
      previewRef.current = null
    }
    if (!next) {
      setFile(null)
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(next)
    previewRef.current = url
    setFile(next)
    setPreview(url)
  }

  function handlePick(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null
    setError(null)
    if (!picked) {
      showPreview(null)
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(picked.type)) {
      setError('Use a JPG, PNG, or WebP image.')
      showPreview(null)
      return
    }
    if (picked.size > MAX_AVATAR_BYTES) {
      setError('Image must be 5 MB or smaller.')
      showPreview(null)
      return
    }
    showPreview(picked)
  }

  async function handleUpload() {
    if (!file) {
      inputRef.current?.click()
      return
    }
    setBusy('upload')
    const result = await uploadAvatar(file)
    setBusy(null)
    if (result.ok) onSaved(result.data)
    else setError(result.error)
  }

  async function handleSkip() {
    setBusy('skip')
    const result = await skipAvatar()
    setBusy(null)
    if (result.ok) onSaved(result.data)
    else setError(result.error)
  }

  return (
    <>
      <StepHeader title="Add a profile photo" subtitle={STEP_SUBTITLES.photo} />
      <div className="auth__form">
        {error ? <Notice kind="error">{error}</Notice> : null}

        <div className="photo-picker">
          <ProfileAvatar src={preview ?? currentAvatarUrl} name={displayName} size="lg" />
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePick}
            aria-label="Choose a profile photo"
          />
          <SecondaryButton onClick={() => inputRef.current?.click()}>
            {preview || currentAvatarUrl ? 'Choose a different photo' : 'Choose a photo'}
          </SecondaryButton>
          <p className="field__message field__message--hint">JPG, PNG, or WebP · up to 5 MB</p>
        </div>

        <PrimaryButton loading={busy === 'upload'} onClick={() => void handleUpload()}>
          {file ? 'Upload and continue' : 'Continue'}
        </PrimaryButton>
        <TextButton onClick={() => void handleSkip()} disabled={busy === 'skip'}>
          {busy === 'skip' ? 'Skipping…' : 'Skip for now'}
        </TextButton>
        <BackLink to="/onboarding/username" />
      </div>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 4 — date of birth                                                       */
/* -------------------------------------------------------------------------- */

function StepDateOfBirth({ onSaved }: { onSaved: (next: MeResponse) => void }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [today] = useState(() => new Date().toISOString().slice(0, 10))

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const checked = validateDateOfBirth(value)
    if (!checked.ok) {
      setError(checked.message)
      return
    }
    setError(null)
    setBusy(true)
    const result = await saveDateOfBirth(checked.value)
    setBusy(false)
    if (result.ok) onSaved(result.data)
    else setError(result.error)
  }

  return (
    <>
      <StepHeader
        title="When were you born?"
        subtitle="We use your date of birth to keep Lecvy age-appropriate. It never appears on your public profile."
      />
      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        <TextField
          label="Date of birth"
          type="date"
          value={value}
          onChange={(next) => {
            setValue(next)
            if (error) setError(null)
          }}
          autoComplete="bday"
          max={today}
          error={error}
          hint={error ? undefined : 'You must be at least 13 to use Lecvy.'}
          required
        />
        <PrimaryButton loading={busy}>Continue</PrimaryButton>
        <BackLink to="/onboarding/photo" />
      </form>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Step 5 — done                                                                */
/* -------------------------------------------------------------------------- */

function StepDone({ username }: { username: string }) {
  const navigate = useNavigate()
  return (
    <>
      <StepHeader
        title="You’re all set"
        subtitle={`Welcome to Lecvy${username ? `, @${username}` : ''}. Your feed is being built next — for now this is your home.`}
      />
      <div className="auth__form">
        <PrimaryButton onClick={() => navigate('/home', { replace: true })}>
          Go to Lecvy
        </PrimaryButton>
      </div>
    </>
  )
}
