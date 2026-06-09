/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AIImportModal } from '../../src/components/AIImportModal'
import { AI_IMPORT_SCHEMA } from '../../src/lib/aiImport'
import { resetStore } from '../helpers/store-reset'

const VALID = JSON.stringify({
  $schema: AI_IMPORT_SCHEMA,
  primary_locale: 'en',
  profile: { full_name: 'Jane Doe', summary: 'Engineer.' },
  projects: [{ customer: 'Acme', skills: ['Go', 'Rust'] }],
  educations: [{ school: 'NTNU' }],
})

describe('<AIImportModal>', () => {
  beforeEach(() => resetStore())

  it('shows the three guided steps and a download affordance', () => {
    render(<AIImportModal onImported={() => {}} onClose={() => {}} />)
    expect(screen.getByText(/get the template/i)).toBeInTheDocument()
    expect(screen.getByText(/run it in your llm/i)).toBeInTheDocument()
    expect(screen.getByText(/paste the result back/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download template/i })).toBeInTheDocument()
  })

  it('reports invalid JSON without crashing', async () => {
    render(<AIImportModal onImported={() => {}} onClose={() => {}} />)
    // Paste rather than type — userEvent.type treats `{` as a special-key prefix.
    await userEvent.click(screen.getByLabelText('Import JSON'))
    await userEvent.paste('not json{')
    await userEvent.click(screen.getByRole('button', { name: /preview import/i }))
    expect(screen.getByText(/isn't valid json/i)).toBeInTheDocument()
  })

  it('lists field-pathed issues for JSON that does not match the schema', async () => {
    render(<AIImportModal onImported={() => {}} onClose={() => {}} />)
    const bad = JSON.stringify({ $schema: AI_IMPORT_SCHEMA, projects: 'should be array' })
    // userEvent.type interprets braces specially — paste via clipboard instead.
    await userEvent.click(screen.getByLabelText('Import JSON'))
    await userEvent.paste(bad)
    await userEvent.click(screen.getByRole('button', { name: /preview import/i }))
    expect(screen.getByText(/doesn't match the template/i)).toBeInTheDocument()
    expect(screen.getByText('projects')).toBeInTheDocument()
  })

  it('previews a valid import with counts, then creates on confirm', async () => {
    const onImported = vi.fn()
    render(<AIImportModal onImported={onImported} onClose={() => {}} />)

    await userEvent.click(screen.getByLabelText('Import JSON'))
    await userEvent.paste(VALID)
    await userEvent.click(screen.getByRole('button', { name: /preview import/i }))

    // Preview phase
    expect(await screen.findByText(/ready to import/i)).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    // The count is split across <strong>1</strong> projects — match the whole <li>.
    expect(
      screen.getByText((_, el) => el?.tagName === 'LI' && el.textContent === '1 projects'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /create resume/i }))
    await waitFor(() => expect(onImported).toHaveBeenCalledTimes(1))
    const [store, name] = onImported.mock.calls[0]
    expect(name).toBe('Jane Doe — CV')
    expect(store.projects).toHaveLength(1)
    expect(store.skills).toHaveLength(2)
  })

  it('warns when a parsed import has no content', async () => {
    render(<AIImportModal onImported={() => {}} onClose={() => {}} />)
    await userEvent.click(screen.getByLabelText('Import JSON'))
    await userEvent.paste(JSON.stringify({ $schema: AI_IMPORT_SCHEMA, profile: { full_name: 'Empty' } }))
    await userEvent.click(screen.getByRole('button', { name: /preview import/i }))
    expect(await screen.findByText(/no resume content was found/i)).toBeInTheDocument()
  })

  it('Back from preview returns to the input form', async () => {
    render(<AIImportModal onImported={() => {}} onClose={() => {}} />)
    await userEvent.click(screen.getByLabelText('Import JSON'))
    await userEvent.paste(VALID)
    await userEvent.click(screen.getByRole('button', { name: /preview import/i }))
    expect(await screen.findByText(/ready to import/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText(/paste the result back/i)).toBeInTheDocument()
  })

  it('Cancel calls onClose', async () => {
    const onClose = vi.fn()
    render(<AIImportModal onImported={() => {}} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
