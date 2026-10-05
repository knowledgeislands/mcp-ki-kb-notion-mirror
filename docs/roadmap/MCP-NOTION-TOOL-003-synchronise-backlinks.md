---
id: MCP-NOTION-TOOL-003
area: TOOL
title: Synchronise backlinks
theme: tool-surface
horizon: now
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-05T11:01:40Z
---

## Goal

Knowledge Base notes carry deterministic incoming-link provenance derived solely from local KB wikilinks in the generated `kb_notion_mirror_backlinks` frontmatter field.

## Context

The owner explicitly approved local wikilinks as incoming-link authority and one additional generated field. Notion remains derivative; reverse discovery and mirror edits never become KB source authority.

## Boundary

Scan the entire configured KB root's visible Markdown scope, excluding dot paths and `node_modules`. Refuse symlinks, unreadable files, exceeded bounds, ambiguous references, unsafe generated fields and source drift before writes. Preview is read-only; sync defaults to dry-run and writes only the new field atomically per file. No live Notion calls, real private KB writes, push or publication.

## Current state

The owner resolved the prior Future/draft authority questions on 2026-10-05 and approved delivery with reviewed acceptance handled by the parent coordinator. Existing mirror metadata uses surgical frontmatter edits. There is no approved Notion reverse-discovery source.

## Steps

- [ ] Build a bounded, deterministic, symlink-aware whole-root local wikilink graph with exact path and unambiguous basename identity, aliases/anchors, escaped/code exclusion and diagnostics.
- [ ] Add strict generated-field ownership validation, stale replacement, pure previews and default-dry-run writes with all-source drift revalidation and honest partial-write errors.
- [ ] Expose write-gated local MCP preview/sync tools and token-free local CLI/server configuration without weakening remote token validation.
- [ ] Update the four-field ownership guide, README, orientation, cleanup field list, CLI and both-era smoke coverage.
- [ ] Verify adversarial isolated fixtures and all required repository gates; publish the six-heading Awaiting-review packet.

## Files touched

Backlinks implementation/tests under `src/main/backlinks/`; local tool registration under `src/tools/backlinks/`; configuration, server, annotation presets, mirror-owned cleanup list, CLI and smoke wiring; README, AGENTS and ownership/user guides; this canonical record and exact batch envelope.

## Verify

Run sequentially: `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage` (100% all four measures), `bun run build`, `bun run ki:test:smoke` (modern and legacy), Biome, Knip, then focused engineering, MCP, work-roadmap, guides and authoring audits. Tests use temporary fixtures and mocked failures only: byte preservation, stale links, aliases/anchors/code/escaping, same basenames, ambiguity/unresolved diagnostics, bounds, confinement, unsafe fields, source drift, dry-run purity and per-file atomic failure reporting.

## Dependencies / blocks

None. Authority is this owner's explicit source and one-field writeback decision, bounded by the outcome batch and repository safety contract.

## Delegation

The parent coordinator delegated this one repository exclusively to its backlinks worker. The worker plans, implements and commits; the parent independently reviews and owns acceptance/pruning. No self-acceptance or record deletion.

## Discussion

### Source and ownership

Local wikilinks alone establish incoming links. A complete filesystem scan is scoped to visible `.md` files under KB root, independent of publishing exclusions. Unresolved targets are reported and omitted; ambiguous targets never guess and block writeback. Exact root-relative paths with optional `.md`, and unique bare basenames, match the mirror's existing identities while eliminating last-wins collisions. Display aliases do not change targets; heading/block anchors are removed for note identity. Frontmatter and code/escaped wikilinks do not contribute edges.

### Generated field

The fourth owned field contains a YAML double-quoted JSON scalar encoding `{"v":1,"sources":["relative/source.md"]}` with sorted unique paths, bounded by scan/result limits. It is recomputed from source, including empty sources to remove stale backlinks. Unknown versions, noncanonical values, duplicates and multiline content are refused. Hand-authored fields and all source bytes outside that exact line remain authoritative.

### Write and completeness

Preview changes no graph/source state. Sync scans and validates all target edits before writing, revalidates every source and membership immediately before writing, and uses atomic whole-file replacement per target. A multi-file operation is not a transaction; later filesystem failure reports which exact paths were already written. Completeness is reported separately for the declared scan scope and target resolution. Notion tokens are unnecessary for local operations.
