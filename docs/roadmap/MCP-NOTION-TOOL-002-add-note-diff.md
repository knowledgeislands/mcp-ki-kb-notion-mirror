---
id: MCP-NOTION-TOOL-002
area: TOOL
title: Add KB note diff
theme: tool-surface
horizon: next
status: done
blocks: []
blocked_by: []
baseline_ref: bb9a98331217d0951e7eec3041552d62cf290baf
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-02T02:20:58Z
---

## Goal

Callers can preview the body-content changes a mirror update would make without writing to Notion or changing the local note.

## Context

The existing status, preflight, and get verbs do not compare a rendered local body with live Notion blocks. The update and baseline paths already render the same body separately, while `getBlockChildren` follows pagination for one block level. A preview must share rendering and compare content rather than server-assigned block identity.

## Boundary

Add the read-only `kb_notion_mirror_note_diff` tool and matching `note diff` CLI verb. Compare the authored body, including nested content, and report page metadata changes separately where update controls title, icon, and parent. Exclude the generated banner and managed child-pages footer from authored-body differences, but expose that exclusion in the result. No upload, page mutation, frontmatter write-back, or automatic invocation from update is included.

## Current state

[src/main/notes/index.ts](../../src/main/notes/index.ts) renders wikilinks and blocks inline in both `updateNote` and `baselineNote`; its hash skips a push based on the last local publication, not the present remote body. [The Notion client](../../src/main/notion-client/index.ts) already lists all immediate children. Generated content is defined in [banner.ts](../../src/main/notes/banner.ts) and [footer.ts](../../src/main/notes/footer.ts). The current smoke test covers fourteen tools in both protocol eras.

## Steps

- [x] Factor pure local rendering into one helper consumed by update, baseline, and diff. Keep existing output and hash behaviour identical for existing notes; the helper must perform no remote or local write.
- [x] Define a strict diff result schema containing page identity, `identical`, ordered body changes with old/new positions and canonical block payloads, metadata changes, and excluded generated-region information. An unmirrored note returns an explicit `not-mirrored` result without any Notion request.
- [x] Fetch the current page and recursively fetch the paginated children required for comparison. Bound the traversal to 1,000 authored blocks and depth 32; reject an over-budget or unsupported representation explicitly rather than claim an incomplete comparison is identical.
- [x] Canonicalise local and remote blocks by write-relevant type payload, nested children, rich-text content, link targets, annotations, and mention target identity. Remove only known server metadata and normalise known default values; never remove nested mention IDs as though they were block IDs. Preserve unknown content as an explicit comparison limitation rather than dropping it.
- [x] Use a deterministic longest-common-subsequence comparison of canonical top-level body blocks, treating nested content as part of its parent block. Report insertions and deletions; a changed block is one removal plus one insertion, so no identity-based changed classification is implied. Keep early insertions from producing a false cascade of changed blocks.
- [x] Recognise the managed banner only in its leading position and the managed footer through the existing sentinel/child-page convention. Do not drop an arbitrary authored callout or heading because its type resembles generated content. Report title/icon/parent differences separately and document the generated-region exclusion.
- [x] Register the new tool with `READ_ONLY_REMOTE` through the access gate, expose matching CLI dispatch and library export, and update smoke expectations to fifteen tools without changing the modern/legacy protocol contract.
- [x] Add fixture-backed comparisons for identical, inserted, removed, edited, reordered, nested, paginated, and unmirrored content; preserve existing update/baseline hash tests. Document the result and limitations.

## Files touched

- [src/main/notes/index.ts](../../src/main/notes/index.ts), its tests, and new focused render/diff helpers with co-located tests.
- [src/main/notion-client/index.ts](../../src/main/notion-client/index.ts) and its tests only where typed recursive read support needs extending.
- [src/tools/note/index.ts](../../src/tools/note/index.ts), [src/cli/cli.ts](../../src/cli/cli.ts), and [src/cli/index.ts](../../src/cli/index.ts) for the tool, CLI, and export wiring.
- [scripts/smoke.ts](../../scripts/smoke.ts), [README.md](../../README.md), and [the mirroring guide](../guides/user/mirroring-a-knowledge-base.md).

## Verify

