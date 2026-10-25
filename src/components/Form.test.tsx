import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { renderScreen } from '../test/harness'
import { AuthLayout } from './Form'

const config = vi.hoisted(() => ({ configured: false }))

vi.mock('../lib/firebase', () => ({
  get isFirebaseConfigured() {
    return config.configured
  },
  firebaseConfig: {},
  missingConfigKeys: () => (config.configured ? [] : ['VITE_FIREBASE_API_KEY']),
  getFirebaseAuth: () => {
    throw new Error('not used in this test')
  },
}))

describe('AuthLayout', () => {
  it('asks for configuration while Firebase is not set up', () => {
    config.configured = false
    renderScreen(
      <AuthLayout>
        <p>Screen content</p>
      </AuthLayout>,
    )

    expect(screen.getByText('Setup required')).toBeInTheDocument()
    expect(screen.getByText(/Firebase web config is missing/)).toBeInTheDocument()
    expect(screen.getByText('Screen content')).toBeInTheDocument()
    expect(screen.getByText('Lecvy')).toBeInTheDocument()
  })

  it('stays free of setup chatter once configured', () => {
    config.configured = true
    renderScreen(
      <AuthLayout>
        <p>Screen content</p>
      </AuthLayout>,
    )

    expect(screen.queryByText('Setup required')).toBeNull()
    expect(screen.getByText('Screen content')).toBeInTheDocument()
  })
})
