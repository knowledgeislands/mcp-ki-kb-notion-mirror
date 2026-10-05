import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Config } from '../../config/index.js'
import { uploadImage } from '../notion-client/index.js'
import { renderImages, uploadRenderedImages } from './images.js'

vi.mock('node:fs/promises', { spy: true })
let root: string
let cfg: Config
const page = 'a'.repeat(32)
const upload = 'b'.repeat(32)
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'Alpha-images-'))
  cfg = {
    imagesEnabled: true,
    kbRoot: root,
    auditLogPath: path.join(root, 'state', 'audit.jsonl'),
    notionApiBaseUrl: 'https://api.notion.test/v1',
    notionApiVersion: '2022-06-28',
    notionToken: 'synthetic-secret'
  } as Config
  await fs.mkdir(path.join(root, 'Alpha - images'))
  await fs.writeFile(path.join(root, 'Alpha - images', 'Beta.png'), 'alpha')
})
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await fs.rm(root, { recursive: true, force: true })
})
const render = (body = '![Beta](Alpha - images/Beta.png)') => renderImages(cfg, path.join(root, 'Alpha.md'), body)
const api = () =>
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (_url, opts) =>
        new Response(JSON.stringify(opts.body instanceof FormData ? { status: 'uploaded' } : { id: upload }))
    )
  )
