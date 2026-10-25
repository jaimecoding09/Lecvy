import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import OnboardingPage from './OnboardingPage'
import {
  checkUsername,
  getMe,
  saveDateOfBirth,
  saveDisplayName,
  saveUsername,
  skipAvatar,
  type MeResponse,
} from '../lib/api'

const navigateMock = vi.hoisted(() => vi.fn())

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../hooks/useAuthState', () => ({
  useAuthState: () => ({
    loading: false,
    user: {
      uid: 'u1',
      email: 'ada@example.com',
      emailVerified: true,
      displayName: 'Ada Lovelace',
      providerData: [{ providerId: 'password' }],
    },
  }),
}))

vi.mock('../lib/api', () => ({
  getMe: vi.fn(),
  saveDisplayName: vi.fn(),
  checkUsername: vi.fn(),
  saveUsername: vi.fn(),
  uploadAvatar: vi.fn(),
  skipAvatar: vi.fn(),
  saveDateOfBirth: vi.fn(),
  completeOnboarding: vi.fn(),
}))

const getMeMock = vi.mocked(getMe)
const saveNameMock = vi.mocked(saveDisplayName)
const checkMock = vi.mocked(checkUsername)
const saveUsernameMock = vi.mocked(saveUsername)
const saveDobMock = vi.mocked(saveDateOfBirth)
const skipMock = vi.mocked(skipAvatar)

function me(overrides: Partial<MeResponse['profile']> = {}, nextStep: MeResponse['onboarding']['nextStep'] = 'name'): MeResponse {
  return {
    profile: {
      uid: 'u1',
      email: 'ada@example.com',
      displayName: null,
      username: null,
      avatarUrl: null,
      dateOfBirth: null,
      onboardingCompleted: false,
      ...overrides,
    },
    onboarding: { nextStep, completedSteps: [], canComplete: nextStep === 'complete' },
  }
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/onboarding/:step" element={<OnboardingPage />} />
        <Route path="/home" element={<div>home-screen</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('OnboardingPage', () => {
  it('saves the display name and moves to the username step', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({ ok: true, data: me() })
    saveNameMock.mockResolvedValue({ ok: true, data: me({ displayName: 'Ada' }, 'username') })
    renderAt('/onboarding/name')

    expect(await screen.findByRole('heading', { name: 'Your name' })).toBeInTheDocument()
    const input = screen.getByLabelText(/display name/i)
    await user.clear(input)
    await user.type(input, 'Ada')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(saveNameMock).toHaveBeenCalledWith('Ada'))
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/username', { replace: true })
  })

  it('blocks an invalid display name before calling the API', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({ ok: true, data: me() })
    renderAt('/onboarding/name')

    await screen.findByRole('heading', { name: 'Your name' })
    const input = screen.getByLabelText(/display name/i)
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Enter a display name.')).toBeInTheDocument()
    expect(saveNameMock).not.toHaveBeenCalled()
  })

  it('checks username availability and saves a free username', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({ ok: true, data: me({ displayName: 'Ada' }, 'username') })
    checkMock.mockResolvedValue({
      ok: true,
      data: { available: true, normalized: 'ada', reason: null },
    })
    saveUsernameMock.mockResolvedValue({
      ok: true,
      data: me({ displayName: 'Ada', username: 'ada' }, 'photo'),
    })
    renderAt('/onboarding/username')

    const input = await screen.findByLabelText(/username/i)
    await user.type(input, 'ada')
    await waitFor(() => expect(checkMock).toHaveBeenCalled())
    expect(await screen.findByText(/@ada is available/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await waitFor(() => expect(saveUsernameMock).toHaveBeenCalledWith('ada'))
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/photo', { replace: true })
  })

  it('reports a username that was taken in the meantime', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({ ok: true, data: me({ displayName: 'Ada' }, 'username') })
    checkMock.mockResolvedValue({
      ok: true,
      data: { available: true, normalized: 'ada', reason: null },
    })
    saveUsernameMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'That username is already taken.',
      code: 'username_taken',
    })
    renderAt('/onboarding/username')

    await user.type(await screen.findByLabelText(/username/i), 'ada')
    expect(await screen.findByText(/@ada is available/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText('That username was just taken. Try another.'),
    ).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('rejects an under-age or future date of birth before saving', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({
      ok: true,
      data: me({ displayName: 'Ada', username: 'ada', avatarUrl: null }, 'dob'),
    })
    renderAt('/onboarding/dob')

    const input = await screen.findByLabelText(/date of birth/i)
    await user.type(input, '2999-01-01')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('Date of birth cannot be in the future.')).toBeInTheDocument()
    expect(saveDobMock).not.toHaveBeenCalled()
  })

  it('lets the user skip the photo step', async () => {
    const user = userEvent.setup()
    getMeMock.mockResolvedValue({
      ok: true,
      data: me({ displayName: 'Ada', username: 'ada' }, 'photo'),
    })
    skipMock.mockResolvedValue({
      ok: true,
      data: me({ displayName: 'Ada', username: 'ada' }, 'dob'),
    })
    renderAt('/onboarding/photo')

    await user.click(await screen.findByRole('button', { name: 'Skip for now' }))
    await waitFor(() => expect(skipMock).toHaveBeenCalled())
    expect(navigateMock).toHaveBeenCalledWith('/onboarding/dob', { replace: true })
  })

  it('sends a completed user to home', async () => {
    getMeMock.mockResolvedValue({
      ok: true,
      data: me({ displayName: 'Ada', username: 'ada', onboardingCompleted: true }, 'complete'),
    })
    renderAt('/onboarding/name')

    expect(await screen.findByText('home-screen')).toBeInTheDocument()
  })

  it('prevents skipping ahead to a later step', async () => {
    getMeMock.mockResolvedValue({ ok: true, data: me({ displayName: 'Ada' }, 'username') })
    renderAt('/onboarding/dob')

    // The router redirects to the required step instead of rendering the date field.
    expect(await screen.findByLabelText(/username/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/date of birth/i)).toBeNull()
  })
})
