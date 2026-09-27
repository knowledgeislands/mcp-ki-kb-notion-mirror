---
id: MCP-NOTION-TOOL-007
title: Review conformance audit
area: TOOL
theme: tool-surface
horizon: future
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-04T08:54:17Z
updated_at: 2026-09-27T23:11:22Z
---

## Goal

Discuss the unresolved repository conformance findings before selecting remediation.

## Context

The estate audit reported unresolved repository-standard and Decision Records findings.

## Boundary

This is a discussion proposal only. It is not accepted, prioritised, or implementation authority.

## Shaping

Confirm the exact acceptance criteria, distinguish deterministic maintenance from design choices, and define focused verification.

## Discussion

Review the evidence before deciding whether to repair, defer, or document an exception.

### Pickup checkpoint — 2026-09-28

At local `main` `0e92daee5f7ccce176cc8dcabe455a2c290639d1`, `c14bb5e756e40ee8673cb9e4bf32d96a86605daa` adopted Decision Records in `docs/decisions/GDR-MCP-NOTION-001-adopting-decision-records.md` and indexed them in `docs/decisions/README.md`. A fresh `ki repo audit --repo .` passed all 21 selected skills, including `ki-decision-records` and `ki-repo`. This is delivery and current mechanical-audit evidence for the cited concerns, not proof that every historical finding is resolved: the estate audit's exact finding identities and judgment criteria were not available in this record.

Remaining: recover or restate those findings, compare their Decision Record and repository-standard criteria with current evidence, then seek the owner's repair, deferral, or exception decision. No executable suite or live Notion check was run for this documentation-only audit. Before implementation, reconcile destination `main`, linked tasks, and retained worktrees; only the primary worktree was visible locally, and remote task ownership was unavailable. Missing evidence does not release a claim or lift a hold. This checkpoint is pickup guidance, not execution block or resumption authority. Draft/Future state remains unchanged; eventual closure requires review and explicit owner acceptance, with any Done record retained until separately selected for pruning.
