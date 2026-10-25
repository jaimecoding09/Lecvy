import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import CreateAccountPage from './CreateAccountPage'
import { signUpWithEmail } from '../lib/auth'
import { readUsernameLocally } from '../lib/profile'

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
  localStorage.clear()
})

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/display name/i), 'Ada Lovelace')
  await user.type(screen.getByLabelText(/username/i), 'Ada.Lovelace')
  await user.type(screen.getByLabelText(/email address/i), 'ada@example.com')
  await user.type(screen.getByLabelText(/^password/i), 'secret123')
}

describe('CreateAccountPage', () => {
  it('shows the specified fields and links', () => {
    renderScreen(<CreateAccountPage />)

    expect(
      screen.getByRole('heading', { name: 'Create your account' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Create account' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByText('Lecvy')).toBeInTheDocument()
  })

  it('rejects a username containing spaces', async () => {
    const user = userEvent.setup()
    renderScreen(<CreateAccountPage />)

    await fillValidForm(user)
    await user.clear(screen.getByLabelText(/username/i))
    await user.type(screen.getByLabelText(/username/i), 'ada lovelace')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(
      await screen.findByText('Usernames cannot contain spaces.'),
    ).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('reports every invalid field at once', async () => {
    const user = userEvent.setup()
    renderScreen(<CreateAccountPage />)

    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter a display name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a username.')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Choose a password.')).toBeInTheDocument()
    expect(signUpMock).not.toHaveBeenCalled()
  })

  it('creates the account with a normalised username and routes to verification', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      status: 'success',
      user: { uid: 'u1' } as never,
      verified: false,
    })
    renderScreen(<CreateAccountPage />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() =>
      expect(signUpMock).toHaveBeenCalledWith({
        displayName: 'Ada Lovelace',
        username: 'ada.lovelace',
        email: 'ada@example.com',
        password: 'secret123',
      }),
    )
    expect(navigateMock).toHaveBeenCalledWith('/verify-email', { replace: true })
    await waitFor(() => expect(readUsernameLocally('u1')).toBe('ada.lovelace'))
  })

  it('surfaces an existing account with a route back to login', async () => {
    const user = userEvent.setup()
    signUpMock.mockResolvedValue({
      status: 'error',
      message: 'An account with this email already exists. Try logging in instead.',
      code: 'auth/email-already-in-use',
    })
    renderScreen(<CreateAccountPage />)

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('An account with this email already exists.')
    expect(
      within(alert).getByRole('link', { name: 'Log in' }),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
