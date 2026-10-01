import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Config, DEFAULT_BANNER_TEMPLATE } from '../../config/index.js'
import { getBlockChildren } from '../notion-client/index.js'
import { bannerBlock } from './banner.js'
import { bodyChanges, canonicalBlock, countLocalBlocks, diffNote } from './diff.js'
import { renderNoteBody } from './render.js'

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>()
  return { ...actual, writeFile: vi.fn(actual.writeFile), rename: vi.fn(actual.rename) }
})

const ID = '3709f7187cc2814e8652f99fd36857ff'
const PARENT_ID = '36f9f7187cc280f69272e60aa89bff24'
const URL = `https://www.notion.so/My-Note-${ID}`
const PARENT = { type: 'page_id' as const, page_id: PARENT_ID }
const page = (overrides: Record<string, unknown> = {}) => ({
  id: ID,
  url: URL,
  created_time: '2026-05-30T00:00:00.000Z',
  last_edited_time: '2026-05-30T00:00:00.000Z',
  archived: false,
  parent: PARENT,
  properties: { title: { type: 'title', title: [{ plain_text: 'My Note' }] } },
  ...overrides
})
const para = (text: string, extras: Record<string, unknown> = {}) => ({
  object: 'block',
  id: Math.random().toString(16).slice(2),
  type: 'paragraph',
  paragraph: { rich_text: [{ type: 'text', text: { content: text }, plain_text: text }], ...extras }
})
const ok = (value: unknown) => new Response(JSON.stringify(value), { status: 200 })
const children = (results: unknown[], hasMore = false, nextCursor: string | null = null) =>
  ok({ results, has_more: hasMore, next_cursor: nextCursor })

