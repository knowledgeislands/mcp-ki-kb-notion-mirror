/** Read-only comparison of the exact locally rendered body with live Notion blocks. */
import type { Config } from '../../config/index.js'
import {
  extractPageIdFromUrl,
  getBlockChildren,
  getPage,
  type NotionBlock,
  type NotionIcon,
  type NotionParent,
  normalizeId
} from '../notion-client/index.js'
import { bannerBlock } from './banner.js'
import { SENTINEL_TEXT } from './footer.js'
import { titleFromPath } from './markdown.js'
import { readFullNote } from './read.js'
import { renderNoteBody } from './render.js'

const MAX_BLOCKS = 1000
const MAX_FETCHED_BLOCKS = 10000
const MAX_DEPTH = 32
const DEFAULT_ANNOTATIONS = new Set(['bold', 'italic', 'strikethrough', 'underline', 'code'])
const TYPES = new Set([
  'paragraph',
  'heading_1',
  'heading_2',
  'heading_3',
  'bulleted_list_item',
  'numbered_list_item',
  'to_do',
  'toggle',
  'quote',
  'callout',
  'code',
  'divider',
  'table',
  'table_row',
  'image',
  'bookmark',
  'embed',
  'equation',
  'link_preview',
  'video',
  'audio',
  'file',
  'pdf'
])
type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
export type CanonicalBlock = { type: string; payload: Json }
export type BodyChange = {
  kind: 'insert' | 'delete'
  old_position: number | null
  new_position: number | null
  block: CanonicalBlock
}
export type MetadataChange = { field: 'title' | 'parent' | 'icon'; current: Json; proposed: Json }
export type DiffResult =
  | { status: 'not-mirrored'; reason: 'not-mirrored' }
  | {
      status: 'compared'
      page_id: string
      url: string
      identical: boolean
      body_changes: BodyChange[]
      metadata_changes: MetadataChange[]
      excluded_generated: { banner: boolean; footer: boolean; child_pages: number }
    }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Keep all unknown nested values; only known Notion response decoration is removed. */
const canonicalValue = (value: unknown, key = ''): Json => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number')
    return value
  if (Array.isArray(value)) return value.map((item) => canonicalValue(item))
  if (!isRecord(value)) throw new Error(`Unsupported ${key} value in Notion comparison.`)
  if (key === 'rich_text_item') {
    const type = value.type
    if (type !== 'text' && type !== 'mention' && type !== 'equation')
      throw new Error('Unsupported rich-text representation in Notion comparison.')
    if (Object.keys(value).some((name) => !['type', type, 'annotations', 'plain_text', 'href'].includes(name)))
      throw new Error('Unsupported rich-text field in Notion comparison.')
    if (type === 'text' && (!isRecord(value.text) || typeof value.text.content !== 'string'))
      throw new Error('Unsupported text rich content in Notion comparison.')
    if (
      type === 'text' &&
      Object.keys(value.text as Record<string, unknown>).some((name) => name !== 'content' && name !== 'link')
    )
      throw new Error('Unsupported text rich field in Notion comparison.')
    const annotations = isRecord(value.annotations)
      ? Object.fromEntries(
          Object.entries(value.annotations).filter(
            ([name, val]) =>
              !(DEFAULT_ANNOTATIONS.has(name) && val === false) && !(name === 'color' && val === 'default')
          )
        )
      : {}
    const body =
      type === 'text'
        ? {
            text: {
              content: (value.text as Record<string, unknown>).content,
              ...((value.text as Record<string, unknown>).link
                ? { link: (value.text as Record<string, unknown>).link }
                : {})
            }
          }
        : { [type]: value[type] }
    if (value[type] === undefined) throw new Error(`Unsupported ${type} rich text in Notion comparison.`)
    return canonicalValue({ type, ...body, ...(Object.keys(annotations).length ? { annotations } : {}) })
  }
  const out: Record<string, Json> = {}
  for (const name of Object.keys(value).sort()) {
    const child = value[name]
    if (child === undefined) continue
    if (name === 'color' && child === 'default') continue
    if ((name === 'caption' || name === 'children') && Array.isArray(child) && child.length === 0) continue
    if (name === 'is_toggleable' && child === false) continue
    if (name === 'rich_text') {
      if (!Array.isArray(child)) throw new Error('Unsupported rich-text array in Notion comparison.')
      out[name] = child.map((item) => {
        if (!isRecord(item)) throw new Error('Unsupported rich-text representation in Notion comparison.')
        return canonicalValue(item, 'rich_text_item')
      })
    } else if (name === 'cells') {
      if (!Array.isArray(child)) throw new Error('Unsupported table cells in Notion comparison.')
      out[name] = child.map((cell) => {
        if (!Array.isArray(cell)) throw new Error('Unsupported table cell in Notion comparison.')
        return cell.map((item) => {
          if (!isRecord(item)) throw new Error('Unsupported rich-text representation in Notion comparison.')
          return canonicalValue(item, 'rich_text_item')
        })
      })
    } else if (name === 'children') {
      if (!Array.isArray(child)) throw new Error('Unsupported nested children in Notion comparison.')
      out[name] = child.map(canonicalBlock) as unknown as Json
    } else out[name] = canonicalValue(child, name)
  }
  return out
}

