import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { ProfileAvatar } from '../components/Avatar'
import { AuthLayout, Notice, PrimaryButton, SecondaryButton, TextButton } from '../components/Form'
import { useAuthState } from '../hooks/useAuthState'
import { getMe, type MeResponse } from '../lib/api'
import { signOutUser } from '../lib/auth'

/**
 * Post-onboarding destination. The feed itself lands in the next iteration;
 * this keeps the completed session somewhere real to land.
 */
export default function HomePage() {
  const { user, loading } = useAuthState()
  const navigate = useNavigate()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    getMe().then((result) => {
      if (cancelled) return
      if (result.ok) {
        setMe(result.data)
        setError(null)
      } else {
        setError(result.error)
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

  if (loading) {
    return (
      <AuthLayout>
        <p className="auth__subtitle">Loading…</p>
      </AuthLayout>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const usesPassword = user.providerData.some((entry) => entry.providerId === 'password')
  if (usesPassword && !user.emailVerified) return <Navigate to="/verify-email" replace />

  if (loadingProfile && !me) {
    return (
      <AuthLayout>
        <p className="auth__subtitle">Loading your profile…</p>
      </AuthLayout>
    )
  }

  if (error && !me) {
    return (
      <AuthLayout>
        <Notice kind="error" title="Couldn’t reach Lecvy">
          {error}
        </Notice>
        <div className="auth__form">
          <PrimaryButton onClick={retry}>Try again</PrimaryButton>
          <TextButton onClick={() => navigate('/login', { replace: true })}>Back to log in</TextButton>
        </div>
      </AuthLayout>
    )
  }

  if (!me) return null
  if (!me.profile.onboardingCompleted) return <Navigate to="/onboarding" replace />

  async function handleLogout() {
    await signOutUser()
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout>
      <header className="auth__header auth__header--centered">
        <ProfileAvatar
          src={me.profile.avatarUrl}
          name={me.profile.displayName ?? 'Lecvy'}
          size="lg"
        />
        <h1 className="auth__title">
          {me.profile.displayName ? `Hi, ${me.profile.displayName}` : 'Welcome to Lecvy'}
        </h1>
        {me.profile.username ? (
          <p className="auth__subtitle">@{me.profile.username}</p>
        ) : null}
      </header>

      <div className="auth__form">
        {!user.emailVerified ? (
          <Notice kind="info" title="Email not verified">
            Check your inbox for the verification link.{' '}
            <TextButton onClick={() => navigate('/verify-email')}>Verify now</TextButton>
          </Notice>
        ) : null}

        <Notice kind="info" title="Your feed is next">
          Onboarding is complete and saved. The Lecvy feed arrives in the next iteration.
        </Notice>

        <SecondaryButton onClick={() => void handleLogout()}>Log out</SecondaryButton>
      </div>
    </AuthLayout>
  )
}
