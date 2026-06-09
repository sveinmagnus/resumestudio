import { describe, it, expect } from 'vitest'
import { buildNotifyCommand } from '../../server/desktop/notify'

describe('buildNotifyCommand', () => {
  it('Windows → PowerShell MessageBox with single-quote escaping', () => {
    const c = buildNotifyCommand('Resume Studio', "It's current", 'win32')
    expect(c.cmd).toBe('powershell')
    const script = c.args[c.args.length - 1]
    expect(script).toContain('System.Windows.Forms.MessageBox')
    expect(script).toContain("'It''s current'") // '' escapes the apostrophe
    expect(script).toContain("'Resume Studio'")
    // no unescaped double quotes that Node's arg quoting would mangle
    expect(script).not.toContain('"')
  })

  it('macOS → osascript display dialog with double-quote escaping', () => {
    const c = buildNotifyCommand('Resume Studio', 'say "hi"\\done', 'darwin')
    expect(c.cmd).toBe('osascript')
    expect(c.args[0]).toBe('-e')
    expect(c.args[1]).toContain('display dialog')
    expect(c.args[1]).toContain('\\"hi\\"')   // escaped quotes
    expect(c.args[1]).toContain('\\\\done')   // escaped backslash
  })

  it('Linux → notify-send with title + message as direct args (no shell)', () => {
    const c = buildNotifyCommand('Resume Studio', 'up to date', 'linux')
    expect(c).toEqual({ cmd: 'notify-send', args: ['Resume Studio', 'up to date'] })
  })
})