export const canonicalBlock = (raw: unknown): CanonicalBlock => {
  if (!isRecord(raw) || typeof raw.type !== 'string' || !TYPES.has(raw.type) || !isRecord(raw[raw.type]))
    throw new Error('Unsupported block representation in Notion comparison.')
  return { type: raw.type, payload: canonicalValue(raw[raw.type]) }
}

/** LCS keeps early insertions and moves from creating a positional change cascade. */
export const bodyChanges = (current: CanonicalBlock[], proposed: CanonicalBlock[]): BodyChange[] => {
  const oldKeys = current.map((block) => JSON.stringify(block))
  const newKeys = proposed.map((block) => JSON.stringify(block))
  const lengths = new Uint16Array((current.length + 1) * (proposed.length + 1))
  const width = proposed.length + 1
  for (let i = current.length - 1; i >= 0; i--)
    for (let j = proposed.length - 1; j >= 0; j--)
      lengths[i * width + j] =
        oldKeys[i] === newKeys[j]
          ? 1 + lengths[(i + 1) * width + j + 1]!
          : Math.max(lengths[(i + 1) * width + j]!, lengths[i * width + j + 1]!)
  const changes: BodyChange[] = []
  let i = 0
  let j = 0
  while (i < current.length || j < proposed.length) {
    if (i < current.length && j < proposed.length && oldKeys[i] === newKeys[j]) {
      i++
      j++
      continue
    }
    if (j < proposed.length && (i === current.length || lengths[i * width + j + 1]! >= lengths[(i + 1) * width + j]!)) {
      changes.push({ kind: 'insert', old_position: null, new_position: j, block: proposed[j] as CanonicalBlock })
      j++
    } else {
      changes.push({ kind: 'delete', old_position: i, new_position: null, block: current[i] as CanonicalBlock })
      i++
    }
  }
  return changes
}

const richText = (block: NotionBlock): string => {
  const payload = block[block.type]
  if (!isRecord(payload) || !Array.isArray(payload.rich_text)) return ''
  return payload.rich_text
    .map((item: unknown) => {
      if (!isRecord(item)) return ''
      return typeof item.plain_text === 'string'
        ? item.plain_text
        : isRecord(item.text)
          ? String(item.text.content ?? '')
          : ''
    })
    .join('')
}

const knownBanner = (cfg: Config, block: NotionBlock): boolean => {
  if (block.type !== 'callout' || cfg.bannerTemplate === '') return false
  const date = richText(block).match(/\d{4}-\d{2}-\d{2}/)?.[0] ?? '2000-01-01'
  const expected = bannerBlock(cfg.bannerTemplate, date)!
  try {
    return JSON.stringify(canonicalBlock(block)) === JSON.stringify(canonicalBlock(expected))
  } catch {
    return false
  }
}

const stripGenerated = (cfg: Config, blocks: NotionBlock[]) => {
  const banner = blocks.length > 0 && knownBanner(cfg, blocks[0] as NotionBlock)
  const active = banner ? blocks.slice(1) : blocks
  const firstChild = active.findIndex((block) => block.type === 'child_page')
  const footer =
    firstChild > 0 &&
    active[firstChild - 1]?.type === 'heading_2' &&
    richText(active[firstChild - 1] as NotionBlock) === SENTINEL_TEXT &&
    active.slice(firstChild).every((block) => block.type === 'child_page')
  const childPages = active.filter((block) => block.type === 'child_page').length
  return {
    body: active.filter((block, index) => block.type !== 'child_page' && !(footer && index === firstChild - 1)),
    excluded: { banner, footer, child_pages: childPages }
  }
}

