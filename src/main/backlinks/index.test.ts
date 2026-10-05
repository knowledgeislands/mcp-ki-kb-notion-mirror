import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as atomic from '../../utils/atomic-write.js'
import * as paths from '../../utils/paths.js'
import { BACKLINKS_FIELD, BacklinksWriteError, syncBacklinks } from './index.js'

vi.mock('../../utils/paths.js', { spy: true })
const actualPaths = await vi.importActual<typeof paths>('../../utils/paths.js')

vi.mock('node:fs/promises', { spy: true })
const actualFs = await vi.importActual<typeof fs>('node:fs/promises')

const resetFs = (): void => {
  vi.mocked(paths.resolveKbNotePath).mockImplementation(actualPaths.resolveKbNotePath)
  vi.mocked(fs.lstat).mockImplementation(actualFs.lstat)
  vi.mocked(fs.readFile).mockImplementation(actualFs.readFile)
  vi.mocked(fs.readdir).mockImplementation(actualFs.readdir)
}

let root: string
const note = (body = '', extra = ''): string =>
  `---\nhand: 'keep: me' # comment\n${extra}notion_path: Alpha\n---\n\n${body}`
const put = async (p: string, raw = note()): Promise<void> => {
  await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true })
  await fs.writeFile(path.join(root, p), raw)
}
const scalar = (sources: string[]): string => JSON.stringify(JSON.stringify({ v: 1, sources }))
const run = (options: { kb_path?: string; dry_run?: boolean } = {}) => syncBacklinks({ kbRoot: root }, options)

beforeEach(async () => {
  resetFs()
  root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'backlinks-Alpha-')))
})
afterEach(async () => {
  vi.restoreAllMocks()
  resetFs()
  await fs.rm(root, { recursive: true, force: true })
})

