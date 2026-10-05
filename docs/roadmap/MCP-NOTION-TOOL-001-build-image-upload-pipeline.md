---
id: MCP-NOTION-TOOL-001
area: TOOL
title: Build image upload pipeline
theme: tool-surface
horizon: now
status: done
blocks: []
blocked_by: []
baseline_ref: 2f6cb44947f68a3604db2b67b82d6c7d7d700ebf
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-05T07:57:12Z
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

- [x] Settle and record the resolution rule for the `<Note> - images/` sibling directory, then add the directory-and-member confinement helper to `src/utils/paths.ts` alongside `resolveKbNotePath`, with the same lexical-plus-realpath discipline.
- [x] Confirm the upload request contract against the Notion API version this repo pins (`notionApiVersion` in `src/config/index.ts`) and add the upload call to `src/main/notion-client/index.ts`, reusing the existing timeout budget, `NotionApiError` envelope, and never-log-the-token rule; the JSON-only `request` helper will need a binary-capable sibling rather than a change of shape.
- [x] Detect local image references during conversion in `src/main/notes/markdown.ts` and carry them through `bodyToBlocks` as explicit placeholders, so the substitution point is a named seam rather than a post-hoc scan of martian's output — mirroring how mention placeholders are already handled.
- [x] Wire resolution, upload, and placeholder substitution into the `updateNote` render path, and decide how uploaded-asset identity folds into `computeBodyHash` so an unchanged note still skips while an edited image does not.
- [x] Add co-located tests using `fetch` mocks and the synthetic Greek fixture scheme, keeping the 100% coverage gate green, and document any new environment knob in `README.md`.

## Files touched

- `src/main/notes/markdown.ts` and `markdown.test.ts` — reference detection and placeholder carriage
- A new `src/main/notes/images.ts` and `images.test.ts` — sibling resolution and upload orchestration
- `src/main/notes/index.ts` and `index.test.ts` — the `updateNote` render path
- `src/main/notes/hash.ts` — only if asset identity must enter the content hash
- `src/main/notion-client/index.ts` and `index.test.ts` — the upload call and its binary request path
- `src/utils/paths.ts` and `paths.test.ts` — sibling-directory confinement
- `src/config/index.ts` and `index.test.ts` — only if a budget or toggle knob is introduced
- `README.md` — environment variables and the touch/update description

No tool is added or removed, so `src/tools/`, `src/cli/`, and `scripts/smoke.ts` stay untouched. The shared diff renderer and its tests, installation guide and `.env.example` also document and verify the opt-in contract.

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

The current completion authority and coordinator selection choose external generated state (option B), preserving the three-field note boundary. The earlier alternatives were: Proposed option A is one generated scalar `kb_notion_mirror_assets` carrying a versioned, bounded JSON mapping of note-local paths and byte digests to successfully attached upload IDs, scoped to the destination page. This expands the current [three-field ownership contract](../../docs/guides/user/what-the-mirror-owns.md); the generic scalar frontmatter helper can represent it, but declared write authority does not presently permit it. Approval would require changing that contract, README, AGENTS guidance, cleanup field lists and exact round-trip tests. Do not implement this fourth field without explicit approval.

Option B is a rebuildable external generated-state cache with atomic writes, restricted permissions, canonical KB-root and destination scoping, and no new field in canonical notes. This preserves the current note ownership boundary but adds storage configuration, cache-loss/re-upload behaviour and isolation tests. Option B is selected: `image-uploads/` beside the configured audit-log state file, with cache filenames derived from note identity, destination page and API origin. Mode 0700 directories and 0600 atomic files retain only content-digest/upload-ID mappings; tokens are never stored.

Proposed bounded asset policy: resolve only `<Note basename without .md> - images/` beside the note; use lexical and realpath containment for every member; support PNG, JPEG, GIF and WebP; limit each note to 16 distinct assets, 5 MiB per asset and 20 MiB total. These are proposed local safety budgets, not claims about every Notion workspace's upload limit. Validate all assets and budgets before network or local mutation.

Proposed change detection: hash actual image bytes on each render/preview and use stable asset placeholders/digests in the body hash, never transient upload IDs. `renderNoteBody`, diff and baseline remain upload-free and cache-write-free. A push uploads changed or uncached assets before replacing the body, persists only successfully attached identities, and permits at most one bounded re-upload on a proven stale identity. Missing files, malformed cache state and upload failure must fail clearly rather than silently preserve a stale picture. Baseline retains its existing explicit assertion semantics and never uploads or writes upload state. Missing/malformed state fails before a mutation; cache loss re-uploads on an actual changed/forced push. A provider-rejected cached upload fails visibly and recovery clears the relevant generated cache before retrying, rather than automatically repeating arbitrary publication failures.

## Approved delivery contract

The principal's current autonomous completion instruction and coordinator's bounded selection choose option B: an external rebuildable generated-state cache beside the configured audit-state file, keyed by canonical note identity and destination page. Preserve the three-field canonical-note write boundary. Image upload is explicitly opt-in through `MCP_KI_KB_NOTION_MIRROR_IMAGES`; retain existing rendering when disabled. Selected safety budgets are 16 distinct PNG/JPEG/GIF/WebP assets per note, 5 MiB per asset and 20 MiB aggregate; assets remain confined to the exact note sibling directory. Read actual bytes for stable digests, avoid uploads and cache writes in diff/baseline, and upload only after a changed push is selected. External-cache loss causes bounded re-upload. Preserve timeout/token handling and use mock-only verification. Backlink work remains independent pending source-authority decision.

