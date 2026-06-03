/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthGate } from '../../src/components/AuthGate'
import { UnauthorizedError, setStoredToken, getStoredToken } from '../../src/lib/api'
import { savePending, loadPending } from '../../src/lib/localCache'
import { emptyStore } from '../fixtures'

const pending = (id: string, dirty = true) =>
  savePending(id, { data: emptyStore(), locales: { primary: 'en', secondary: null }, base_version: 1, dirty })

describe('<AuthGate>', () => {
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.restoreAllMocks() })
  it('disables Connect until a token is entered', () => {
    render(<AuthGate onSubmit={vi.fn()} />)
    expect(screen.getByRole('button', { name: /connect/i })).toBeDisabled()
  })

  it('submits the entered token', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AuthGate onSubmit={onSubmit} />)
    await userEvent.type(screen.getByPlaceholderText(/paste token/i), 'my-token')
    await userEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(onSubmit).toHaveBeenCalledWith('my-token')
  })

  it('shows an "incorrect token" message on UnauthorizedError', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new UnauthorizedError())
    render(<AuthGate onSubmit={onSubmit} />)
    await userEvent.type(screen.getByPlaceholderText(/paste token/i), 'bad')
    await userEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(await screen.findByText(/token is incorrect/i)).toBeInTheDocument()
  })

  it('shows a connection error for other failures', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('network'))
    render(<AuthGate onSubmit={onSubmit} />)
    await userEvent.type(screen.getByPlaceholderText(/paste token/i), 'x')
    await userEvent.click(screen.getByRole('button', { name: /connect/i }))
    expect(await screen.findByText(/could not connect/i)).toBeInTheDocument()
  })

  // Security skill §4: explicit logout must wipe the local plaintext resume
  // caches, not just the token, so a shared machine doesn't retain the CV.
  it('"Clear saved token" wipes token + caches with no prompt when nothing is unsynced', async () => {
    setStoredToken('a-token')
    pending('r1', false)
    pending('r2', false)
    const confirmSpy = vi.spyOn(window, 'confirm')

    render(<AuthGate onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /clear saved token/i }))

    expect(confirmSpy).not.toHaveBeenCalled()
    expect(getStoredToken()).toBeNull()
    expect(loadPending('r1')).toBeNull()
    expect(loadPending('r2')).toBeNull()
  })

  it('prompts before wiping when there are unsynced changes, and clears on confirm', async () => {
    setStoredToken('a-token')
    pending('r1', true)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<AuthGate onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /clear saved token/i }))

    expect(getStoredToken()).toBeNull()
    expect(loadPending('r1')).toBeNull()
  })

  it('keeps the token AND the caches when the user cancels the unsynced-changes prompt', async () => {
    setStoredToken('a-token')
    pending('r1', true)
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<AuthGate onSubmit={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /clear saved token/i }))

    // Nothing discarded — unsynced work is preserved.
    expect(getStoredToken()).toBe('a-token')
    expect(loadPending('r1')).not.toBeNull()
  })
})
