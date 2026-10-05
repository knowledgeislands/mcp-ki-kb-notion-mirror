---
id: MCP-NOTION-TOOL-003
area: TOOL
title: Synchronise backlinks
theme: tool-surface
horizon: now
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: 66e21d1d75cb7177ae7e246880adf2a70175b397
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-05T11:19:09Z
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

- [x] Build a bounded, deterministic, symlink-aware whole-root local wikilink graph with exact path and unambiguous basename identity, aliases/anchors, escaped/code exclusion and diagnostics.
- [x] Add strict generated-field ownership validation, stale replacement, pure previews and default-dry-run writes with all-source drift revalidation and honest partial-write errors.
- [x] Expose write-gated local MCP preview/sync tools and token-free local CLI/server configuration without weakening remote token validation.
- [x] Update the four-field ownership guide, README, orientation, cleanup field list, CLI and both-era smoke coverage.
- [x] Verify adversarial isolated fixtures and all required repository gates; publish the six-heading Awaiting-review packet.

## Files touched

Backlinks implementation/tests under `src/main/backlinks/`; local tool registration under `src/tools/backlinks/`; configuration, server, annotation presets, mirror-owned cleanup list, CLI and smoke wiring; README, AGENTS and ownership/user guides; this canonical record and exact batch envelope.

## Verify

Run sequentially: `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage` (100% all four measures), `bun run build`, `bun run ki:test:smoke` (modern and legacy), Biome, Knip, then focused engineering, MCP, work-roadmap, guides and authoring audits. Tests use temporary fixtures and mocked failures only: byte preservation, stale links, aliases/anchors/code/escaping, same basenames, ambiguity/unresolved diagnostics, bounds, confinement, unsafe fields, source drift, dry-run purity and per-file atomic failure reporting.

## Dependencies / blocks

None. Authority is this owner's explicit source and one-field writeback decision, bounded by the outcome batch and repository safety contract.

## Documentation impact

### Decision Records

No new decision record is needed: the owner explicitly chose local wikilink authority and the sole new generated field while retaining the existing canonical-KB architecture. This record and the ownership guide preserve the agreed boundary.

### Specifications

There is no existing Specification corpus to amend. The field grammar, scope and observable safety guarantees are documented in the ownership/user guide and verified by source fixtures; no separate speculative Specification tree is introduced.

### Guides

The ownership guide declares exactly four generated fields. The new local backlinks guide covers token-free setup, accepted grammar, scan scope, diagnostics, bounds, surgical insertion, output-growth refusal, permissions, collision safety and per-file failure recovery. README, user index, installation guide and AGENTS expose the contract and 17-tool surface.

### Roadmap

This canonical item advances to Awaiting review with its immutable baseline and six-heading packet. The exact outcome batch remains started; the parent owns reviewed closure and explicit pruning. No follow-on work is admitted to this batch.

## Delegation

The parent coordinator delegated this one repository exclusively to its backlinks worker. The worker plans, implements and commits; the parent independently reviews and owns acceptance/pruning. No self-acceptance or record deletion.

## Review

### Delivered

Delivered the approved local incoming-link writeback boundary from immutable baseline `66e21d1d75cb7177ae7e246880adf2a70175b397`. Local KB wikilinks alone generate `kb_notion_mirror_backlinks`; no Notion reverse discovery, live Notion request, real private KB write, push, release or acceptance occurred. The delivery commit containing this packet is the review candidate; the parent coordinator owns exact independent review and closure.

### Change Summary

Added the local graph and writeback implementation/tests under `src/main/backlinks/`, two closed-world MCP tools under `src/tools/backlinks/`, explicit token-free local server mode, local CLI preview/default-dry-run sync, and read/write access gating. Added the fourth owned cleanup field and the complete ownership/setup/tool documentation. The remote default and token requirement remain strict.

Parent formative review identified concrete safety gaps, all addressed within the approved preservation/confinement boundary: new-field insertion appends before the closing delimiter to preserve multiline anchors; shared atomic writes use short UUID staging names with exclusive no-follow creation, refuse collisions without deleting existing paths, preserve note permissions and support long valid basenames; all prepared outputs fit per-file and total scan budgets before any write. Existing generated values update in place. The graph reports unresolved targets and refuses every ambiguous apply.