1. Run `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage`, `bun run build`, and `bun run ki:test:smoke` sequentially. Preserve the 100% coverage gate and assert fifteen tools for both modern discovery and legacy initialisation.
2. Diff makes only GET requests. Spy on filesystem write/rename and HTTP mutation paths to prove no mutation; note bytes and hash/frontmatter remain exactly unchanged even on errors.
3. A paragraph inserted at the beginning produces one insertion. Nested differences and pagination are observed; mention target differences are retained; only positively identified generated content is excluded. Unsupported or over-budget content never yields `identical: true`.
4. The existing zero-call update skip and baseline render/hash output remain unchanged. An unmirrored note makes no HTTP request.
5. Run focused `ki-repo-mcp`, `ki-engineering`, and `ki-work-roadmap` audits, recording any unrelated findings separately.

## Dependencies / blocks

No build dependency. This item should land before [the image pipeline](MCP-NOTION-TOOL-001-build-image-upload-pipeline.md) because both use the render path. An image implementation must extend the shared pure representation and comparison deliberately; diff must never trigger an upload. Do not mark the image item blocked merely for lifecycle approval once the shared render work exists.

## Documentation impact

### Decision Records

The bounded diff algorithm and generated-region treatment are recorded here; promote a durable decision only if implementation reveals a broader mirror-ownership policy change.

### Specifications

The strict tool schema and comparison contract tests specify the new read-only capability; no standalone specification area is required.

### Guides

Extend the verb model and mirroring guide with diff output, metadata comparison, generated exclusions, and comparison limits.

### Roadmap

The image pipeline must build on the resulting render representation; it remains separately scoped.

## Review

### Delivered

Added a read-only KB note diff from baseline `bb9a98331217d0951e7eec3041552d62cf290baf`. The MCP tool and `note diff` CLI verb compare the update-rendered local body with the live Notion page and return ordered body and separate metadata changes.

### Change Summary

Update, baseline, and diff now share one pure body renderer. The comparison recursively reads paginated remote blocks, canonicalises write-relevant content, and uses a deterministic longest-common-subsequence diff. It recognises only an exact leading generated banner and the managed child-page footer, reports those exclusions, normalises parent UUID spelling, and errors on unsupported or incomplete data. Traversal caps are 1,000 authored blocks, 10,000 fetched blocks, and depth 32. Tool schema, generated client methods, CLI, smoke inventory, README, and guides are aligned.

### Verification

The full test suite and coverage gate passed at 100% statements, branches, functions, and lines. Focused fixtures cover identical, inserted, removed, edited, reordered, nested, paginated, generated-region, unsupported, over-budget, and unmirrored cases. Tests verify only GET requests and no note write or rename. TypeScript, build, smoke, and repository audits are the final gates before commit.

### Outstanding concerns

The comparison covers the current page snapshot; a concurrent Notion edit after the read can change a later update result. Unsupported block types and over-budget pages return errors rather than a possibly false `identical`. The 10,000 fetched-block cap also bounds pages dominated by generated child pages. No live Notion account was used for this diff test.

### Post-change review

The existing update zero-call hash skip and baseline behavior remain covered by their prior tests. An early insertion produces one insertion, nested children remain part of their parent block, mention target IDs are retained, and similar authored callouts/headings are not discarded. The tool is visible at read access with strict input and result schemas.

### Mini recap

The scoped implementation and fixture verification are complete locally. No Git remote was pushed. This item remains Awaiting review until owner acceptance of this packet.

## Done

Accepted 2026-10-02 by Kris Brown on the review packet above.

## Discussion

### What "changed" means

Notion assigns fresh block IDs after replacement, so compare canonical write-relevant content rather than identity. The selected deterministic longest-common-subsequence comparison emits insertions and deletions; an edited block is a removal plus an insertion. Nested content belongs to its parent comparison and early insertions must not create cascades of false changes.

### Fidelity limits

Compare the content this server would render with the bounded live block tree. Exclude only positively identified generated banners and managed child-page footers, and report that exclusion explicitly. Report metadata changes separately. Unknown or over-budget representations yield an explicit limitation/error, never a false identical result.

### Relationship to the hash

`updateNote` already answers "would this push do anything?" cheaply and with zero network calls, via `kb_notion_mirror_hash`. This verb answers the more expensive question "what exactly would change, against the page as it stands now?" — worth being explicit that it does not replace the hash skip and should not be wired into the update path.

### Readiness review

The planning contract selects canonical content comparison and deterministic insert/delete output. This supersedes the earlier open granularity question; date-stamped banners and child-page footers are explicitly outside the authored-body comparison, and metadata changes are reported separately.
