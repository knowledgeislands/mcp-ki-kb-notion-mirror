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
updated_at: 2026-10-01T19:30:08Z
---

## Goal

Knowledge Base notes can show an accurate provenance trail of incoming links when an explicit source-of-truth and write-back policy has been agreed.

## Context

Write the mirror's inbound links back into the KB note for a fuller provenance trail.

## Boundary

Shape the authority, discovery and conflict contract before implementing backlink write-back. Do not infer permission to overwrite local KB fields from the existence of a Notion mirror, or claim complete backlinks from a partial discovery source.

## Discussion

### Readiness review

This remains longer-term design work. The phrase “mirror’s inbound links” does not identify whether the source is local wikilinks, a bounded set of mirrored pages, or workspace-wide Notion backlinks. The repository has no backlink-discovery surface or reverse page-ID-to-note index. Agree the authoritative source and completeness boundary, the exact KB field or generated section that may be written, deletion and conflict semantics, and whether mirror-only edits may flow back into an otherwise locally authoritative KB. Until those choices are settled, implementation would invent write authority and cannot be marked Ready.
