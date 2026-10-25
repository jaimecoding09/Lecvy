import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  AuthLayout,
  Notice,
  PrimaryButton,
  TextField,
} from '../components/Form'
import { signUpWithEmail, type AuthOutcome } from '../lib/auth'
import { saveUsernameLocally } from '../lib/profile'
import {
  validateDisplayName,
  validateEmail,
  validateNewPassword,
  validateUsername,
} from '../lib/validation'

type FieldError = string | null
type Banner = { kind: 'error' | 'info'; text: string; loginHint?: boolean } | null

export default function CreateAccountPage() {
  const navigate = useNavigate()

  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const [nameError, setNameError] = useState<FieldError>(null)
  const [usernameError, setUsernameError] = useState<FieldError>(null)
  const [emailError, setEmailError] = useState<FieldError>(null)
  const [passwordError, setPasswordError] = useState<FieldError>(null)

  const [banner, setBanner] = useState<Banner>(null)
  const [submitting, setSubmitting] = useState(false)

  function finish(outcome: AuthOutcome) {
    if (outcome.status === 'success') {
      if (outcome.user) {
        saveUsernameLocally(outcome.user.uid, username.trim().toLowerCase())
      }
      navigate('/verify-email', { replace: true })
      return
    }
    if (outcome.status === 'cancelled') {
      setBanner({ kind: 'info', text: outcome.message })
      return
    }
    setBanner({
      kind: 'error',
      text: outcome.message,
      loginHint: outcome.code === 'auth/email-already-in-use',
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    const name = validateDisplayName(displayName)
    const handle = validateUsername(username)
    const mail = validateEmail(email)
    const pass = validateNewPassword(password)

    setNameError(name.ok ? null : name.message)
    setUsernameError(handle.ok ? null : handle.message)
    setEmailError(mail.ok ? null : mail.message)
    setPasswordError(pass.ok ? null : pass.message)
    if (!name.ok || !handle.ok || !mail.ok || !pass.ok) return

    setBanner(null)
    setSubmitting(true)
    const outcome = await signUpWithEmail({
      displayName: name.value,
      username: handle.value,
      email: mail.value,
      password: pass.value,
    })
    setSubmitting(false)
    finish(outcome)
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <h1 className="auth__title">Create your account</h1>
      </header>

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        {banner ? (
          <Notice kind={banner.kind}>
            {banner.text}
            {banner.loginHint ? (
              <>
                {' '}
                <Link to="/login">Log in</Link>
              </>
            ) : null}
          </Notice>
        ) : null}

        <TextField
          label="Display name"
          value={displayName}
          onChange={(value) => {
            setDisplayName(value)
            if (nameError) setNameError(null)
          }}
          onBlur={() => {
            const checked = validateDisplayName(displayName)
            if (displayName && !checked.ok) setNameError(checked.message)
          }}
          placeholder="How people will see you"
          autoComplete="name"
          error={nameError}
          required
        />

        <TextField
          label="Username"
          prefix="@"
          value={username}
          onChange={(value) => {
            setUsername(value)
            if (usernameError) setUsernameError(null)
          }}
          onBlur={() => {
            const checked = validateUsername(username)
            if (username && !checked.ok) setUsernameError(checked.message)
          }}
          placeholder="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          error={usernameError}
          hint={usernameError ? undefined : 'Letters, numbers, dots, and underscores — no spaces.'}
          required
        />

        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value)
            if (emailError) setEmailError(null)
          }}
          onBlur={() => {
            const checked = validateEmail(email)
            if (email && !checked.ok) setEmailError(checked.message)
          }}
          placeholder="you@example.com"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          error={emailError}
          required
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value)
            if (passwordError) setPasswordError(null)
          }}
          onBlur={() => {
            const checked = validateNewPassword(password)
            if (password && !checked.ok) setPasswordError(checked.message)
          }}
          placeholder="Choose a password"
          autoComplete="new-password"
          passwordToggle
          error={passwordError}
          hint={passwordError ? undefined : 'At least 6 characters.'}
          required
        />

        <PrimaryButton loading={submitting}>Create account</PrimaryButton>
      </form>

      <p className="auth__footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  )
}
