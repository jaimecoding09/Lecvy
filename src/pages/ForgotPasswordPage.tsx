import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import {
  AuthLayout,
  Notice,
  PrimaryButton,
  TextField,
  TextButton,
} from '../components/Form'
import { sendPasswordReset } from '../lib/auth'
import { validateEmail } from '../lib/validation'

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const checked = validateEmail(email)
    setEmailError(checked.ok ? null : checked.message)
    if (!checked.ok) return

    setError(null)
    setSending(true)
    const outcome = await sendPasswordReset(checked.value)
    setSending(false)

    if (outcome.status === 'success') {
      setSent(true)
      return
    }
    setError(outcome.message)
  }

  if (sent) {
    return (
      <AuthLayout>
        <header className="auth__header auth__header--centered">
          <h1 className="auth__title">Check your inbox</h1>
          <p className="auth__subtitle">
            If an account exists for <strong>{email.trim()}</strong>, we’ve sent a
            link to reset your password.
          </p>
        </header>

        <div className="auth__form">
          <Notice kind="success">
            The link expires shortly. If it doesn’t arrive, check your spam folder
            or request another one.
          </Notice>

          <PrimaryButton type="button" onClick={() => navigate('/login', { replace: true })}>
            Back to log in
          </PrimaryButton>

          <TextButton
            onClick={() => {
              setSent(false)
              setError(null)
              setEmail('')
            }}
          >
            Use a different email
          </TextButton>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <h1 className="auth__title">Forgot password?</h1>
        <p className="auth__subtitle">
          Enter the email you signed up with and we’ll send you a link to reset
          your password.
        </p>
      </header>

      <form className="auth__form" onSubmit={handleSubmit} noValidate>
        {error ? <Notice kind="error">{error}</Notice> : null}

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

        <PrimaryButton loading={sending}>Send reset link</PrimaryButton>
      </form>

      <p className="auth__footer">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  )
}
