---
id: MCP-NOTION-TOOL-009
area: TOOL
title: Reject unsupported dry-run
theme: tool-surface
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-10-04T10:40:05Z
updated_at: 2026-10-04T11:55:29Z
---

## Goal

A caller supplying `--dry-run` to a publication or other mutation command that cannot honour it receives a clear refusal before any local or Notion mutation.

## Context

Origin: [KI-ARCADIA-ECO-004](../../../ki-arcadia-principal/Streams/Roadmap/KI-ARCADIA-ECO-004-route-deferred-mcp-findings.md), reconciled on 2026-10-04. At source commit `4774ab686f8457fcb2ecd3558ec21767a633d7d9`, [the CLI](../../src/cli/cli.ts) parses `--dry-run` and passes it into `runRoots`, but the `publish` branches invoke mutating touch/update operations without consuming it. CLI help currently limits the flag to delete/prune; silently accepting it on publish gives a misleading safety signal.

## Boundary

Investigate and fail closed on explicitly supplied `--dry-run` for unsupported mutating verbs, including `roots publish`. Preserve supported delete/prune previews. Do not implement a new publication preview contract, change MCP tool access policy, or invoke a real Notion workspace.

## Current state

At `8028488`, `main()` in `src/cli/cli.ts` sets `dryRun` from any `--dry-run` argument and passes it to `runNote`, `runTree`, and `runRoots`. Only `note delete`, `tree delete`, `tree prune`, `roots delete`, and `roots prune` consume it. The mutating verbs `note touch|update|move`, `tree touch|update|baseline`, and `roots touch|update|publish|baseline` ignore it and proceed to Notion writes and local `published_at` stamping. `cli.ts` runs `main()` on import and is excluded from coverage, so the dispatcher has no unit-test seam.

## Steps

- [ ] Reproduce the ignored flag with a mocked CLI invocation and synthetic roots; count touch/update calls without any real token or workspace.
- [ ] Enumerate supported resource/verb combinations from the dispatcher. Explicit `--dry-run` on a mutating verb without a preview contract must be rejected before mutation-capable orchestration.
- [ ] Preserve delete/prune previews and existing defaults. Do not silently introduce dry-run semantics for touch/update/publish/baseline or relabel mutating tools read-only.
- [ ] Add fixture tests for unsupported publish, other affected mutation verbs, supported preview verbs, and invocations without the flag; update CLI usage and owning operator guidance.

## Files touched

Expected implementation scope: `src/cli/cli.ts`, a focused CLI test seam or co-located tests, and the existing operator guide owning CLI publication. Preserve the MCP tool surface.

## Verify

Mocked unsupported preview requests invoke zero touch/update or local metadata writes and return a clear non-success outcome. Supported delete/prune previews remain mutation-free. Run focused CLI tests, then the declared test, coverage, typecheck, build and smoke gates and relevant authoring/roadmap audits. No live publication or authentication is part of verification.

## Dependencies / blocks

No dependency. The fix is local to the CLI dispatcher.

## Documentation impact

### Decision Records

None.

### Specifications

None; the CLI usage text states which verbs accept `--dry-run`.

### Guides

Update the user guides that describe CLI publication and dry-run previews.

### Roadmap

No additional roadmap impact.

## Discussion

### Adoption

Adopted from Triage into Next and marked Ready on 2026-10-04 under the owner-delegated estate roadmap push, for exactly the Boundary and Steps above. The dispatcher decision is extracted into a small pure module under `src/cli/` so the refusal can be unit-tested while `cli.ts` remains thin wiring.

### Reproduction before repair

Source inspection establishes the ignored-flag concern; mocked behavioural reproduction is still required before implementation. Exercise the CLI with synthetic roots and mocked touch/update calls, proving that an explicit unsupported `--dry-run` cannot invoke mutation. Define the affected resource/verb combinations from the current dispatcher rather than assuming only publish is affected, then keep the rejection before configuration-dependent work that could mutate state. Preserve supported delete/prune behaviour and their existing defaults.
