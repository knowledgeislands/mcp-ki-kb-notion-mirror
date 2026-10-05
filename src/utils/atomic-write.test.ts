import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { atomicWriteFile } from './atomic-write.js'

vi.mock('node:fs/promises', { spy: true })
const actual = await vi.importActual<typeof fs>('node:fs/promises')
const resetFs = (): void => {
  vi.mocked(fs.open).mockImplementation(actual.open)
  vi.mocked(fs.rename).mockImplementation(actual.rename)
  vi.mocked(fs.lstat).mockImplementation(actual.lstat)
}

describe('atomicWriteFile', () => {
  let dir: string
  beforeEach(async () => {
    resetFs()
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-Alpha-'))
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    resetFs()
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('writes a private new file', async () => {
    const target = path.join(dir, 'Alpha.md')
    await atomicWriteFile(target, 'hello')
    expect(await fs.readFile(target, 'utf8')).toBe('hello')
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600)
  })
  it('supports a valid basename near the filesystem NAME_MAX limit', async () => {
    const target = path.join(dir, `${'Alpha'.repeat(50)}.md`)
    await fs.writeFile(target, 'old')
    await fs.chmod(target, 0o600)
    await atomicWriteFile(target, 'new')
    expect(await fs.readFile(target, 'utf8')).toBe('new')
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600)
    expect(await fs.readdir(dir)).toEqual([path.basename(target)])
  })
  it.each([0o600, 0o640])('preserves target mode %i and leaves no temporary files', async (mode) => {
    const target = path.join(dir, 'Alpha.md')
    await fs.writeFile(target, 'old')
    await fs.chmod(target, mode)
    await atomicWriteFile(target, 'new')
    expect(await fs.readFile(target, 'utf8')).toBe('new')
    expect((await fs.stat(target)).mode & 0o777).toBe(mode)
    expect(await fs.readdir(dir)).toEqual(['Alpha.md'])
  })
  it('refuses missing directories, symlink/nonregular targets and stat errors without claiming temporary ownership', async () => {
    await expect(atomicWriteFile(path.join(dir, 'missing', 'Alpha.md'), 'x')).rejects.toThrow()
    const outside = path.join(dir, 'Beta.md')
    await fs.writeFile(outside, 'untouched')
    const target = path.join(dir, 'Alpha.md')
    await fs.symlink(outside, target)
    await expect(atomicWriteFile(target, 'new')).rejects.toThrow('regular file')
    expect(await fs.readFile(outside, 'utf8')).toBe('untouched')
    await fs.rm(target)
    await fs.mkdir(target)
    await expect(atomicWriteFile(target, 'new')).rejects.toThrow('regular file')
    vi.mocked(fs.lstat).mockRejectedValueOnce(new Error('stat unavailable'))
    await expect(atomicWriteFile(outside, 'new')).rejects.toThrow('stat unavailable')
  })
  it.each(['symlink', 'regular'])('never follows or cleans up a precreated %s staging collision', async (kind) => {
    const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'atomic-Gamma-'))
    const outside = path.join(outsideDir, 'Gamma.md')
    await fs.writeFile(outside, 'outside unchanged')
    const target = path.join(dir, 'Alpha.md')
    await fs.writeFile(target, 'old')
    let collision = ''
    vi.mocked(fs.open).mockImplementation(async (...args) => {
      collision = args[0] as string
      if (kind === 'symlink') await fs.symlink(outside, collision)
      else await fs.writeFile(collision, 'someone else owns this')
      return actual.open(...args)
    })
    try {
      await expect(atomicWriteFile(target, 'new')).rejects.toMatchObject({ code: 'EEXIST' })
      expect(await fs.readFile(target, 'utf8')).toBe('old')
      expect(await fs.readFile(outside, 'utf8')).toBe('outside unchanged')
      expect(await fs.readFile(collision, 'utf8')).toBe(
        kind === 'symlink' ? 'outside unchanged' : 'someone else owns this'
      )
    } finally {
      await fs.rm(outsideDir, { recursive: true, force: true })
    }
  })
  it('cleans up its owned staging file when rename or staged writing fails', async () => {
    const target = path.join(dir, 'Alpha.md')
    await fs.writeFile(target, 'old')
    vi.mocked(fs.rename).mockRejectedValueOnce(new Error('rename failure'))
    await expect(atomicWriteFile(target, 'new')).rejects.toThrow('rename failure')
    expect(await fs.readdir(dir)).toEqual(['Alpha.md'])
    vi.mocked(fs.open).mockImplementation(async (...args) => {
      const handle = await actual.open(...args)
      vi.spyOn(handle, 'writeFile').mockRejectedValueOnce(new Error('stage failure'))
      return handle
    })
    await expect(atomicWriteFile(target, 'new')).rejects.toThrow('stage failure')
    expect(await fs.readdir(dir)).toEqual(['Alpha.md'])
    expect(await fs.readFile(target, 'utf8')).toBe('old')
  })
})
