/**
 * The four mirror operations — publish / unpublish / move / get — as pipeline
 * functions. The tool handlers (src/tools/mirror/index.ts) are thin wrappers
 * that validate args, call one of these, and map the result/throw to an MCP
 * envelope. Keeping the logic here (not in the excluded aggregator) makes every
 * branch unit-testable against a real temp file + a mocked Notion `fetch`.
 *
 * The MCP is file-aware but layout-agnostic: it reads the note's frontmatter +
 * body and writes back ONLY `notion_mirror_url` / `notion_mirror_published_at`.
 * It does not discover files, resolve parents, or know any folder convention —
 * the caller supplies `kb_path` and (for mutations) the Notion `parent`.
 */
import * as fs from 'node:fs/promises'
import { bannerBlock } from './banner.js'
import { parseFrontmatter, removeFrontmatterFields, upsertFrontmatterFields } from './frontmatter.js'
import { bodyToBlocks, stripFrontmatter, stripLeadingH1, titleFromPath } from './markdown.js'
import { archivePage, createPage, extractPageIdFromUrl, getPage, type NotionParent, normalizePublishedAt, setPageParent } from './notion-client.js'
import { getDatabaseTitleProperty } from './title-property.js'
import { atomicWriteFile } from './utils/atomic-write.js'
import { resolveKbNotePath } from './utils/paths.js'

export const MIRROR_FIELDS = ['notion_mirror_url', 'notion_mirror_published_at'] as const

export type PublishResult = { url: string; page_id: string; published_at: string } | { skipped: true; existing_url: string }

export type UnpublishResult =
  | { archived: true; page_id: string; url: string }
  | { dry_run: true; would_archive_url: string; would_archive_page_id: string; would_clear_fields: string[] }
  | { archived: false; reason: string }

export type MoveResult = { moved: true; page_id: string; previous_parent: Record<string, unknown>; new_parent: NotionParent }

export type GetResult =
  | { id: string; parent: Record<string, unknown>; title: string; created_time: string; last_edited_time: string; archived: boolean; url: string }
  | { exists: false; reason: string }

const readNote = async (kbPath: string): Promise<{ abs: string; raw: string; fields: Record<string, string>; hasFrontmatter: boolean }> => {
  const abs = resolveKbNotePath(kbPath)
  const raw = await fs.readFile(abs, 'utf-8')
  const { hasFrontmatter, fields } = parseFrontmatter(raw)
  return { abs, raw, fields, hasFrontmatter }
}

/** Publish a note under the caller-supplied `parent`, writing the URL back to frontmatter. */
export const publishNote = async (kbPath: string, parent: NotionParent, force: boolean): Promise<PublishResult> => {
  const { abs, raw, fields, hasFrontmatter } = await readNote(kbPath)
  if (!hasFrontmatter) throw new Error('Note has no YAML frontmatter; refusing to publish.')

  const existing = fields.notion_mirror_url
  if (existing && !force) return { skipped: true, existing_url: existing }

  if (existing && force) {
    const oldId = extractPageIdFromUrl(existing)
    // Archive the stale mirror first, but continue even if it's already gone.
    if (oldId) await archivePage(oldId).catch(() => undefined)
  }

  const title = titleFromPath(abs)
  const body = stripLeadingH1(stripFrontmatter(raw))
  const dateStr = new Date().toISOString().slice(0, 10)
  const banner = bannerBlock(dateStr)
  const children = banner ? [banner, ...bodyToBlocks(body)] : bodyToBlocks(body)
  if (children.length === 0) throw new Error('Nothing to publish: the note body is empty and the banner is disabled.')

  const titleProperty = parent.type === 'database_id' ? await getDatabaseTitleProperty(parent.database_id) : undefined
  const page = await createPage({ parent, title, children, titleProperty })
  const publishedAt = normalizePublishedAt(page.created_time)

  const updated = upsertFrontmatterFields(raw, { notion_mirror_url: page.url, notion_mirror_published_at: publishedAt })
  await atomicWriteFile(abs, updated)

  return { url: page.url, page_id: page.id, published_at: publishedAt }
}

/** Archive the note's mirror page and clear the two mirror fields. Dry-run by default. */
export const unpublishNote = async (kbPath: string, dryRun: boolean): Promise<UnpublishResult> => {
  const { abs, raw, fields } = await readNote(kbPath)
  const mirror = fields.notion_mirror_url
  if (!mirror) return { archived: false, reason: 'not-published' }
  const pageId = extractPageIdFromUrl(mirror)
  if (!pageId) throw new Error(`Could not extract a 32-hex page id from notion_mirror_url: ${mirror}`)

  if (dryRun) {
    return { dry_run: true, would_archive_url: mirror, would_archive_page_id: pageId, would_clear_fields: [...MIRROR_FIELDS] }
  }

  await archivePage(pageId)
  const cleared = removeFrontmatterFields(raw, [...MIRROR_FIELDS])
  await atomicWriteFile(abs, cleared)
  return { archived: true, page_id: pageId, url: mirror }
}

/** Re-parent the note's mirror page to `parent`. No frontmatter change — the URL is stable. */
export const moveNote = async (kbPath: string, parent: NotionParent): Promise<MoveResult> => {
  const { fields } = await readNote(kbPath)
  const mirror = fields.notion_mirror_url
  if (!mirror) throw new Error('Note is not published — cannot move.')
  const pageId = extractPageIdFromUrl(mirror)
  if (!pageId) throw new Error(`Could not extract a 32-hex page id from notion_mirror_url: ${mirror}`)

  const before = await getPage(pageId)
  await setPageParent(pageId, parent)

  // Notion silently ignores a parent change that crosses the page-id ↔
  // database-id boundary. Detect it: if the parent type changed but a re-fetch
  // shows the same parent, the move was a no-op.
  if (before.parent.type !== parent.type) {
    const after = await getPage(pageId)
    if (JSON.stringify(after.parent) === JSON.stringify(before.parent)) {
      throw new Error('Notion silently ignored the parent change — cannot move between page-id and database-id parents. Use unpublish + publish instead.')
    }
  }

  return { moved: true, page_id: pageId, previous_parent: before.parent, new_parent: parent }
}

/** Fetch the live Notion state of the note's mirror page. Pure read — no file mutation. */
export const getNote = async (kbPath: string): Promise<GetResult> => {
  const { fields } = await readNote(kbPath)
  const mirror = fields.notion_mirror_url
  if (!mirror) return { exists: false, reason: 'not-published' }
  const pageId = extractPageIdFromUrl(mirror)
  if (!pageId) throw new Error(`Could not extract a 32-hex page id from notion_mirror_url: ${mirror}`)

  const page = await getPage(pageId)
  return {
    id: page.id,
    parent: page.parent,
    title: page.title,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    archived: page.archived,
    url: page.url
  }
}