const remoteTree = async (cfg: Config, pageId: string) => {
  let fetched = 0
  let authored = 0
  const visit = async (id: string, depth: number): Promise<NotionBlock[]> => {
    if (depth > MAX_DEPTH) throw new Error(`Notion block comparison exceeds depth ${MAX_DEPTH}.`)
    const blocks = await getBlockChildren(cfg, id, MAX_FETCHED_BLOCKS - fetched)
    fetched += blocks.length
    const result: NotionBlock[] = []
    for (const block of blocks) {
      if (block.archived || block.in_trash) continue
      if (block.type !== 'child_page' && ++authored > MAX_BLOCKS + 2)
        throw new Error(`Notion block comparison exceeds the ${MAX_BLOCKS}-authored-block budget.`)
      if (block.type === 'child_page' || block.has_children !== true) {
        result.push(block)
        continue
      }
      const payload = block[block.type]
      if (!isRecord(payload)) throw new Error('Unsupported nested block in Notion comparison.')
      const children = await visit(block.id, depth + 1)
      result.push({ ...block, [block.type]: { ...payload, children } })
    }
    return result
  }
  return visit(pageId, 0)
}

export const countLocalBlocks = (blocks: unknown[], depth = 0, source = 'Local'): number => {
  if (depth > MAX_DEPTH) throw new Error(`${source} block comparison exceeds depth ${MAX_DEPTH}.`)
  let count = 0
  for (const block of blocks) {
    const canonical = canonicalBlock(block)
    count++
    const raw = block as Record<string, unknown>
    const payload = raw[canonical.type] as Record<string, unknown>
    if (Array.isArray(payload.children)) count += countLocalBlocks(payload.children, depth + 1, source)
    if (count > MAX_BLOCKS) throw new Error(`${source} block comparison exceeds ${MAX_BLOCKS} blocks.`)
  }
  return count
}

const normalizedParent = (parent: Record<string, unknown>): Record<string, unknown> => {
  const idKey = parent.type === 'page_id' ? 'page_id' : parent.type === 'database_id' ? 'database_id' : null
  return idKey && typeof parent[idKey] === 'string' ? { ...parent, [idKey]: normalizeId(parent[idKey]) } : parent
}

export const diffNote = async (
  cfg: Config,
  kbPath: string,
  parent: NotionParent,
  options: { icon?: NotionIcon; linkMap?: Record<string, string> } = {}
): Promise<DiffResult> => {
  const { abs, fields, hasFrontmatter, body } = await readFullNote(cfg, kbPath)
  if (!hasFrontmatter) throw new Error('Note has no YAML frontmatter; refusing to compare.')
  const url = fields.kb_notion_mirror_url
  if (!url) return { status: 'not-mirrored', reason: 'not-mirrored' }
  const pageId = extractPageIdFromUrl(url)
  if (!pageId) throw new Error(`Could not extract a 32-hex page id from kb_notion_mirror_url: ${url}`)
  const local = renderNoteBody(body, options.linkMap)
  countLocalBlocks(local)
  const page = await getPage(cfg, pageId)
  const remote = stripGenerated(cfg, await remoteTree(cfg, pageId))
  countLocalBlocks(remote.body, 0, 'Notion')
  const body_changes = bodyChanges(remote.body.map(canonicalBlock), local.map(canonicalBlock))
  const metadata_changes: MetadataChange[] = []
  const metadata: Array<{ field: MetadataChange['field']; current: unknown; proposed: unknown }> = [
    { field: 'title', current: page.title, proposed: titleFromPath(abs) },
    { field: 'parent', current: normalizedParent(page.parent), proposed: normalizedParent(parent) },
    ...(options.icon ? [{ field: 'icon' as const, current: page.icon ?? null, proposed: options.icon }] : [])
  ]
  for (const change of metadata) {
    const current = canonicalValue(change.current)
    const proposed = canonicalValue(change.proposed)
    if (JSON.stringify(current) !== JSON.stringify(proposed))
      metadata_changes.push({ field: change.field, current, proposed })
  }
  return {
    status: 'compared',
    page_id: pageId,
    url,
    identical: body_changes.length === 0 && metadata_changes.length === 0,
    body_changes,
    metadata_changes,
    excluded_generated: remote.excluded
  }
}
