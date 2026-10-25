import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import ForgotPasswordPage from './ForgotPasswordPage'
import { sendPasswordReset } from '../lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/auth', () => ({
  sendPasswordReset: vi.fn(),
}))

const resetMock = vi.mocked(sendPasswordReset)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ForgotPasswordPage', () => {
  it('shows the heading, explanation, field, and return link', () => {
    renderScreen(<ForgotPasswordPage />)

    expect(
      screen.getByRole('heading', { name: 'Forgot password?' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/we’ll send you a link to reset your password/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Back to log in' }),
    ).toBeInTheDocument()
  })

  it('does not send for an invalid email', async () => {
    const user = userEvent.setup()
    renderScreen(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(resetMock).not.toHaveBeenCalled()
  })

  it('shows the success state after the reset email is sent', async () => {
    const user = userEvent.setup()
    resetMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('heading', { name: 'Check your inbox' })).toBeInTheDocument()
    expect(screen.getByText(/ada@example.com/)).toBeInTheDocument()
    expect(resetMock).toHaveBeenCalledWith('ada@example.com')
  })

  it('returns to the form when a different email is requested', async () => {
    const user = userEvent.setup()
    resetMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await screen.findByRole('heading', { name: 'Check your inbox' })

    await user.click(screen.getByRole('button', { name: 'Use a different email' }))

    expect(
      screen.getByRole('button', { name: 'Send reset link' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toHaveValue('')
  })

  it('navigates back to login from the success state', async () => {
    const user = userEvent.setup()
    resetMock.mockResolvedValue({ status: 'success', user: null, verified: false })
    renderScreen(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    await screen.findByRole('heading', { name: 'Check your inbox' })

    await user.click(screen.getByRole('button', { name: 'Back to log in' }))
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true })
  })

  it('shows an error when the reset request fails', async () => {
    const user = userEvent.setup()
    resetMock.mockResolvedValue({
      status: 'error',
      message: 'Too many attempts. Please wait a moment and try again.',
      code: 'auth/too-many-requests',
    })
    renderScreen(<ForgotPasswordPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Too many attempts.',
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Send reset link' }),
      ).toBeEnabled(),
    )
  })
})
