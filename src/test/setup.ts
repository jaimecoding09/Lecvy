import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library only auto-registers cleanup when test globals exist,
// so this suite does it explicitly.
afterEach(() => {
  cleanup()
})
