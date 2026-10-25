import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { BrandLogo } from './components/BrandLogo'
import { useAuthState } from './hooks/useAuthState'
import CreateAccountPage from './pages/CreateAccountPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

function SessionSplash() {
  return (
    <main className="auth-page">
      <div className="auth">
        <div className="auth__brand">
          <BrandLogo size="lg" />
        </div>
        <div className="auth__header auth__header--centered">
          <p className="auth__subtitle">Loading…</p>
        </div>
      </div>
    </main>
  )
}

/** Keeps signed-in users out of the sign-in screens. */
function PublicOnly({ children }: { children: ReactElement }) {
  const { user, loading } = useAuthState()
  if (loading) return <SessionSplash />
  if (user) return <Navigate to="/home" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="/login"
          element={
            <PublicOnly>
              <LoginPage />
            </PublicOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnly>
              <CreateAccountPage />
            </PublicOnly>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/:step" element={<OnboardingPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/account" element={<Navigate to="/home" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
