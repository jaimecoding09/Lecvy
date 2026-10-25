import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import {
  AuthLayout,
  Notice,
  PrimaryButton,
  SecondaryButton,
  TextButton,
} from '../components/Form'
import {
  refreshCurrentUser,
  resendVerificationEmail,
  signOutUser,
} from '../lib/auth'
import { useAuthState } from '../hooks/useAuthState'

type NoticeState = { kind: 'success' | 'error' | 'info'; text: string } | null

export default function VerifyEmailPage() {
  const { user, loading } = useAuthState()
  const navigate = useNavigate()

  const [checking, setChecking] = useState(false)
  const [resending, setResending] = useState(false)
  const [note, setNote] = useState<NoticeState>(null)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  if (loading) {
    return (
      <AuthLayout>
        <div className="auth__header auth__header--centered">
          <p className="auth__subtitle">Checking your session…</p>
        </div>
      </AuthLayout>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.emailVerified) return <Navigate to="/onboarding" replace />

  async function handleResend() {
    setNote(null)
    setResending(true)
    const outcome = await resendVerificationEmail()
    setResending(false)
    if (outcome.status === 'success') {
      setNote({ kind: 'success', text: 'Verification email sent again.' })
      setCooldown(30)
      return
    }
    setNote({ kind: 'error', text: outcome.message })
  }

  async function handleChecked() {
    setNote(null)
    setChecking(true)
    const outcome = await refreshCurrentUser()
    setChecking(false)
    if (outcome.status === 'success' && outcome.verified) {
      navigate('/onboarding', { replace: true })
      return
    }
    setNote({
      kind: 'info',
      text: 'This email is not verified yet. Open the link in your inbox, then try again.',
    })
  }

  async function handleLogout() {
    await signOutUser()
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <h1 className="auth__title">Verify your email</h1>
        <p className="auth__subtitle">
          We sent a verification link to <strong>{user.email}</strong>. Open it,
          then come back here to continue.
        </p>
      </header>

      <div className="auth__form">
        {note ? <Notice kind={note.kind}>{note.text}</Notice> : null}

        <PrimaryButton onClick={() => void handleChecked()} loading={checking}>
          I’ve verified — continue
        </PrimaryButton>

        <SecondaryButton
          loading={resending}
          disabled={cooldown > 0}
          onClick={() => void handleResend()}
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
        </SecondaryButton>

        <TextButton onClick={() => void handleLogout()}>Log out</TextButton>
      </div>

      <p className="auth__footer">
        Wrong address? <strong>{user.email}</strong> — sign out and create the
        right account.
      </p>
    </AuthLayout>
  )
}
