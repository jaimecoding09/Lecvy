import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import VerifyEmailPage from './VerifyEmailPage'
import {
  refreshCurrentUser,
  resendVerificationEmail,
  signOutUser,
} from '../lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())
const session = vi.hoisted(() => ({
  value: {
    loading: false,
    user: {
      uid: 'u1',
      email: 'ada@example.com',
      emailVerified: false,
      displayName: 'Ada Lovelace',
    } as never,
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../hooks/useAuthState', () => ({
  useAuthState: () => session.value,
}))

vi.mock('../lib/auth', () => ({
  refreshCurrentUser: vi.fn(),
  resendVerificationEmail: vi.fn(),
  signOutUser: vi.fn(),
}))

const refreshMock = vi.mocked(refreshCurrentUser)
const resendMock = vi.mocked(resendVerificationEmail)
const signOutMock = vi.mocked(signOutUser)

beforeEach(() => {
  vi.clearAllMocks()
  session.value = {
    loading: false,
    user: {
      uid: 'u1',
      email: 'ada@example.com',
      emailVerified: false,
      displayName: 'Ada Lovelace',
    } as never,
  }
})

describe('VerifyEmailPage', () => {
  it('shows the pending state with the address and actions', () => {
    renderScreen(<VerifyEmailPage />)

    expect(
      screen.getByRole('heading', { name: 'Verify your email' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText('ada@example.com').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('button', { name: 'I’ve verified — continue' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Resend verification email' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument()
  })

  it('confirms when the verification email is resent', async () => {
    const user = userEvent.setup()
    resendMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<VerifyEmailPage />)

    await user.click(
      screen.getByRole('button', { name: 'Resend verification email' }),
    )

    expect(
      await screen.findByText('Verification email sent again.'),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Resend in 30s/ }),
      ).toBeDisabled(),
    )
  })

  it('keeps the user on the page when the email is still unverified', async () => {
    const user = userEvent.setup()
    refreshMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<VerifyEmailPage />)

    await user.click(screen.getByRole('button', { name: 'I’ve verified — continue' }))

    expect(
      await screen.findByText(/not verified yet/),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('routes to the account screen once verification succeeds', async () => {
    const user = userEvent.setup()
    refreshMock.mockResolvedValue({ status: 'success', user: null, verified: true })
    renderScreen(<VerifyEmailPage />)

    await user.click(screen.getByRole('button', { name: 'I’ve verified — continue' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/account', { replace: true }),
    )
  })

  it('logs out back to the login screen', async () => {
    const user = userEvent.setup()
    signOutMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<VerifyEmailPage />)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true }),
    )
    expect(signOutMock).toHaveBeenCalled()
  })
})