describe('local backlinks surgical writes', () => {
  it('previews without any writes, resolves aliases, deduplicates and replaces stale data preserving every other byte', async () => {
    const original = note(
      '[[Alpha]]',
      `hand_reference: '${BACKLINKS_FIELD}'\n# ${BACKLINKS_FIELD} belongs to the generator\n${BACKLINKS_FIELD}: ${scalar(['Gamma.md'])}\n`
    )
    await put('Alpha.md', original)
    await put('Beta.md', note('[[Alpha]] [[Alpha#Heading|Alias]]\n`[[Gamma]]`'))
    await put('Gamma.md', '[[Alpha]]')
    await put('.hidden/Delta.md', '[[Alpha]]')
    await put('node_modules/Delta.md', '[[Alpha]]')
    await put('other.txt', 'plain')
    const writeSpy = vi.spyOn(atomic, 'atomicWriteFile')
    const report = await run()
    expect(report.note_count).toBe(3)
    expect(report.scan_complete).toBe(true)
    expect(report.resolution_complete).toBe(true)
    expect(report.skipped_without_frontmatter).toEqual(['Gamma.md'])
    expect(report.proposals[0]?.sources).toEqual(['Alpha.md', 'Beta.md', 'Gamma.md'])
    expect(await fs.readFile(path.join(root, 'Alpha.md'), 'utf8')).toBe(original)
    expect(writeSpy).not.toHaveBeenCalled()
    const applied = await run({ dry_run: false, kb_path: 'Alpha.md' })
    expect(applied.written).toEqual(['Alpha.md'])
    expect(await fs.readFile(path.join(root, 'Alpha.md'), 'utf8')).toBe(
      original.replace(scalar(['Gamma.md']), scalar(['Alpha.md', 'Beta.md', 'Gamma.md']))
    )
    expect((await run({ dry_run: false, kb_path: 'Alpha.md' })).written).toEqual([])
    await put('Beta.md', note())
    await put('Gamma.md', '')
    await put('Alpha.md', note('', `${BACKLINKS_FIELD}: ${scalar(['Alpha.md', 'Beta.md', 'Gamma.md'])}\n`))
    await run({ dry_run: false })
    expect((await run()).proposals[0]?.sources).toEqual([])
  })
  it('reports unresolved targets honestly and refuses ambiguous writes before mutating any file', async () => {
    await put('Alpha.md', note('[[Beta]] [[Missing]]'))
    await put('Omega/Beta.md')
    await put('Gamma/Beta.md')
    const preview = await run()
    expect(preview.resolution_complete).toBe(false)
    expect(preview.unresolved[0]?.target).toBe('Missing')
    expect(preview.ambiguous).toHaveLength(1)
    const writeSpy = vi.spyOn(atomic, 'atomicWriteFile')
    await expect(run({ dry_run: false })).rejects.toThrow('Ambiguous')
    expect(writeSpy).not.toHaveBeenCalled()
    await fs.rm(path.join(root, 'Gamma/Beta.md'))
    expect((await run({ dry_run: false })).resolution_complete).toBe(false)
  })
  it('requires configured root, visible target and frontmatter without inventing any', async () => {
    await expect(syncBacklinks({ kbRoot: undefined })).rejects.toThrow('must be set')
    await put('Alpha.md', '[[Beta]]')
    await expect(run({ kb_path: 'Alpha.md' })).rejects.toThrow('no LF YAML')
    await expect(run({ kb_path: 'Missing.md' })).rejects.toThrow('outside')
    await expect(run({ kb_path: '../Alpha.md' })).rejects.toThrow('must not contain')
  })
  it.each([
    `${BACKLINKS_FIELD}: handmade\n`,
    `"${BACKLINKS_FIELD}": ${scalar([])}\n`,
    `${BACKLINKS_FIELD}: ${scalar([])}\n${BACKLINKS_FIELD}: ${scalar([])}\n`,
    `${BACKLINKS_FIELD}: |\n  hand-written notes\n`,
    `${BACKLINKS_FIELD}: ${scalar([])}\n\n# comment\n  continuation\n`,
    `  ${BACKLINKS_FIELD}: ${scalar([])}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 2, sources: [] }))}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 1, sources: ['../Alpha.md'] }))}\n`,
    `${BACKLINKS_FIELD}: ${scalar(['Beta.md', 'Alpha.md'])}\n`,
    `${BACKLINKS_FIELD}: ${scalar(['Alpha.md', 'Alpha.md'])}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 1, sources: [], hand: true }))}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify('null')}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 1, sources: 'Alpha' }))}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 1, sources: [1] }))}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify(JSON.stringify({ v: 1, sources: Array(20001).fill('Alpha.md') }))}\n`,
    `${BACKLINKS_FIELD}: ${JSON.stringify('{ "v": 1, "sources": [] }')}\n`
  ])('refuses unsafe generated ownership: %s', async (extra) => {
    await put('Alpha.md', note('', extra))
    const writeSpy = vi.spyOn(atomic, 'atomicWriteFile')
    await expect(run({ dry_run: false })).rejects.toThrow(/generated backlinks/)
    expect(writeSpy).not.toHaveBeenCalled()
  })
  it('appends new backlinks after complete multiline anchors, preserving every other byte and private permissions', async () => {
    const raw = '---\nhand: preserve\nnotion_path: |\n  root\n  child\n---\n\nbody'
    await put('Alpha.md', raw)
    await fs.chmod(path.join(root, 'Alpha.md'), 0o600)
    await run({ dry_run: false, kb_path: 'Alpha.md' })
    expect(await fs.readFile(path.join(root, 'Alpha.md'), 'utf8')).toBe(
      raw.replace('\n---\n\nbody', `\n${BACKLINKS_FIELD}: ${scalar([])}\n---\n\nbody`)
    )
    expect((await fs.stat(path.join(root, 'Alpha.md'))).mode & 0o777).toBe(0o600)
  })
  it('accepts an existing final frontmatter line and preserves unchanged lines', async () => {
    await put('Alpha.md', `---\n${BACKLINKS_FIELD}: ${scalar([])}\n---\nbody`)
    expect((await run()).proposals[0]?.changed).toBe(false)
    await put('Beta.md', note('[[Alpha]]'))
    expect((await run()).proposals[0]?.changed).toBe(true)
  })
})

