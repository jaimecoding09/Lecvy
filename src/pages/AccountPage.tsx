import { Navigate, useNavigate } from 'react-router-dom'

import { AuthLayout, Notice, SecondaryButton } from '../components/Form'
import { useAuthState } from '../hooks/useAuthState'
import { readUsernameLocally } from '../lib/profile'
import { signOutUser } from '../lib/auth'

/**
 * Signed-in session placeholder. It exists so authentication has a verified
 * destination and a logout control; the feed and profile screens replace it in
 * a later iteration.
 */
export default function AccountPage() {
  const { user, loading } = useAuthState()
  const navigate = useNavigate()

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

  const username = user.uid ? readUsernameLocally(user.uid) : null

  async function handleLogout() {
    await signOutUser()
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <h1 className="auth__title">
          {user.displayName ? `Hi, ${user.displayName}` : 'Your account'}
        </h1>
        <p className="auth__subtitle">You’re signed in to Lecvy.</p>
      </header>

      <div className="auth__form">
        {!user.emailVerified ? (
          <Notice kind="info" title="Email not verified">
            Check your inbox for the verification link.{' '}
            <button
              type="button"
              className="btn btn--text"
              onClick={() => navigate('/verify-email')}
            >
              Verify now
            </button>
          </Notice>
        ) : null}

        <div className="account__card">
          <div className="account__row">
            <span className="account__label">Display name</span>
            <span className="account__value">{user.displayName || '—'}</span>
          </div>
          {username ? (
            <div className="account__row">
              <span className="account__label">Username</span>
              <span className="account__value">@{username}</span>
            </div>
          ) : null}
          <div className="account__row">
            <span className="account__label">Email</span>
            <span className="account__value">{user.email}</span>
          </div>
          <div className="account__row">
            <span className="account__label">Status</span>
            <span className={`pill ${user.emailVerified ? 'pill--ok' : ''}`}>
              {user.emailVerified ? 'Verified' : 'Not verified'}
            </span>
          </div>
        </div>

        <SecondaryButton onClick={() => void handleLogout()}>Log out</SecondaryButton>
      </div>
    </AuthLayout>
  )
}
