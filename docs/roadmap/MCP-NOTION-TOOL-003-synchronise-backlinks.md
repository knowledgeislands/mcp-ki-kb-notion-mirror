---
id: MCP-NOTION-TOOL-003
area: TOOL
title: Synchronise backlinks
theme: tool-surface
horizon: future
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-04T10:57:19Z
---

## Goal

Knowledge Base notes can show an accurate provenance trail of incoming links when an explicit source-of-truth and write-back policy has been agreed.

## Context

Write the mirror's inbound links back into the KB note for a fuller provenance trail.

## Boundary

Shape the authority, discovery and conflict contract before implementing backlink write-back. Do not infer permission to overwrite local KB fields from the existence of a Notion mirror, or claim complete backlinks from a partial discovery source.

## Current state

The delegated 2026-10-04 review found no authoritative backlink-discovery surface or reverse page-ID-to-note index in this repository. The current ownership guide declares the local KB canonical and Notion a derivative read surface; every local field outside the three mirror-owned fields is read-only. Backlink write-back therefore needs an explicit authority change, not merely a renderer.

## Shaping

Choose whether incoming links mean local KB wikilinks, links within the explicitly mirrored page set, or a workspace-wide Notion discovery capability. Record what completeness can be proved, which source wins on conflict, the exact writable generated field/section, deletion and stale-link handling, and whether mirror-only edits may enter canonical notes. Keep source discovery and write authority distinct. A read-only proposal/report phase may precede write-back, but it is not delivery of the original write-back goal.

## Verify

After owner decisions, use synthetic notes and mocked Notion responses to prove completeness claims, conflict handling, omission/deletion semantics and byte-faithful preservation of unrelated local fields. No live workspace-wide discovery or local write-back is authorised by this review. Preserve Future / draft until these decisions warrant adoption into immediate planning.

## Discussion

### Readiness review

This remains longer-term design work. The phrase “mirror’s inbound links” does not identify whether the source is local wikilinks, a bounded set of mirrored pages, or workspace-wide Notion backlinks. The repository has no backlink-discovery surface or reverse page-ID-to-note index. Agree the authoritative source and completeness boundary, the exact KB field or generated section that may be written, deletion and conflict semantics, and whether mirror-only edits may flow back into an otherwise locally authoritative KB. Until those choices are settled, implementation would invent write authority and cannot be marked Ready.