describe('backlinks fail-closed scan and prewrite boundaries', () => {
  it('rejects symlinks, malformed UTF8, unreadable entries and nonregular files', async () => {
    await fs.symlink(root, path.join(root, 'Alpha'))
    await expect(run()).rejects.toThrow('Symlink')
    await fs.rm(path.join(root, 'Alpha'))
    await fs.writeFile(path.join(root, 'Alpha.md'), Buffer.from([0xff]))
    await expect(run()).rejects.toThrow('Non-UTF8')
    await fs.rm(path.join(root, 'Alpha.md'))
    vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('unreadable'))
    await put('Alpha.md')
    await expect(run()).rejects.toThrow('unreadable')
    vi.restoreAllMocks()
    resetFs()
    const original = actualFs.lstat
    vi.spyOn(fs, 'lstat').mockImplementation(async (...args) =>
      args[0] === path.join(root, 'Alpha.md')
        ? ({ isSymbolicLink: () => false, isDirectory: () => false, isFile: () => false } as Awaited<
            ReturnType<typeof fs.lstat>
          >)
        : original(...args)
    )
    await expect(run()).rejects.toThrow('Nonregular')
  })
  it('fails on unsafe paths, depth, file/entry/byte bounds and never returns a truncated complete graph', async () => {
    await put('Alpha\n.md')
    await expect(run()).rejects.toThrow('Unsafe backlink note path')
    await fs.rm(path.join(root, 'Alpha\n.md'))
    await put(`${Array(34).fill('Alpha').join('/')}/Beta.md`)
    await expect(run()).rejects.toThrow('depth bound')
    await fs.rm(path.join(root, 'Alpha'), { recursive: true })
    await put('Alpha.md', 'x'.repeat(1024 * 1024 + 1))
    await expect(run()).rejects.toThrow('file bound')
    await fs.rm(path.join(root, 'Alpha.md'))
    const readDir = actualFs.readdir
    vi.spyOn(fs, 'readdir').mockImplementation(async (...args) =>
      args[0] === root ? (Array(10001).fill('Alpha.txt') as never) : readDir(...args)
    )
    await put('Alpha.txt')
    await expect(run()).rejects.toThrow('entry bound')
    vi.restoreAllMocks()
    resetFs()
    await fs.rm(path.join(root, 'Alpha.txt'))
    for (let i = 0; i < 2001; i++) await put(`Alpha${i}.md`)
    await expect(run()).rejects.toThrow('file bound')
    await fs.rm(root, { recursive: true })
    await fs.mkdir(root)
    for (let i = 0; i < 33; i++) await put(`Alpha${i}.md`, 'x'.repeat(1024 * 1024))
    await expect(run()).rejects.toThrow('byte bound')
    await fs.rm(root, { recursive: true })
    await fs.mkdir(root)
    await put('Alpha.md')
    vi.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.alloc(1024 * 1024 + 1))
    await expect(run()).rejects.toThrow('byte bound')
  }, 30000)
  it('refuses prepared output growth beyond the readable file or total scope budgets before any mutation', async () => {
    const maxBytes = 1024 * 1024
    const raw = note('x'.repeat(maxBytes - Buffer.byteLength(note())))
    await put('Alpha.md', raw)
    const write = vi.spyOn(atomic, 'atomicWriteFile')
    await expect(run({ dry_run: false })).rejects.toThrow('per-file byte bound')
    expect(await fs.readFile(path.join(root, 'Alpha.md'), 'utf8')).toBe(raw)
    expect(write).not.toHaveBeenCalled()
    await fs.rm(path.join(root, 'Alpha.md'))
    const perFile = Math.floor((32 * maxBytes) / 33)
    const scopedRaw = note('x'.repeat(perFile - Buffer.byteLength(note())))
    for (let i = 0; i < 33; i++) await put(`Alpha${i}.md`, scopedRaw)
    await expect(run({ dry_run: false })).rejects.toThrow('total scope byte bound')
    expect(write).not.toHaveBeenCalled()
    expect(await fs.readFile(path.join(root, 'Alpha0.md'), 'utf8')).toBe(scopedRaw)
  })
  it('detects source content or membership drift before any writes', async () => {
    await put('Alpha.md')
    const read = actualFs.readFile
    let reads = 0
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) => {
      const result = await read(...args)
      return ++reads === 2 ? (Buffer.from(note('changed')) as never) : result
    })
    await expect(run({ dry_run: false })).rejects.toThrow('source or membership drift')
    vi.restoreAllMocks()
    resetFs()
    const readdir = actualFs.readdir
    let walks = 0
    vi.spyOn(fs, 'readdir').mockImplementation(async (...args) => {
      if (++walks === 2) await put('Beta.md')
      return readdir(...args)
    })
    await expect(run({ dry_run: false })).rejects.toThrow('source or membership drift')
  })
  it('reports partial application truthfully if a later atomic replacement fails', async () => {
    await put('Alpha.md')
    await put('Beta.md')
    const write = atomic.atomicWriteFile
    vi.spyOn(atomic, 'atomicWriteFile').mockImplementation(async (absolute, raw) => {
      if (absolute.endsWith('Beta.md')) throw new Error('disk failure')
      await write(absolute, raw)
    })
    try {
      await run({ dry_run: false })
      throw new Error('expected failure')
    } catch (error) {
      expect(error).toBeInstanceOf(BacklinksWriteError)
      expect((error as BacklinksWriteError).written).toEqual(['Alpha.md'])
      expect(String(error)).toContain('disk failure')
    }
    expect(await fs.readFile(path.join(root, 'Beta.md'), 'utf8')).toBe(note())
  })
  it('fails closed on scanner identity drift, configured-root drift and late symlink replacement', async () => {
    await put('Alpha.md')
    let resolves = 0
    vi.mocked(paths.resolveKbNotePath).mockImplementation((...args) =>
      ++resolves === 2 ? path.join(root, 'Gamma.md') : actualPaths.resolveKbNotePath(...args)
    )
    await expect(run()).rejects.toThrow('Backlink path drift')
    resetFs()
    const other = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'backlinks-Gamma-')))
    try {
      resolves = 0
      vi.mocked(paths.resolveKbNotePath).mockImplementation((...args) =>
        ++resolves === 3 ? other : actualPaths.resolveKbNotePath(...args)
      )
      await expect(run({ dry_run: false })).rejects.toThrow('source or membership drift')
    } finally {
      await fs.rm(other, { recursive: true })
      resetFs()
    }
    let stats = 0
    vi.mocked(fs.lstat).mockImplementation(async (...args) =>
      ++stats === 3 ? ({ isSymbolicLink: () => true } as Awaited<ReturnType<typeof fs.lstat>>) : actualFs.lstat(...args)
    )
    await expect(run({ dry_run: false })).rejects.toThrow('Backlink target drift')
    resetFs()
    resolves = 0
    vi.mocked(paths.resolveKbNotePath).mockImplementation((...args) =>
      ++resolves === 5 ? path.join(root, 'Gamma.md') : actualPaths.resolveKbNotePath(...args)
    )
    await expect(run({ dry_run: false })).rejects.toThrow('Backlink target drift')
  })
  it('detects a last-moment target drift and returns a truthful empty write list', async () => {
    await put('Alpha.md')
    const read = actualFs.readFile
    let reads = 0
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) =>
      ++reads === 3 ? (note('drift') as never) : read(...args)
    )
    await expect(run({ dry_run: false })).rejects.toThrow('Backlink target drift')
  })
})
