import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import LoginPage from './LoginPage'
import { signInWithEmail, signInWithGoogle } from '../lib/auth'
import type { AuthOutcome } from '../lib/auth'
import { getMe } from '../lib/api'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/auth', () => ({
  signInWithEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithApple: vi.fn(),
}))

vi.mock('../lib/api', () => ({
  getMe: vi.fn(),
}))

const signInMock = vi.mocked(signInWithEmail)
const googleMock = vi.mocked(signInWithGoogle)
const meMock = vi.mocked(getMe)

function completedProfile(completed: boolean) {
  return {
    ok: true as const,
    data: {
      profile: {
        uid: 'u1',
        email: 'ada@example.com',
        displayName: 'Ada',
        username: 'ada',
        avatarUrl: null,
        dateOfBirth: '1998-01-01',
        onboardingCompleted: completed,
      },
      onboarding: {
        nextStep: completed ? ('complete' as const) : ('name' as const),
        completedSteps: [],
        canComplete: completed,
      },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  meMock.mockResolvedValue(completedProfile(true))
})

describe('LoginPage', () => {
  it('shows every element the spec calls for', () => {
    renderScreen(<LoginPage />)

    expect(screen.getByText('Lecvy')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Welcome back' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByText('OR')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Continue with Apple' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Create account' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/New to Lecvy\?/)).toBeInTheDocument()
  })

  it('shows and hides the password via the toggle', async () => {
    const user = userEvent.setup()
    renderScreen(<LoginPage />)

    const password = screen.getByLabelText(/^password/i)
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(
      screen.getByRole('button', { name: 'Hide password' }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('blocks submission with friendly messages when fields are empty', async () => {
    const user = userEvent.setup()
    renderScreen(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Enter your email address.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(signInMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('submits valid credentials and routes an onboarded user home', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({
      status: 'success',
      user: { uid: 'u1' } as never,
      verified: true,
    })
    renderScreen(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith('ada@example.com', 'secret123'),
    )
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/home', { replace: true }))
  })

  it('routes a user with incomplete onboarding into the wizard', async () => {
    const user = userEvent.setup()
    meMock.mockResolvedValue(completedProfile(false))
    signInMock.mockResolvedValue({
      status: 'success',
      user: { uid: 'u1' } as never,
      verified: true,
    })
    renderScreen(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true }),
    )
  })

  it('routes an unverified account to the verification screen', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({
      status: 'success',
      user: { uid: 'u1' } as never,
      verified: false,
    })
    renderScreen(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/verify-email', {
        replace: true,
      }),
    )
  })

  it('surfaces a friendly message when credentials are rejected', async () => {
    const user = userEvent.setup()
    signInMock.mockResolvedValue({
      status: 'error',
      message: 'That email and password don’t match. Check your details and try again.',
      code: 'auth/invalid-credential',
    })
    renderScreen(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'wrongpass')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That email and password don’t match.',
    )
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('treats a cancelled Google sign-in as information, not an error', async () => {
    const user = userEvent.setup()
    googleMock.mockResolvedValue({
      status: 'cancelled',
      message: 'Sign-in was cancelled. You can try again any time.',
    })
    renderScreen(<LoginPage />)

    await user.click(screen.getByRole('button', { name: 'Continue with Google' }))

    const cancelled = await screen.findByText(
      'Sign-in was cancelled. You can try again any time.',
    )
    expect(cancelled.closest('.notice')).toHaveClass('notice--info')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('blocks the other buttons while a request is in flight', async () => {
    const user = userEvent.setup()
    let resolveSignIn: ((outcome: AuthOutcome) => void) | undefined
    signInMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve
        }),
    )
    renderScreen(<LoginPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    const googleButton = await screen.findByRole('button', {
      name: 'Continue with Google',
    })
    await waitFor(() => expect(googleButton).toBeDisabled())

    resolveSignIn?.({ status: 'error', message: 'Try again.' })
    await waitFor(() => expect(googleButton).toBeEnabled())
  })
})
