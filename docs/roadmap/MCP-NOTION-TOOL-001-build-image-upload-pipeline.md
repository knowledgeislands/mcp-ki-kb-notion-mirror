---
id: MCP-NOTION-TOOL-001
area: TOOL
title: Build image upload pipeline
theme: tool-surface
horizon: next
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-04T21:45:00Z
---

## Goal

Images stored beside a Knowledge Base note appear faithfully in its Notion mirror, and changed image bytes are detected without unnecessary repeated uploads.

## Context

Resolve `<Note> - images/` siblings, upload each file through `POST /v1/file_uploads`, and replace alt-text placeholder paragraphs with Notion image blocks using `file_upload`.

## Boundary

Handle confined local sibling assets in the existing note-mirroring workflow. Do not grant arbitrary filesystem access, change the source authority of the KB, or silently bundle a broad Notion API-version migration; the remaining persistence, size and rendering choices below must be resolved before Ready. The API-version question has primary-source evidence; cache authority remains an owner decision.

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
3. `bun run ki:test:smoke` — the 15-tool wire surface is unchanged
4. `ki repo audit --repo .`
5. Tests prove that a reference outside the confined sibling directory is rejected, that no upload is attempted for a note whose content hash is unchanged, and that the Notion token never appears in an error path.

## Dependencies / blocks

This item is neither blocked by nor blocking another item. It shares the `updateNote` render path with the delivered note-diff implementation in [`src/main/notes/`](../../src/main/notes/); image rendering must preserve that pure render/compare split.

## Documentation impact

### Decision Records

None.

### Specifications

None.

### Guides

Update the README with the image-upload behaviour and any new configuration.

### Roadmap

No additional roadmap impact.

## Remaining readiness decisions

The repository pins `notionApiVersion` to `2022-06-28`. The official [Notion versioning contract](https://developers.notion.com/reference/versioning), checked on 2026-10-04, states that additive endpoints and optional request parameters apply to every API version, including older versions. This resolves the prior documentation uncertainty about needing a broad version migration solely for uploads. The [small-file upload guide](https://developers.notion.com/guides/data-apis/uploading-small-files) specifies create, multipart send, then attach; upload IDs may be reused across blocks/pages and must first be attached within one hour. Verify these shapes through fetch mocks; no live upload is authorised by this planning pass.

The owner must choose the durable uploaded-asset cache boundary. Proposed option A is one generated scalar `kb_notion_mirror_assets` carrying a versioned, bounded JSON mapping of note-local paths and byte digests to successfully attached upload IDs, scoped to the destination page. This expands the current [three-field ownership contract](../../docs/guides/user/what-the-mirror-owns.md); the generic scalar frontmatter helper can represent it, but declared write authority does not presently permit it. Approval would require changing that contract, README, AGENTS guidance, cleanup field lists and exact round-trip tests. Do not implement this fourth field without explicit approval.

Option B is a rebuildable external generated-state cache with atomic writes, restricted permissions, canonical KB-root and destination scoping, and no new field in canonical notes. This preserves the current note ownership boundary but adds storage configuration, cache-loss/re-upload behaviour and isolation tests. No cache location or option has yet been approved. Do not silently select either architecture during implementation.

Proposed bounded asset policy: resolve only `<Note basename without .md> - images/` beside the note; use lexical and realpath containment for every member; support PNG, JPEG, GIF and WebP; limit each note to 16 distinct assets, 5 MiB per asset and 20 MiB total. These are proposed local safety budgets, not claims about every Notion workspace's upload limit. Validate all assets and budgets before network or local mutation.

Proposed change detection: hash actual image bytes on each render/preview and use stable asset placeholders/digests in the body hash, never transient upload IDs. `renderNoteBody`, diff and baseline remain upload-free and cache-write-free. A push uploads changed or uncached assets before replacing the body, persists only successfully attached identities, and permits at most one bounded re-upload on a proven stale identity. Missing files, malformed cache state and upload failure must fail clearly rather than silently preserve a stale picture. The plan must explain baseline semantics and retry/idempotence before Ready.

## Discussion

### Upload request and reuse evidence

The primary-source versioning and upload evidence above removes the old version-only blocker. An implementation still needs binary-capable requests alongside the JSON helper, inherited timeout/error handling and no token exposure. Preserve the pinned API version and avoid a bundled database/data-source migration.

### Cache ownership

Frontmatter travels with a note and reuses existing atomic-write machinery, but broadens canonical metadata authority and adds Git churn and copy/rename semantics. External generated state avoids that write-authority change but requires root/destination isolation, permissions, atomic persistence and cache-loss recovery. The owner decision remains open.

### Readiness review

Keep Next / draft until the cache owner and concrete persistence, stable byte-hash, preview, baseline and recovery semantics are reviewed. The proposed budgets and grammar above are bounded planning recommendations. Existing registration-order audit warnings are unrelated to image behaviour and are not an inferred image defect.

### Question for Kris (2026-10-04)

Should uploaded-asset identities live (A) in a fourth generated frontmatter field `kb_notion_mirror_assets` in canonical KB notes, expanding the mirror's three-field write contract, or (B) in an external rebuildable generated-state cache under the XDG state directory beside `audit.jsonl`, keyed by canonical KB root and destination page, where cache loss means re-upload? The recommendation is B; please also accept the proposed budgets (PNG, JPEG, GIF and WebP; 16 assets per note, 5 MiB each, 20 MiB total) and byte-hash change detection as the Ready baseline, or name the values you want changed.

Classified as an owner decision by the Fable reviewer under delegated autonomy (2026-10-04): either option alters the published note-ownership contract or the mirror's persistence footprint and failure modes, and this record already reserves the choice for the owner, so it falls outside reversible, low-risk delegation.
