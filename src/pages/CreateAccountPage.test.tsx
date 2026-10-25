import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import CreateAccountPage from './CreateAccountPage'
import { signUpWithEmail } from '../lib/auth'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../lib/auth', () => ({
  signUpWithEmail: vi.fn(),
}))

const signUpMock = vi.mocked(signUpWithEmail)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CreateAccountPage', () => {
  it('asks only for email and password', () => {
    renderScreen(<CreateAccountPage />)

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/display name/i)).toBeNull()
    expect(screen.queryByLabelText(/username/i)).toBeNull()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
  })

  it('reports invalid fields without calling Firebase', async () => {
    const user = userEvent.setup()
    renderScreen(<CreateAccountPage />)

    await user.type(screen.getByLabelText(/email address/i), 'nope')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(screen.getByText('Choose a password.')).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('creates the Firebase account then routes to email verification', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({ status: 'success', user: { uid: 'u1' } as never, verified: false })
    renderScreen(<CreateAccountPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(signUpMock).toHaveBeenCalledWith({ email: 'ada@example.com', password: 'secret123' }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/verify-email', { replace: true })
  })

  it('surfaces an existing account with a route back to login', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      status: 'error',
      message: 'An account with this email already exists. Try logging in instead.',
      code: 'auth/email-already-in-use',
    })
    renderScreen(<CreateAccountPage />)

    await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
    await user.type(screen.getByLabelText(/^password/i), 'secret123')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An account with this email already exists.')
    expect(within(alert).getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
