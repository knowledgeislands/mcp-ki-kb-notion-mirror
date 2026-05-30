import * as fs from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let kbRoot: string

const seedRequired = () => {
  process.env.MCP_NOTION_MIRROR_TOKEN = 'ntn_placeholder'
}

const importPaths = () => import('./paths.js')
const real = (p: string) => fs.realpathSync(p)

beforeEach(async () => {
  kbRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'mcp-notion-mirror-paths-'))
  await fsp.mkdir(path.join(kbRoot, 'sub'), { recursive: true })
  await fsp.writeFile(path.join(kbRoot, 'sub', 'note.md'), 'x')
  vi.resetModules()
  seedRequired()
})

afterEach(async () => {
  await fsp.rm(kbRoot, { recursive: true, force: true })
  delete process.env.MCP_NOTION_MIRROR_KB_ROOT
})

describe('resolveKbNotePath (KB_ROOT set)', () => {
  beforeEach(() => {
    process.env.MCP_NOTION_MIRROR_KB_ROOT = kbRoot
    vi.resetModules()
  })

  it('resolves a relative path under the root to the note realpath', async () => {
    const { resolveKbNotePath } = await importPaths()
    expect(resolveKbNotePath('sub/note.md')).toBe(real(path.join(kbRoot, 'sub', 'note.md')))
  })

  it('accepts an absolute path under the root', async () => {
    const { resolveKbNotePath } = await importPaths()
    expect(resolveKbNotePath(path.join(kbRoot, 'sub', 'note.md'))).toBe(real(path.join(kbRoot, 'sub', 'note.md')))
  })

  it('rejects ".." segments', async () => {
    const { resolveKbNotePath, KbPathError } = await importPaths()
    expect(() => resolveKbNotePath('../etc/passwd')).toThrow(KbPathError)
  })

  it('rejects an empty path', async () => {
    const { resolveKbNotePath, KbPathError } = await importPaths()
    expect(() => resolveKbNotePath('   ')).toThrow(KbPathError)
  })

  it('rejects an absolute path outside the root (lexical confinement)', async () => {
    const { resolveKbNotePath } = await importPaths()
    expect(() => resolveKbNotePath('/etc/hosts')).toThrow(/escapes the allowed KB root/)
  })

  it('rejects a symlink that escapes the root (realpath confinement)', async () => {
    const outsideParent = await fsp.mkdtemp(path.join(os.tmpdir(), 'mcp-notion-mirror-outside-'))
    try {
      await fsp.symlink(outsideParent, path.join(kbRoot, 'link'))
      const { resolveKbNotePath } = await importPaths()
      expect(() => resolveKbNotePath('link/escaped.md')).toThrow(/escapes the allowed KB root/)
    } finally {
      await fsp.rm(outsideParent, { recursive: true, force: true })
    }
  })
})

describe('resolveKbNotePath (KB_ROOT unset)', () => {
  it('rejects a relative path', async () => {
    const { resolveKbNotePath, KbPathError } = await importPaths()
    expect(() => resolveKbNotePath('sub/note.md')).toThrow(KbPathError)
  })

  it('accepts an absolute path (no confinement)', async () => {
    const { resolveKbNotePath } = await importPaths()
    const abs = path.join(kbRoot, 'sub', 'note.md')
    expect(resolveKbNotePath(abs)).toBe(real(abs))
  })

  it('still rejects ".." segments', async () => {
    const { resolveKbNotePath, KbPathError } = await importPaths()
    expect(() => resolveKbNotePath('/a/../b')).toThrow(KbPathError)
  })
})
