import type { ReactElement } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { BrandLogo } from './components/BrandLogo'
import { useAuthState } from './hooks/useAuthState'
import AccountPage from './pages/AccountPage'
import CreateAccountPage from './pages/CreateAccountPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import LoginPage from './pages/LoginPage'
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
  if (user) return <Navigate to="/account" replace />
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
        <Route path="/account" element={<AccountPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