### Verification

Final source gates passed: `bunx tsc --noEmit`; `bun run test` with 412 tests in 27 files; `bun run test:coverage` with 100% statements, branches, functions and lines; `bun run build`; `bun run ki:test:smoke` covering the 17-tool remote surface in modern and legacy eras, token-free local preview/apply, default dry-run, strict path rejection and read/write gates. Biome exits zero; its 30 warnings occur exclusively in unchanged diff/image files. Knip exits zero with six existing configuration hints. Focused `ki-engineering`, `ki-repo-mcp`, `ki-guides` and `ki-authoring` audits passed; work-roadmap and authoring pass with this final packet.

Adversarial fixtures prove aliases/anchors/code/escaping, duplicate references and basename ambiguity, self-links, stale deletion, exclusion of generated backlinks from source edges, exact unrelated bytes, unsafe generated-field refusal, confinement/symlinks, unreadable and invalid UTF8 sources, scan/reference/diagnostic bounds, output-growth refusal, source/membership drift, dry-run purity, atomic collisions and private permissions, long basenames and truthful partial-application errors. An early engineering audit collided with a concurrently running explicit coverage process; the report-directory lock refused it, and the audit was rerun sequentially and passed. The initial in-progress body audit required the Documentation impact heading; this final packet supplies it.

### Outstanding concerns

No unresolved delivery failure. Completeness is limited deliberately to visible lowercase Markdown under the configured KB root, excluding dot paths and `node_modules`; it does not claim hidden-content or Notion completeness. Unresolved targets are omitted with `resolution_complete: false`; ambiguous targets block apply. Multi-file writes are individually atomic rather than transactional, and later failure names already written paths. Filesystem revalidation does not lock out concurrent editors, so apply should run without simultaneous KB edits. Baseline Biome warnings and Knip hints remain outside this item's scope.

### Post-change review

The author reviewed source and fixture evidence against the one-field authority, preservation, confinement, boundedness and remote-default contracts. Parent formative findings were integrated and verified without broad token/schema changes. The candidate is ready for independent exact-commit review; this packet does not imply its own acceptance. The bounded batch retains only its started marker until the parent commits reviewed Done evidence.

### Mini recap

Delivered actual local KB provenance writeback alongside pure previews, explicit safe apply and clear completeness/failure semantics. All source gates pass; final record checks accompany the delivery commit. Practical learning belongs in the local backlinks guide and ownership guide. No new work or knowledge trade is created by this recap.

## Discussion

### Source and ownership

Local wikilinks alone establish incoming links. A complete filesystem scan is scoped to visible `.md` files under KB root, independent of publishing exclusions. Unresolved targets are reported and omitted; ambiguous targets never guess and block writeback. Exact root-relative paths with optional `.md`, and unique bare basenames, match the mirror's existing identities while eliminating last-wins collisions. Display aliases do not change targets; heading/block anchors are removed for note identity. Frontmatter and code/escaped wikilinks do not contribute edges.

### Generated field

The fourth owned field contains a YAML double-quoted JSON scalar encoding `{"v":1,"sources":["relative/source.md"]}` with sorted unique paths, bounded by scan/result limits. It is recomputed from source, including empty sources to remove stale backlinks. Unknown versions, noncanonical values, duplicates and multiline content are refused. Hand-authored fields and all source bytes outside that exact line remain authoritative.

### Write and completeness

Preview changes no graph/source state. Sync scans and validates all target edits before writing, revalidates every source and membership immediately before writing, and uses atomic whole-file replacement per target. A multi-file operation is not a transaction; later filesystem failure reports which exact paths were already written. Completeness is reported separately for the declared scan scope and target resolution. Notion tokens are unnecessary for local operations.

### Safe replacement and bounded outputs

Parent formative review required safe append placement for a new field, exclusive no-follow temporary creation, permission preservation, short staging names for valid long basenames, and prewrite output-byte validation. These refinements implement the approved byte-preservation/confinement boundary rather than expanding field ownership or introducing Notion authority. Unknown staging collisions remain intact; each successful replacement is atomic and multi-file failure reports earlier writes.
