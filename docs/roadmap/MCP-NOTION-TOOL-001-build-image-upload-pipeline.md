---
id: MCP-NOTION-TOOL-001
area: TOOL
title: Build image upload pipeline
theme: tool-surface
horizon: next
status: draft
blocks: []
blocked-by: []
baseline-ref: null
---

## Goal

Achieve the stated outcome: Build image upload pipeline.

## Context

Resolve `<Note> - images/` siblings, upload each file through `POST /v1/file_uploads`, and replace alt-text placeholder paragraphs with Notion image blocks using `file_upload`.

## Boundary

Keep the work limited to the stated surface.

## Current state

Nothing in `src/` handles images today. The only mention of them is the "Known gaps" note in the module docstring of [src/main/notes/markdown.ts](../../src/main/notes/markdown.ts), which records that local image references render as their alt-text paragraph; `bodyToBlocks` hands the markdown straight to `@tryfabric/martian` and applies only the KB-specific transforms (`stripFrontmatter`, `stripLeadingH1`, `collapseSoftBreaks`), so an image reference arrives in Notion as ordinary rich text.

[src/main/notion-client/index.ts](../../src/main/notion-client/index.ts) has no upload capability. Every call goes through one private `request` helper that sets `Content-Type: application/json`, `JSON.stringify`s the body, and parses a JSON response; the exported surface is `getDatabase`, `createPage`, `updatePage`, `archivePage`, `setPageParent`, `getPage`, `getBlockChildren`, `appendBlockChildren`, and `deleteBlock`. There is no binary or multipart request path, and no code reads bytes off disk other than the note file itself.

[src/utils/paths.ts](../../src/utils/paths.ts) exports `resolveKbNotePath` and `KbPathError` only. `resolveKbNotePath` confines a single note path under `cfg.kbRoot`; there is no helper for confining a sibling asset directory or the files inside it, so the containment discipline this pipeline needs does not yet exist.

`computeBodyHash` in [src/main/notes/hash.ts](../../src/main/notes/hash.ts) hashes the resolved block array, the title, the icon, and the parent. Image blocks would therefore enter the skip calculation automatically once they exist in the block tree, but nothing observes the image _bytes_, so an edited image behind an unchanged reference would currently hash identically and be skipped.

`MirrorSettings` in [src/config/index.ts](../../src/config/index.ts) carries `skipPrefixes`, `skipKbPaths`, and `iconBaseUrl`. There is no asset-related knob and no size or count budget.

## Steps

- [ ] Settle and record the resolution rule for the `<Note> - images/` sibling directory, then add the directory-and-member confinement helper to `src/utils/paths.ts` alongside `resolveKbNotePath`, with the same lexical-plus-realpath discipline.
- [ ] Confirm the upload request contract against the Notion API version this repo pins (`notionApiVersion` in `src/config/index.ts`) and add the upload call to `src/main/notion-client/index.ts`, reusing the existing timeout budget, `NotionApiError` envelope, and never-log-the-token rule; the JSON-only `request` helper will need a binary-capable sibling rather than a change of shape.
- [ ] Detect local image references during conversion in `src/main/notes/markdown.ts` and carry them through `bodyToBlocks` as explicit placeholders, so the substitution point is a named seam rather than a post-hoc scan of martian's output — mirroring how mention placeholders are already handled.
- [ ] Wire resolution, upload, and placeholder substitution into the `updateNote` render path, and decide how uploaded-asset identity folds into `computeBodyHash` so an unchanged note still skips while an edited image does not.
- [ ] Add co-located tests using `fetch` mocks and the synthetic Greek fixture scheme, keeping the 100% coverage gate green, and document any new environment knob in `README.md`.

## Files touched

- `src/main/notes/markdown.ts` and `markdown.test.ts` — reference detection and placeholder carriage
- A new `src/main/notes/images.ts` and `images.test.ts` — sibling resolution and upload orchestration
- `src/main/notes/index.ts` and `index.test.ts` — the `updateNote` render path
- `src/main/notes/hash.ts` — only if asset identity must enter the content hash
- `src/main/notion-client/index.ts` and `index.test.ts` — the upload call and its binary request path
- `src/utils/paths.ts` and `paths.test.ts` — sibling-directory confinement
- `src/config/index.ts` and `index.test.ts` — only if a budget or toggle knob is introduced
- `README.md` — environment variables and the touch/update description

No tool is added or removed, so `src/tools/`, `src/cli/`, and `scripts/smoke.ts` stay untouched.

## Verify

1. `bun run test`
2. `bun run test:coverage` — the 100% line/branch/function/statement gate stays green
3. `bun run ki:test:smoke` — the 14-tool wire surface is unchanged
4. `ki repo audit --repo .`
5. Tests prove that a reference outside the confined sibling directory is rejected, that no upload is attempted for a note whose content hash is unchanged, and that the Notion token never appears in an error path.

## Dependencies / blocks

This item is neither blocked by nor blocking another item. It shares the `updateNote` render path with [MCP-NOTION-TOOL-002](MCP-NOTION-TOOL-002-add-note-diff.md); whichever lands second inherits the other's shape of that path, and the diff item's render/compare split is the more convenient order if both are scheduled together.

## Discussion

### Upload contract is unsettled

This repo has never called an upload endpoint, so the request shape, the response fields to retain, and the lifetime of an uploaded asset are all unverified here. Treat every specific beyond the endpoint named in `Context` as an open decision to be confirmed against Notion's documentation for the pinned API version before implementation, not as settled design.

### Asset change detection

The content hash is the load-bearing skip mechanism and it currently sees only the rendered blocks. Whether to hash image bytes, file metadata, or a recorded upload identity is undecided, and the choice has a direct cost: hashing bytes means reading every referenced image on every publish, including runs that would otherwise make no Notion call at all.

### Re-upload on every push

`replaceBody` deletes and re-appends the whole non-child-page body on each update, so any image block is recreated too. Whether a previously uploaded asset can be referenced again by the new block, or must be re-uploaded, decides whether this pipeline is cheap or expensive at steady state. This needs answering early — it may change the answer to the previous topic.

### Budgets

A note can reference arbitrarily many arbitrarily large files. The upload path is the first place in this server where user content size drives network cost, so a count and size budget is likely needed; whether it is a config knob or a fixed constant is open.
