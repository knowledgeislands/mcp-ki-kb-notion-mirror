/**
 * Markdown → Notion block conversion for the publish pipeline.
 *
 * The body conversion is delegated to `@tryfabric/martian`
 * (`markdownToBlocks`), which handles paragraphs, headings, lists (incl.
 * nested), code fences, blockquotes, dividers, GFM tables, inline formatting,
 * and links. KB-specific transforms wrap it: stripping the frontmatter and a
 * leading `# Title` H1 (Notion takes the title from a page property), and folding
 * the soft line breaks of the KB's hard-wrapped prose back into spaces (see
 * `collapseSoftBreaks`). The banner is prepended separately (see src/banner.ts)
 * by the publish pipeline.
 *
 * Known gaps (tracked in ROADMAP.md): local image references render as their
 * alt-text paragraph rather than uploaded images, and `[[wikilinks]]` pass
 * through as literal text.
 */
import * as path from 'node:path'
import { markdownToBlocks } from '@tryfabric/martian'

const FRONTMATTER_RE = /^---\n[\s\S]*?\n---\n/

/** Drop the leading `---\n…\n---\n` frontmatter block, if present. */
export const stripFrontmatter = (text: string): string => text.replace(FRONTMATTER_RE, '').replace(/^\n+/, '')

/** Drop the first H1 (`# Title`) line — Notion gets the title from a page property. */
export const stripLeadingH1 = (text: string): string => {
  const lines = text.split('\n')
  const idx = lines.findIndex((l) => l.trim() !== '')
  if (idx !== -1 && /^#\s+/.test(lines[idx] as string)) lines.splice(idx, 1)
  return lines.join('\n')
}

/** Page title = the note's basename minus the `.md` extension. */
export const titleFromPath = (kbPath: string): string => path.basename(kbPath).replace(/\.md$/i, '')

/**
 * Collapse soft line breaks in inline text. KB prose is hard-wrapped at ~120
 * chars; CommonMark treats a single newline inside a paragraph as a *soft* break
 * (a space), but martian carries it through as a literal `\n`, which Notion then
 * renders as a forced line break — so every wrapped paragraph arrives in Notion
 * broken mid-sentence. We fold `\n` (plus the whitespace either side, to absorb a
 * trailing space before the break) back into a single space.
 *
 * Done after martian rather than on the raw markdown so the block structure is
 * already parsed: the only stray `\n` left in a `text.content` is a soft break.
 * `code` blocks are the exception — their newlines are significant — so the walk
 * returns them untouched (they carry no nested blocks to miss). Equation blocks
 * keep their newlines in `expression`, not `text.content`, so they're unaffected.
 */
const SOFT_BREAK_RE = /[ \t]*\n[ \t]*/g
const collapseRichTextBreaks = (richText: unknown[]): unknown[] =>
  richText.map((item) => {
    const it = item as { text?: { content?: string } }
    const content = it.text?.content
    if (typeof content !== 'string' || !content.includes('\n')) return item
    return { ...it, text: { ...it.text, content: content.replace(SOFT_BREAK_RE, ' ') } }
  })

/** Walk martian's block tree folding soft breaks in every block but `code`. Pure — returns a new tree. */
export const collapseSoftBreaks = (node: unknown): unknown => {
  if (Array.isArray(node)) return node.map(collapseSoftBreaks)
  if (node && typeof node === 'object') {
    if ((node as { type?: string }).type === 'code') return node
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === 'rich_text' && Array.isArray(value)) out[key] = collapseRichTextBreaks(value)
      else if (key === 'cells' && Array.isArray(value)) out[key] = value.map((cell) => collapseRichTextBreaks(cell as unknown[]))
      else out[key] = collapseSoftBreaks(value)
    }
    return out
  }
  return node
}

/**
 * Convert a markdown body (frontmatter + leading H1 already stripped) to Notion
 * blocks. `martian` is run with `notionLimits.truncate` so per-block
 * rich-text/character limits never produce an API-rejecting payload, then soft
 * line breaks from the KB's hard-wrapped prose are folded back into spaces.
 */
export const bodyToBlocks = (markdownBody: string): unknown[] => collapseSoftBreaks(markdownToBlocks(markdownBody, { notionLimits: { truncate: true } })) as unknown[]
