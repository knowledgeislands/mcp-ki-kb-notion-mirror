---
id: MCP-NOTION-TOOL-002
area: TOOL
title: Add KB note diff
theme: tool-surface
horizon: next
status: draft
blocks: []
blocked_by: []
baseline_ref: null
---

## Goal

Achieve the stated outcome: Add kb_notion_mirror_note_diff.

## Context

Expose the block-level diff an update would produce without writing, so callers can review a mutation before it occurs.

## Boundary

Keep the work limited to the stated surface.

## Current state

There is no block-level preview verb. The `note` resource exposes seven verbs in [src/main/notes/index.ts](../../src/main/notes/index.ts), and the three read-only ones stop well short of what this item needs: `statusNote` reads local frontmatter only and returns whether the note is mirrored plus its URL; `preflightNote` makes no Notion call and its only current check is that the note has YAML frontmatter, returning `{ ok, issues }`; `getNote` fetches the live page's metadata — id, parent, title, timestamps, archived flag, URL — and never looks at its blocks.

The render path a diff must reproduce lives inline inside `updateNote`: it reads the full note, rewrites wikilinks against `options.linkMap`, calls `bodyToBlocks`, then `convertMentionPlaceholders`, and computes `computeBodyHash` over the resulting blocks plus title, icon, and parent. That sequence is not factored out, so any second caller would today have to duplicate it — and a duplicate that drifts would make the preview quietly wrong.

The live side is already fetchable: `getBlockChildren` in [src/main/notion-client/index.ts](../../src/main/notion-client/index.ts) returns a page's children, and `replaceBody` already uses it to find the first `child_page` anchor and to filter archived blocks. Nothing compares local blocks against fetched blocks anywhere in the codebase.

The wire surface is fixed at fourteen tools: `EXPECTED_TOOLS` in [scripts/smoke.ts](../../scripts/smoke.ts) enumerates them and `bun run ki:test:smoke` fails on any mismatch. The `note` tools are registered in [src/tools/note/index.ts](../../src/tools/note/index.ts) with annotation presets from `src/utils/annotations.ts`; a preview verb is a `READ_ONLY_REMOTE` tool, the preset the existing `get`, `status`, and `preflight` tools use.

## Steps

- [ ] Factor the shared render sequence out of `updateNote` into a named function in `src/main/notes/`, so update and diff provably render from one implementation rather than two.
- [ ] Settle the comparison granularity and result shape as an explicit decision before implementing — block identity does not survive a `replaceBody` push, so what "changed" means here needs defining rather than assuming.
- [ ] Add `diffNote` to `src/main/notes/index.ts`: render locally, fetch the live children via `getBlockChildren`, and return the structured comparison, with no write of any kind and no frontmatter mutation.
- [ ] Register `kb_notion_mirror_note_diff` in `src/tools/note/index.ts` with `READ_ONLY_REMOTE`, add the matching `note diff` CLI verb and usage line in `src/cli/cli.ts`, and raise `EXPECTED_TOOLS` to fifteen.
- [ ] Add co-located tests over a stateful `fetch` stub with the synthetic Greek fixtures, covering identical, added, removed, and modified bodies, plus the not-yet-mirrored case.
- [ ] Document the verb in the README's verb model and tools table.

## Files touched

- `src/main/notes/index.ts` and `index.test.ts` — the render/compare split and `diffNote`
- `src/tools/note/index.ts` — registration and zod args only, no logic (coverage-excluded)
- `src/cli/cli.ts` — dispatch and usage only (coverage-excluded)
- `scripts/smoke.ts` — `EXPECTED_TOOLS`
- `README.md` — verb model and tools table

The banner, footer, and frontmatter modules are read-only inputs here and should not need editing.

## Verify

1. `bun run test`
2. `bun run test:coverage` — the 100% gate stays green
3. `bun run ki:test:smoke` — asserts the fifteen-tool wire surface
4. `ki repo audit --repo .`
5. Tests prove the diff issues no `POST`, `PATCH`, or `DELETE` against Notion, writes nothing to the note file, and reports no change for a note whose rendered blocks match the live page.

## Dependencies / blocks

This item is neither blocked by nor blocking another item. It touches the same `updateNote` render path as [MCP-NOTION-TOOL-001](MCP-NOTION-TOOL-001-build-image-upload-pipeline.md); doing the render/compare split here first gives that item a cleaner seam to hook image substitution into.

## Discussion

### What "changed" means

Notion blocks carry server-assigned ids that are destroyed on every push, because `replaceBody` deletes and re-appends the body rather than editing blocks in place. A diff therefore cannot be an identity-based comparison and must match on rendered content. Whether that is a positional block-by-block comparison, a normalised text comparison, or a coarse per-block-type summary is the item's main open decision, and it determines how useful the output is when a single early paragraph is inserted.

### Fidelity limits

The local side is what this server _would_ push; the live side is what Notion currently reports. Those are not the same vocabulary — the banner is stamped with the current date on every push and is deliberately excluded from `computeBodyHash`, and the child-pages footer is regenerated after each body replace. Both will appear as differences unless the comparison explicitly excludes them, which is a decision to record rather than a detail to discover during implementation.

### Relationship to the hash

`updateNote` already answers "would this push do anything?" cheaply and with zero network calls, via `kb_notion_mirror_hash`. This verb answers the more expensive question "what exactly would change, against the page as it stands now?" — worth being explicit that it does not replace the hash skip and should not be wired into the update path.