describe('canonical block comparison', () => {
  it('ignores only known server decorations and default presentation', () => {
    const local = { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 'A' } }] } }
    const remote = {
      ...para('A', { color: 'default', caption: [], children: [], is_toggleable: false }),
      created_time: 'now',
      has_children: false
    }
    expect(canonicalBlock(remote)).toEqual(canonicalBlock(local))
  })

  it('retains nested mention target identity and non-default annotations', () => {
    const withMention = (id: string, bold: boolean) =>
      canonicalBlock({
        type: 'paragraph',
        paragraph: {
          rich_text: [
            {
              type: 'mention',
              mention: { type: 'page', page: { id } },
              annotations: { bold, italic: false, color: 'default' },
              plain_text: 'dynamic title'
            }
          ]
        }
      })
    expect(withMention('a', false)).not.toEqual(withMention('b', false))
    expect(withMention('a', false)).not.toEqual(withMention('a', true))
  })

  it('reports an early insertion without a cascade and treats edits and moves as insert/delete', () => {
    const blocks = ['A', 'B', 'C'].map((text) => canonicalBlock(para(text)))
    expect(bodyChanges(blocks, [canonicalBlock(para('X')), ...blocks])).toMatchObject([
      { kind: 'insert', old_position: null, new_position: 0 }
    ])
    expect(bodyChanges(blocks, blocks.slice(1))).toMatchObject([{ kind: 'delete', old_position: 0 }])
    expect(
      bodyChanges(blocks, [blocks[0]!, canonicalBlock(para('edited')), blocks[2]!])
        .map((c) => c.kind)
        .sort()
    ).toEqual(['delete', 'insert'])
    expect(bodyChanges(blocks, [blocks[1]!, blocks[0]!, blocks[2]!])).toHaveLength(2)
  })

  it('compares nested content within its parent and fails on unknown representations', () => {
    const nested = (text: string) =>
      canonicalBlock({ type: 'bulleted_list_item', bulleted_list_item: { rich_text: [], children: [para(text)] } })
    expect(nested('A')).not.toEqual(nested('B'))
    expect(() => canonicalBlock({ type: 'alien', alien: {} })).toThrow('Unsupported block')
    expect(() => canonicalBlock({ type: 'paragraph' })).toThrow('Unsupported block')
    expect(() => canonicalBlock({ type: 'paragraph', paragraph: { rich_text: [{ type: 'mention' }] } })).toThrow(
      'Unsupported mention rich text'
    )
  })

  it('normalizes table cells, links, and typed scalar payloads while rejecting invalid cells', () => {
    const table = canonicalBlock({
      type: 'table_row',
      table_row: {
        cells: [
          [{ type: 'text', text: { content: 'A', link: { url: 'https://example.test' } }, annotations: { bold: true } }]
        ],
        width: 1,
        checked: true,
        optional: null,
        absent: undefined
      }
    })
    expect(table.payload).toMatchObject({
      cells: [[{ text: { link: { url: 'https://example.test' } } }]],
      width: 1,
      checked: true
    })
    expect(() => canonicalBlock({ type: 'table_row', table_row: { cells: [null] } })).toThrow('Unsupported table cell')
    expect(() => canonicalBlock({ type: 'table_row', table_row: { cells: [[null]] } })).toThrow('Unsupported rich-text')
    expect(() => canonicalBlock({ type: 'paragraph', paragraph: { unsupported: Symbol('x') } })).toThrow(
      'Unsupported unsupported value'
    )
    expect(() => canonicalBlock({ type: 'paragraph', paragraph: { rich_text: [{}] } })).toThrow('Unsupported rich-text')
    expect(() =>
      canonicalBlock({ type: 'paragraph', paragraph: { rich_text: [{ type: 'alien', alien: {} }] } })
    ).toThrow('Unsupported rich-text')
    expect(() =>
      canonicalBlock({
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: 'A' }, extra: 'unknown' }] }
      })
    ).toThrow('Unsupported rich-text field')
    expect(() =>
      canonicalBlock({
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: 'A', extra: true } }] }
      })
    ).toThrow('Unsupported text rich field')
    expect(() => canonicalBlock({ type: 'paragraph', paragraph: { rich_text: null } })).toThrow(
      'Unsupported rich-text array'
    )
    expect(() => canonicalBlock({ type: 'table_row', table_row: { cells: null } })).toThrow('Unsupported table cells')
    expect(() => canonicalBlock({ type: 'toggle', toggle: { children: null } })).toThrow('Unsupported nested children')
    expect(() =>
      canonicalBlock({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: null }] } })
    ).toThrow('Unsupported text rich content')
    expect(() =>
      canonicalBlock({ type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: 42 } }] } })
    ).toThrow('Unsupported text rich content')
    expect(canonicalBlock({ type: 'paragraph', paragraph: { arbitrary: [1, 2] } }).payload).toMatchObject({
      arbitrary: [1, 2]
    })
    expect(
      canonicalBlock({
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'A' }, annotations: { bold: false, unknown: false } }]
        }
      }).payload
    ).toMatchObject({ rich_text: [{ annotations: { unknown: false } }] })
  })

  it('handles fully inserted or removed sequences', () => {
    const block = canonicalBlock(para('one'))
    expect(bodyChanges([], [block])).toMatchObject([{ kind: 'insert', new_position: 0 }])
    expect(bodyChanges([block], [])).toMatchObject([{ kind: 'delete', old_position: 0 }])
  })

  it('bounds nested local representation depth', () => {
    let block: unknown = para('leaf')
    for (let i = 0; i < 33; i++) block = { type: 'toggle', toggle: { rich_text: [], children: [block] } }
    expect(() => countLocalBlocks([block])).toThrow('Local block comparison exceeds depth 32')
  })
})

