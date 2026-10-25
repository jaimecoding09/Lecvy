import type { ReactElement } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, type RenderResult } from '@testing-library/react'

/** Renders a screen with router context so Link elements resolve. */
export function renderScreen(ui: ReactElement): RenderResult {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>,
  )
}
