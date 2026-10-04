---
id: MCP-NOTION-TOOL-009
area: TOOL
title: Reject unsupported dry-run
theme: tool-surface
horizon: triage
status: draft
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-10-04T10:40:05Z
updated_at: 2026-10-04T10:40:05Z
---

## Goal

A caller supplying `--dry-run` to a publication or other mutation command that cannot honour it receives a clear refusal before any local or Notion mutation.

## Context

Origin: [KI-ARCADIA-ECO-004](../../../ki-arcadia-principal/Streams/Roadmap/KI-ARCADIA-ECO-004-route-deferred-mcp-findings.md), reconciled on 2026-10-04. At source commit `4774ab686f8457fcb2ecd3558ec21767a633d7d9`, [the CLI](../../src/cli/cli.ts) parses `--dry-run` and passes it into `runRoots`, but the `publish` branches invoke mutating touch/update operations without consuming it. CLI help currently limits the flag to delete/prune; silently accepting it on publish gives a misleading safety signal.

## Boundary

Investigate and fail closed on explicitly supplied `--dry-run` for unsupported mutating verbs, including `roots publish`. Preserve supported delete/prune previews. Do not implement a new publication preview contract, change MCP tool access policy, or invoke a real Notion workspace. This is unadopted intake, not implementation authority.

## Discussion

### Reproduction before repair

Source inspection establishes the ignored-flag concern; mocked behavioural reproduction is still required before implementation. Exercise the CLI with synthetic roots and mocked touch/update calls, proving that an explicit unsupported `--dry-run` cannot invoke mutation. Define the affected resource/verb combinations from the current dispatcher rather than assuming only publish is affected, then keep the rejection before configuration-dependent work that could mutate state. Preserve supported delete/prune behaviour and their existing defaults.