it('keeps disabled rendering and empty upload preparation free of calls/state', async () => {
  cfg.imagesEnabled = false
  const rendered = await render()
  expect(rendered.assets).toEqual([])
  const prepared = await uploadRenderedImages(cfg, 'Alpha', page, rendered)
  expect(prepared.blocks).toEqual(rendered.blocks)
  await prepared.persist()
  expect(await fs.readdir(root)).toEqual(['Alpha - images'])
})
it('renders stable byte identity, captions, inline text, repeated images and code literally', async () => {
  const rendered = await render(
    'before ![Beta](Alpha - images/Beta.png) after\n\n![](Alpha - images/Beta.png)\n\n`![Code](outside.png)`\n\n```md\n![Code](outside.png)\n```\n\n![Remote](https://example.test/a.png)'
  )
  expect(rendered.assets).toHaveLength(2)
  expect(JSON.stringify(rendered.blocks)).toContain('ki-image.invalid/')
  expect(JSON.stringify(rendered.blocks)).toContain('before ')
  expect(JSON.stringify(rendered.blocks)).toContain('outside.png')
  const original = rendered.assets[0]!.hash
  await fs.writeFile(path.join(root, 'Alpha - images', 'Beta.png'), 'omega')
  expect((await render()).assets[0]!.hash).not.toBe(original)
})
it('handles nested blocks and ordinary record/primitive traversal', async () => {
  const rendered = await render('- ![Beta](Alpha - images/Beta.png)\n\nplain **text**')
  expect(rendered.assets).toHaveLength(1)
  api()
  const prepared = await uploadRenderedImages(cfg, 'Alpha', page, rendered)
  expect(JSON.stringify(prepared.blocks)).toContain(upload)
})
it('rejects traversal, absolute paths, backslashes, outside siblings, symlink escapes and unsupported extensions', async () => {
  for (const ref of ['../Beta.png', '/tmp/Beta.png', 'Alpha\\Beta.png', 'Other.png'])
    await expect(render(`![Beta](${ref})`)).rejects.toThrow()
  await fs.writeFile(path.join(root, 'Alpha - images', 'Beta.txt'), 'x')
  await expect(render('![Beta](Alpha - images/Beta.txt)')).rejects.toThrow('Unsupported')
  await fs.symlink(path.join(root, 'Alpha - images', 'Beta.png'), path.join(root, 'Other.png'))
  await fs.symlink(path.join(root, 'Other.png'), path.join(root, 'Alpha - images', 'Escape.png'))
  // A real outside sibling file is rejected even when still inside the configured KB.
  await fs.writeFile(path.join(root, 'Gamma.png'), 'x')
  await fs.symlink(path.join(root, 'Gamma.png'), path.join(root, 'Alpha - images', 'Escape2.png'))
  await expect(render('![Beta](Alpha - images/Escape2.png)')).rejects.toThrow()
})
it('rejects directories, overlarge files, changed size, count and aggregate budgets', async () => {
  await fs.mkdir(path.join(root, 'Alpha - images', 'Folder.png'))
  await expect(render('![Beta](Alpha - images/Folder.png)')).rejects.toThrow('file')
  await fs.writeFile(path.join(root, 'Alpha - images', 'Large.png'), Buffer.alloc(5 * 1024 * 1024 + 1))
  await expect(render('![Beta](Alpha - images/Large.png)')).rejects.toThrow('5 MiB')
  let body = ''
  for (let i = 0; i < 17; i++) {
    await fs.writeFile(path.join(root, 'Alpha - images', `${i}.png`), 'x')
    body += `![Beta](Alpha - images/${i}.png)\n\n`
  }
  await expect(render(body)).rejects.toThrow('budget')
  body = ''
  for (let i = 0; i < 5; i++) {
    await fs.writeFile(path.join(root, 'Alpha - images', `${i}.png`), Buffer.alloc(5 * 1024 * 1024))
    body += `![Beta](Alpha - images/${i}.png)\n\n`
  }
  await expect(render(body)).rejects.toThrow('budget')
  const read = vi.spyOn(fs, 'readFile').mockResolvedValueOnce(Buffer.alloc(5 * 1024 * 1024 + 1))
  await expect(render()).rejects.toThrow('grew')
  read.mockRestore()
})
it('uploads multipart via trusted endpoint, persists only after attach and reuses cache or refreshes', async () => {
  api()
  const rendered = await render('![Beta](Alpha - images/Beta.png)\n\n![Again](Alpha - images/Beta.png)')
  const prepared = await uploadRenderedImages(cfg, 'Alpha', page, rendered)
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  expect(vi.mocked(fetch).mock.calls[1]![1]!.body).toBeInstanceOf(FormData)
  expect((vi.mocked(fetch).mock.calls[1]![1]!.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  await expect(fs.readdir(path.join(root, 'state', 'image-uploads'))).rejects.toThrow()
  await prepared.persist()
  const files = await fs.readdir(path.join(root, 'state', 'image-uploads'))
  expect((await fs.stat(path.join(root, 'state', 'image-uploads', files[0]!))).mode & 0o777).toBe(0o600)
  await uploadRenderedImages(cfg, 'Alpha', page, rendered)
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  await uploadRenderedImages(cfg, 'Alpha', page, rendered, true)
  expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4)
})
it('rejects malformed cache and invalid upload IDs before mutation', async () => {
  api()
  const rendered = await render()
  await (await uploadRenderedImages(cfg, 'Alpha', page, rendered)).persist()
  const dir = path.join(root, 'state', 'image-uploads')
  const file = path.join(dir, (await fs.readdir(dir))[0]!)
  for (const content of [
    'not json',
    'null',
    '[]',
    '42',
    '{"bad":"id"}',
    JSON.stringify({ [rendered.assets[0]!.hash]: 42 }),
    JSON.stringify({ [rendered.assets[0]!.hash]: 'bad' })
  ]) {
    await fs.writeFile(file, content)
    await expect(uploadRenderedImages(cfg, 'Alpha', page, rendered)).rejects.toThrow()
  }
})
it('cleans failed cache writes and propagates filesystem errors', async () => {
  api()
  const prepared = await uploadRenderedImages(cfg, 'Alpha', page, await render())
  vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('synthetic rename'))
  await expect(prepared.persist()).rejects.toThrow('synthetic rename')
  expect(await fs.readdir(path.join(root, 'state', 'image-uploads'))).toEqual([])
  const rendered = await render()
  vi.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('synthetic read'))
  await expect(uploadRenderedImages(cfg, 'Alpha', page, rendered)).rejects.toThrow('synthetic read')
})
it('rejects non-uploaded send responses', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async (_url, opts) =>
        new Response(JSON.stringify(opts.body instanceof FormData ? { status: 'pending' } : { id: upload }))
    )
  )
  await expect(uploadImage(cfg, 'Beta.png', 'image/png', Buffer.from('a'))).rejects.toThrow('uploaded status')
})

it('preserves mentions beside image references', async () => {
  const rendered = await renderImages(cfg, path.join(root, 'Alpha.md'), '[[Gamma]] ![Beta](Alpha - images/Beta.png)', {
    Gamma: `https://www.notion.so/${page}`
  })
  expect(JSON.stringify(rendered.blocks)).toContain('mention')
  expect(JSON.stringify(rendered.blocks)).toContain('image')
})

it('anchors an absolute note without a configured KB root to its parent', async () => {
  cfg.kbRoot = undefined
  expect((await render()).assets).toHaveLength(1)
})
