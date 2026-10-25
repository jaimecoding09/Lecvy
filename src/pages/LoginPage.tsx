import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  AuthLayout,
  Notice,
  OrDivider,
  PrimaryButton,
  SocialButton,
  TextField,
} from '../components/Form'
import {
  signInWithEmail,
  signInWithApple,
  signInWithGoogle,
  type AuthOutcome,
} from '../lib/auth'
import { validateEmail } from '../lib/validation'

type Banner = { kind: 'error' | 'info'; text: string } | null
type Busy = 'form' | 'google' | 'apple' | null

export default function LoginPage() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [banner, setBanner] = useState<Banner>(null)
  const [busy, setBusy] = useState<Busy>(null)

  function finish(outcome: AuthOutcome) {
    if (outcome.status === 'success') {
      navigate(outcome.verified ? '/account' : '/verify-email', { replace: true })
      return
    }
    if (outcome.status === 'cancelled') {
      setBanner({ kind: 'info', text: outcome.message })
      return
    }
    setBanner({ kind: 'error', text: outcome.message })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const checkedEmail = validateEmail(email)
    const emptyPassword = password ? null : 'Enter your password.'

    setEmailError(checkedEmail.ok ? null : checkedEmail.message)
    setPasswordError(emptyPassword)
    if (!checkedEmail.ok || emptyPassword) return

    setBanner(null)
    setBusy('form')
    const outcome = await signInWithEmail(email.trim(), password)
    setBusy(null)
    finish(outcome)
  }

  async function handleSocial(provider: 'google' | 'apple') {
    setBanner(null)
    setBusy(provider)
    const outcome = provider === 'google' ? await signInWithGoogle() : await signInWithApple()
    setBusy(null)
    finish(outcome)
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <h1 className="auth__title">Welcome back</h1>
      </header>

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        {banner ? (
          <Notice kind={banner.kind}>{banner.text}</Notice>
        ) : null}

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
          placeholder="Your password"
          autoComplete="current-password"
          passwordToggle
          error={passwordError}
          required
        />

        <div className="field__row">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <PrimaryButton loading={busy === 'form'} disabled={busy !== null && busy !== 'form'}>
          Log in
        </PrimaryButton>

        <OrDivider />

        <SocialButton
          provider="google"
          onClick={() => void handleSocial('google')}
          loading={busy === 'google'}
          disabled={busy !== null && busy !== 'google'}
        />
        <SocialButton
          provider="apple"
          onClick={() => void handleSocial('apple')}
          loading={busy === 'apple'}
          disabled={busy !== null && busy !== 'apple'}
        />
      </form>

      <p className="auth__footer">
        New to Lecvy? <Link to="/signup">Create account</Link>
      </p>
    </AuthLayout>
  )
}