describe('note diff', () => {
  let root: string
  let cfg: Config
  let note: string
  let requests: Array<{ url: string; method: string }>
  let route: (url: string) => Response

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-notion-diff-'))
    note = path.join(root, 'My Note.md')
    cfg = {
      notionToken: 'fixture',
      notionApiBaseUrl: 'https://api.notion.test',
      notionApiVersion: '2022-06-28',
      kbRoot: root,
      bannerTemplate: DEFAULT_BANNER_TEMPLATE,
      accessLevel: 'read',
      mirror: { skipPrefixes: [], skipKbPaths: new Set(), iconBaseUrl: '' },
      auditLogMode: 'off',
      auditLogPath: '',
      auditLogMaxBytes: 0,
      auditLogKeep: 0
    }
    requests = []
    route = (url) => (url.includes('/v1/pages/') ? ok(page()) : children([para('Body paragraph.')]))
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET'
        requests.push({ url, method })
        if (method !== 'GET') throw new Error('diff attempted mutation')
        return Promise.resolve(route(url))
      })
    )
    await fs.writeFile(note, `---\nkb_notion_mirror_url: ${URL}\n---\n# My Note\n\nBody paragraph.\n`)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    await fs.rm(root, { recursive: true, force: true })
  })

  it('compares identical content with GET only and preserves exact note bytes', async () => {
    const before = await fs.readFile(note)
    vi.mocked(fs.writeFile).mockClear()
    vi.mocked(fs.rename).mockClear()
    const result = await diffNote(cfg, note, PARENT)
    expect(result).toMatchObject({ status: 'compared', identical: true, body_changes: [], metadata_changes: [] })
    expect(requests.map((r) => r.method)).toEqual(['GET', 'GET'])
    expect(fs.writeFile).not.toHaveBeenCalled()
    expect(fs.rename).not.toHaveBeenCalled()
    expect(await fs.readFile(note)).toEqual(before)
  })

  it('returns not-mirrored before any HTTP request', async () => {
    await fs.writeFile(note, '---\nstatus: current\n---\n# My Note\n\nBody paragraph.\n')
    expect(await diffNote(cfg, note, PARENT)).toEqual({ status: 'not-mirrored', reason: 'not-mirrored' })
    expect(requests).toEqual([])
  })

  it('reports inserted, removed, edited, and nested content', async () => {
    await fs.writeFile(note, `---\nkb_notion_mirror_url: ${URL}\n---\n# My Note\n\nNew.\n\nBody paragraph.\n`)
    const inserted = await diffNote(cfg, note, PARENT)
    expect(inserted.status === 'compared' && inserted.body_changes).toMatchObject([{ kind: 'insert', new_position: 0 }])
    route = (url) => (url.includes('/v1/pages/') ? ok(page()) : children([para('Old.'), para('Body paragraph.')]))
    const removed = await diffNote(cfg, note, PARENT)
    expect(removed.status === 'compared' && removed.body_changes.map((c) => c.kind).sort()).toEqual([
      'delete',
      'insert'
    ])
    await fs.writeFile(note, `---\nkb_notion_mirror_url: ${URL}\n---\n# My Note\n\n- parent\n  - nested\n`)
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : url.includes('a'.repeat(32))
          ? children([para('different nested text')])
          : children([
              {
                id: 'a'.repeat(32),
                type: 'bulleted_list_item',
                has_children: true,
                bulleted_list_item: { rich_text: [{ type: 'text', text: { content: 'parent' } }] }
              }
            ])
    const nested = await diffNote(cfg, note, PARENT)
    expect(nested.status === 'compared' && nested.body_changes.length).toBeGreaterThan(0)
  })

  it('follows pagination and nested children and reports page metadata separately', async () => {
    const nestedId = 'a'.repeat(32)
    route = (url) => {
      if (url.includes('/v1/pages/'))
        return ok(
          page({
            parent: { type: 'page_id', page_id: 'b'.repeat(32) },
            icon: { type: 'emoji', emoji: '🧱' },
            properties: { title: { type: 'title', title: [{ plain_text: 'Old title' }] } }
          })
        )
      if (url.includes(nestedId)) return children([para('nested')])
      if (url.includes('start_cursor=')) return children([para('Body paragraph.')])
      return children([{ id: nestedId, type: 'toggle', has_children: true, toggle: { rich_text: [] } }], true, 'next')
    }
    const result = await diffNote(cfg, note, PARENT, { icon: { type: 'emoji', emoji: '📘' } })
    expect(result.status === 'compared' && result.metadata_changes.map((c) => c.field).sort()).toEqual([
      'icon',
      'parent',
      'title'
    ])
    expect(requests.some((r) => r.url.includes('start_cursor=next'))).toBe(true)
    expect(requests.some((r) => r.url.includes(nestedId))).toBe(true)
  })

  it('excludes only a matching leading banner and the managed footer with child pages', async () => {
    const banner = { ...bannerBlock(cfg.bannerTemplate, '2026-05-30'), id: 'b'.repeat(32) }
    const footer = {
      id: 'c'.repeat(32),
      type: 'heading_2',
      heading_2: { rich_text: [{ type: 'text', text: { content: 'Child Pages' } }] }
    }
    const child = { id: 'd'.repeat(32), type: 'child_page', child_page: { title: 'Child' } }
    route = (url) =>
      url.includes('/v1/pages/') ? ok(page()) : children([banner, para('Body paragraph.'), footer, child])
    const result = await diffNote(cfg, note, PARENT)
    expect(result).toMatchObject({
      status: 'compared',
      identical: true,
      excluded_generated: { banner: true, footer: true, child_pages: 1 }
    })
    route = (url) => (url.includes('/v1/pages/') ? ok(page()) : children([para('Body paragraph.'), banner]))
    const arbitrary = await diffNote(cfg, note, PARENT)
    expect(arbitrary.status === 'compared' && arbitrary.body_changes).toHaveLength(1)
  })

  it('errors on unsupported and over-budget remote content without writing', async () => {
    const before = await fs.readFile(note)
    route = (url) =>
      url.includes('/v1/pages/') ? ok(page()) : children([{ id: 'a'.repeat(32), type: 'alien', alien: {} }])
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Unsupported block')
    route = (url) =>
      url.includes('/v1/pages/') ? ok(page()) : children(Array.from({ length: 1001 }, (_, i) => para(String(i))))
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Notion block comparison exceeds 1000')
    route = (url) =>
      url.includes('/v1/pages/') ? ok(page()) : children(Array.from({ length: 1003 }, (_, i) => para(String(i))))
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('1000-authored-block budget')
    expect(await fs.readFile(note)).toEqual(before)
  })

  it('refuses truncated pagination and the caller-specified block-read budget', async () => {
    route = () => children([], true, null)
    await expect(getBlockChildren(cfg, ID)).rejects.toThrow('has_more without a cursor')
    route = () => children([para('A'), para('B')])
    await expect(getBlockChildren(cfg, ID, 1)).rejects.toThrow('1-block budget')
  })

  it('normalizes UUID spelling for page and database parent comparisons', async () => {
    const dashed = (id: string) =>
      `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page({ parent: { type: 'page_id', page_id: dashed(PARENT_ID) } }))
        : children([para('Body paragraph.')])
    const same = await diffNote(cfg, note, PARENT)
    expect(same.status === 'compared' && same.metadata_changes).toEqual([])
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page({ parent: { type: 'database_id', database_id: dashed(PARENT_ID) } }))
        : children([para('Body paragraph.')])
    const database = await diffNote(cfg, note, { type: 'database_id', database_id: PARENT_ID })
    expect(database.status === 'compared' && database.metadata_changes).toEqual([])
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page({ parent: { type: 'workspace', workspace: true } }))
        : children([para('Body paragraph.')])
    const changed = await diffNote(cfg, note, PARENT)
    expect(changed.status === 'compared' && changed.metadata_changes.map((c) => c.field)).toEqual(['parent'])
  })

  it('errors on malformed mirror URLs before HTTP and unsupported local blocks before HTTP', async () => {
    await fs.writeFile(note, '---\nkb_notion_mirror_url: invalid\n---\n# My Note\n\nBody paragraph.\n')
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Could not extract')
    expect(requests).toEqual([])
    expect(renderNoteBody('Body paragraph.')).toHaveLength(1)
  })

  it('refuses notes without frontmatter and observes the local 1,000-block limit', async () => {
    await fs.writeFile(note, '# My Note\n\nBody paragraph.\n')
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('no YAML frontmatter')
    expect(requests).toEqual([])
    expect(() => countLocalBlocks(Array.from({ length: 1001 }, (_, i) => para(String(i))))).toThrow(
      'Local block comparison exceeds 1000'
    )
    expect(requests).toEqual([])
  })

  it('rejects over-depth remote trees and unsupported nested payloads', async () => {
    route = (url) => {
      if (url.includes('/v1/pages/')) return ok(page())
      const id = url.match(/\/v1\/blocks\/([a-f0-9]{32})\//)?.[1]
      const depth = id === ID ? 0 : Number.parseInt(id?.slice(0, 2) ?? '00', 16)
      return children([
        {
          id: `${(depth + 1).toString(16).padStart(2, '0')}${'a'.repeat(30)}`,
          type: 'toggle',
          has_children: true,
          toggle: { rich_text: [] }
        }
      ])
    }
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('depth 32')
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            {
              id: 'a'.repeat(32),
              type: 'toggle',
              has_children: true
            }
          ])
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Unsupported nested block')
  })

  it('skips archived blocks and preserves unsupported footer-like authored headings', async () => {
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            { ...para('archived'), archived: true },
            { ...para('trashed'), in_trash: true },
            para('Body paragraph.'),
            {
              id: 'a'.repeat(32),
              type: 'heading_2',
              heading_2: { rich_text: [{ type: 'text', text: { content: 'Child Pages' } }] }
            }
          ])
    const result = await diffNote(cfg, note, PARENT)
    expect(result.status === 'compared' && result.body_changes).toHaveLength(1)
    expect(result.status === 'compared' && result.excluded_generated.footer).toBe(false)
  })

  it('does not discard a similar authored callout or a footer heading away from the child-page boundary', async () => {
    const similar = {
      ...bannerBlock(cfg.bannerTemplate, '2026-05-30'),
      callout: {
        ...(bannerBlock(cfg.bannerTemplate, '2026-05-30')?.callout as object),
        icon: { type: 'emoji', emoji: '❌' }
      }
    }
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            similar,
            para('Body paragraph.'),
            {
              id: 'a'.repeat(32),
              type: 'heading_2',
              heading_2: { rich_text: [{ type: 'text', text: { content: 'Child Pages' } }] }
            },
            para('between'),
            { id: 'b'.repeat(32), type: 'child_page', child_page: { title: 'child' } }
          ])
    const result = await diffNote(cfg, note, PARENT)
    expect(result.status === 'compared' && result.excluded_generated).toEqual({
      banner: false,
      footer: false,
      child_pages: 1
    })
    expect(result.status === 'compared' && result.body_changes.length).toBe(3)
  })

  it('keeps malformed callouts as unsupported instead of assuming a managed banner', async () => {
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([{ id: 'a'.repeat(32), type: 'callout', callout: { rich_text: [null] } }, para('Body paragraph.')])
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Unsupported rich-text')
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([{ id: 'a'.repeat(32), type: 'callout', callout: {} }, para('Body paragraph.')])
    const absent = await diffNote(cfg, note, PARENT)
    expect(absent.status === 'compared' && absent.excluded_generated.banner).toBe(false)
  })

  it('recognizes an exact fixed banner and reports icon addition from a page without an icon', async () => {
    cfg.bannerTemplate = 'Fixed banner'
    const fixed = bannerBlock(cfg.bannerTemplate, '2026-05-30') as {
      callout: { rich_text: Array<{ text: { content: string } }> }
    }
    const richText = fixed.callout.rich_text.map((item) => ({ ...item, plain_text: item.text.content }))
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            { ...fixed, callout: { ...fixed.callout, rich_text: richText }, id: 'a'.repeat(32) },
            para('Body paragraph.')
          ])
    const result = await diffNote(cfg, note, PARENT, { icon: { type: 'emoji', emoji: '📘' } })
    expect(result.status === 'compared' && result.excluded_generated.banner).toBe(true)
    expect(result.status === 'compared' && result.metadata_changes).toMatchObject([
      { field: 'icon', current: null, proposed: { type: 'emoji', emoji: '📘' } }
    ])
  })

  it('does not treat a mention-only or incomplete-text callout as the banner', async () => {
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            {
              id: 'a'.repeat(32),
              type: 'callout',
              callout: { rich_text: [{ type: 'mention', mention: { type: 'page', page: { id: ID } } }] }
            },
            para('Body paragraph.')
          ])
    const mention = await diffNote(cfg, note, PARENT)
    expect(mention.status === 'compared' && mention.excluded_generated.banner).toBe(false)
    route = (url) =>
      url.includes('/v1/pages/')
        ? ok(page())
        : children([
            {
              id: 'a'.repeat(32),
              type: 'callout',
              callout: { rich_text: [{ type: 'text', text: { content: null } }] }
            },
            para('Body paragraph.')
          ])
    await expect(diffNote(cfg, note, PARENT)).rejects.toThrow('Unsupported text rich content')
  })
})
