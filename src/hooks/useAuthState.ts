import { useEffect, useState } from 'react'
import type { User } from 'firebase/auth'

import { subscribeToAuth } from '../lib/auth'
import { isFirebaseConfigured } from '../lib/firebase'

type AuthState = { user: User | null; loading: boolean }

/**
 * Tracks the current Firebase session. When Firebase is not configured yet the
 * state settles to a signed-out, non-loading result so routes render normally.
 */
export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(() => ({
    user: null,
    loading: isFirebaseConfigured,
  }))

  useEffect(() => {
    if (!isFirebaseConfigured) return
    return subscribeToAuth((user) => setState({ user, loading: false }))
  }, [])

  return state
}
