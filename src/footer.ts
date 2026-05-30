/**
 * Child-pages footer maintenance.
 *
 * Every page-parented mirror page gets a "📂 Child Pages" footer listing its
 * immediate child pages as Notion @mentions. The footer is MIRROR-ONLY — never
 * written into the KB source — and is the mechanism that surfaces child pages
 * inside a parent's body (the wiki sidebar shows the tree; the page body does
 * not unless we add this).
 *
 * It is identifiable by a sentinel `heading_2` whose text is exactly
 * `📂 Child Pages`. A future "read mirror back into the KB" path MUST recognise
 * this sentinel and strip the footer before importing.
 *
 * `buildFooterBlocks` is pure (children → blocks). `refreshFooter` is the
 * side-effecting regenerate: fetch children, drop the old footer, append a
 * fresh one from the current Notion-side child list. Refreshes are serialised
 * per parent id (in-memory lock) so concurrent sibling publishes don't race.
 */
import { appendBlockChildren, deleteBlock, getBlockChildren, type NotionBlock } from './notion-client.js'

/** The sentinel heading text that marks the start of the footer. */
export const SENTINEL_TEXT = '📂 Child Pages'

export interface ChildSummary {
  id: string
  title: string
}

/**
 * The footer block array: a sentinel `heading_2` followed by one
 * `bulleted_list_item` page-mention per child. Empty when there are no
 * children — the caller then appends nothing (no orphan heading).
 */
export const buildFooterBlocks = (children: ChildSummary[]): Record<string, unknown>[] => {
  if (children.length === 0) return []
  return [
    { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ type: 'text', text: { content: SENTINEL_TEXT } }] } },
    ...children.map((c) => ({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: [{ type: 'mention', mention: { type: 'page', page: { id: c.id } } }] }
    }))
  ]
}

const blockText = (block: NotionBlock): string => {
  const rt = (block[block.type] as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text
  return Array.isArray(rt) ? rt.map((t) => t.plain_text ?? '').join('') : ''
}

const isSentinel = (block: NotionBlock): boolean => block.type === 'heading_2' && blockText(block) === SENTINEL_TEXT

const doRefresh = async (parentPageId: string): Promise<void> => {
  const blocks = await getBlockChildren(parentPageId)
  const children: ChildSummary[] = blocks.filter((b) => b.type === 'child_page').map((b) => ({ id: b.id, title: b.child_page?.title ?? '' }))

  // Drop the existing footer: the sentinel and every following block that is
  // NOT a child page. (Notion appends new child_page blocks after the footer,
  // so a blind "delete from sentinel onwards" would archive real sub-pages.)
  const sentinelIdx = blocks.findIndex(isSentinel)
  if (sentinelIdx !== -1) {
    for (const block of blocks.slice(sentinelIdx)) {
      if (block.type !== 'child_page') await deleteBlock(block.id)
    }
  }

  const footer = buildFooterBlocks(children)
  if (footer.length > 0) await appendBlockChildren(parentPageId, footer)
}

const footerLocks = new Map<string, Promise<unknown>>()

/**
 * Regenerate a parent page's child-pages footer from its current Notion-side
 * children. Idempotent and serialised per parent id so concurrent calls for the
 * same parent run one-at-a-time. The returned promise rejects if THIS refresh
 * fails; the per-parent chain continues regardless.
 */
export const refreshFooter = (parentPageId: string): Promise<void> => {
  // The stored promise is always already-caught, so `prev` never rejects.
  const prev = footerLocks.get(parentPageId) ?? Promise.resolve()
  const next = prev.then(() => doRefresh(parentPageId))
  footerLocks.set(
    parentPageId,
    next.catch(() => {})
  )
  return next
}
