/**
 * MCP tool annotations shared across tool groups.
 *
 * Naming convention: unsuffixed presets are closed-world (the tool acts only on
 * local state); `_REMOTE` suffix marks open-world (calls external APIs).
 *
 * Underlying MCP hints:
 *   readOnlyHint    — tool does NOT modify state
 *   destructiveHint — tool deletes/destroys state
 *   idempotentHint  — same input → same end state
 *   openWorldHint   — interacts with services outside the local environment
 *
 * This MCP's surface (every tool calls the Notion API → all open-world):
 *   - notion_mirror_get fetches a page → READ_ONLY_REMOTE.
 *   - notion_mirror_publish creates a new Notion page each call (non-idempotent)
 *     and writes back to the KB note → WRITE_REMOTE.
 *   - notion_mirror_move re-parents an existing page (non-idempotent end state
 *     depends on current parent) → WRITE_REMOTE.
 *   - notion_mirror_unpublish archives a Notion page (idempotent end state) and
 *     clears two frontmatter fields → DESTRUCTIVE_REMOTE.
 *
 * The access-level gate keys off readOnlyHint/destructiveHint only:
 *   readOnlyHint:true → read · destructiveHint:true → destructive ·
 *   both false → write.
 */
export const READ_ONLY_REMOTE = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const

export const WRITE_REMOTE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const

export const DESTRUCTIVE_REMOTE = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true } as const