## Review

### Delivered

Delivered opt-in confined sibling image uploads under the external generated-state contract. Immutable baseline: `2f6cb44947f68a3604db2b67b82d6c7d7d700ebf`. No live Notion operation, KB mutation, new tool, API-version migration or fourth mirror field was introduced by verification. Backlinks remain independent.

### Change Summary

Added `src/main/notes/images.ts` and co-located fixture tests for sibling confinement, byte digests, finite budgets, stable image rendering and restricted atomic upload-ID cache state. The Notion client sends create/multipart requests only through its inherited trusted API origin, version and timeout handling. Update materializes uploads after the unchanged-content skip check; baseline and diff use the read-only renderer. Config, `.env.example`, README and installation guidance make the opt-in and recovery contract explicit. Note, diff and config integration tests preserve the three-field note boundary and no-write previews.

### Verification

`bun run test`: 375 tests pass. `bun run test:coverage`: 100% statements, branches, functions and lines (822 branches). `bunx tsc --noEmit`, `bun run build`, `bun run ki:test:smoke` and `bunx knip` pass. Focused `ki-engineering`, `ki-repo-mcp` and `ki-work-roadmap` audits pass. Biome formatting/check succeeds with advisory non-null-assertion warnings, including existing diff warnings; no lint error is bypassed. Smoke preserves the 15-tool surface. All network tests use synthetic fetch responses and all filesystem tests use disposable fixture roots.

### Outstanding concerns

No incomplete delivery task remains in this item. Product limits are documented: the cache is rebuildable, malformed or provider-rejected state fails visibly, and recovery clears only the relevant generated cache. Image diff is conservative because hosted Notion images do not provide a trustworthy local byte digest; it may report image differences without proving remote byte edits. Baseline is an operator assertion, not a remote image-verification operation. Mixed inline images preserve text and render image blocks beside it. No live provider compatibility observation is claimed.

### Post-change review

Changed asset bytes alter the pushed content hash independently of upload IDs; unchanged pushes make zero Notion calls. Path and budget rejection occurs before upload. Repeated references share one canonical byte snapshot, reference metadata is capped at 1,024, and retained unique asset payload is capped at 20 MiB. Existing user-state symlinks or public cache objects are refused before upload and revalidated before persistence. Upload state is persisted only after body attachment succeeds, and cache loss safely re-uploads. Preview/baseline does not upload or mutate generated state, and source frontmatter remains limited to existing mirror-owned fields. Goal and bounded scope are satisfied for the documented Markdown reference grammar and opt-in operation; ready for independent review.

### Mini recap

Delivered safe local-image rendering, upload transport and external identity state with full fixture verification. Durable operation and limits live in README/installation guidance; no extra learning promotion is requested. Awaiting independent review under the bound outcome authorisation.

## Done

Accepted under the named done-target MCP-NOTION-BATCH-001 outcome authority and the principal’s standing acceptance instruction. Independent reviewer `review_whatsapp_git` approved corrected exact delivery `adaa03b8896d1e65589b2414801675c9c29b6110` after reproducing both original safety defects: repeated references now share one buffer, and unsafe cache ancestry/permissions reject before uploads or external writes. The reviewer reran 81 focused tests and confirmed coverage evidence at 100% across 822 branches. The six-part packet and all planned Steps are satisfied. Documented conservative image diff and generated-cache recovery remain; no live Notion observation is claimed. Backlink write-back remains separately unapproved.

## Discussion

### Upload request and reuse evidence

The primary-source versioning and upload evidence above removes the old version-only blocker. An implementation still needs binary-capable requests alongside the JSON helper, inherited timeout/error handling and no token exposure. Preserve the pinned API version and avoid a bundled database/data-source migration.

### Cache ownership

Frontmatter travels with a note and reuses existing atomic-write machinery, but broadens canonical metadata authority and adds Git churn and copy/rename semantics. External generated state avoids that write-authority change but requires root/destination isolation, permissions, atomic persistence and cache-loss recovery. External generated state is now selected under current completion authority; canonical notes retain exactly three writable mirror fields.

### Readiness review

The selected external-state, opt-in and budget contract is implemented and verified below. Existing registration-order audit warnings are unrelated to image behaviour and are not an inferred image defect.

### Owner question disposition

The earlier cache-choice question is resolved by the current completion instruction and coordinator selection of external generated state with the stated budgets. No fourth canonical-note field is introduced. Backlink write-back authority remains in its independent work record, outside this image delivery.

### Independent review repairs

Independent review of `74c279bda96c7dec23c2ec540fe8a622cb508fe1` found that repeated references retained duplicate Buffers and existing cache-directory symlinks/public permissions were accepted. The repair reuses one byte snapshot per canonical asset, caps references separately, rejects over-budget new asset payload before retention, and validates physical user-state ancestry plus private directory/file types before upload and again before persistence. Regression fixtures reproduce 25 references to a 1 MiB file (one Buffer and one file read), linked state/cache directories (zero provider calls and unchanged outside directory), 0755 cache directories, linked/public/nonregular cache files and ancestry replacement before persistence. Fresh full coverage and delivery gates below supersede the initial candidate evidence. Top-level operating-system path aliases are trusted host roots; no cross-process lock against a malicious same-user filesystem writer is claimed.
