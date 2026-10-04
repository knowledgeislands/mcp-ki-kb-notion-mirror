---
id: MCP-NOTION-TOOL-009
area: TOOL
title: Reject unsupported dry-run
theme: tool-surface
horizon: next
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: d9447cfd4386dcaa48e4962774f2390a40b423d9
created_at: 2026-10-04T10:40:05Z
updated_at: 2026-10-04T12:02:07Z
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

- [x] Reproduce the ignored flag with a mocked CLI invocation and synthetic roots; count touch/update calls without any real token or workspace.
- [x] Enumerate supported resource/verb combinations from the dispatcher. Explicit `--dry-run` on a mutating verb without a preview contract must be rejected before mutation-capable orchestration.
- [x] Preserve delete/prune previews and existing defaults. Do not silently introduce dry-run semantics for touch/update/publish/baseline or relabel mutating tools read-only.
- [x] Add fixture tests for unsupported publish, other affected mutation verbs, supported preview verbs, and invocations without the flag; update CLI usage and owning operator guidance.

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

## Review

### Delivered

The publish CLI now refuses `--dry-run` on every verb that writes but has no preview (`note touch|update|move`, `tree touch|update|baseline`, `roots touch|update|publish|baseline`). The refusal happens in `main()` immediately after argument parsing, before configuration loading, Notion client construction or any orchestration, and exits with status 2 and a message stating that nothing was changed. `delete`/`prune` previews, read-only verbs and invocations without the flag are unchanged. The MCP tool surface is untouched.

### Change Summary

- `src/cli/dry-run.ts` (new): the explicit preview and no-preview verb tables and `unsupportedDryRunError(resource, verb, dryRun)`.
- `src/cli/cli.ts`: calls the guard before dispatch; usage text states where the flag is refused.
- `src/cli/dry-run.test.ts` (new): refused verbs, accepted previews, read-only verbs, unknown verbs and no-flag cases.
- `src/cli/cli.test.ts` (new): child-process tests of the real CLI with a dummy token and a non-existent KB root, asserting exit 2, the refusal message and empty stdout for `roots publish|update`, `tree baseline` and `note touch`, and that `roots prune --dry-run` is not refused.
- `docs/guides/user/mirroring-a-knowledge-base.md` and `docs/guides/user/troubleshooting.md`: replace the "accepted and silently ignored" warning with the refusal behaviour.

### Verification

- `bunx vitest run src/cli`: 29 tests pass.
- `bun run test:coverage`: 24 files, 356 tests pass; statements, branches, functions and lines 100%.
- `bunx tsc --noEmit -p .`, `bun run build`, `bun run ki:test:smoke` (15 tools, valid envelope): pass.
- `bunx biome check .`: 11 warnings and 1 info, all pre-existing and unchanged by this work.
- `bunx knip`: only the pre-existing configuration hints.
- `ki repo audit --repo .`: no FAIL.
- No live Notion call, token or workspace was used; the subprocess tests pin dummy environment values that the CLI's optional `.env.local` loading never overrides, so a regression would fail on configuration rather than reach Notion.

### Outstanding concerns

- Verb tables are maintained by hand beside the dispatcher; a new mutating verb must be added to `MUTATING_WITHOUT_PREVIEW`, otherwise the flag would again be ignored for it. The co-located tests make the current set explicit.
- Unknown resource/verb combinations with `--dry-run` fall through to the existing dispatcher error, which already exits 2 with usage.
- Users of the CLI need a release to receive the change.

### Post-change review

The guard is a pure function with no I/O, invoked once before any side effect, so the zero-mutation property holds by construction rather than by mocking each orchestrator. Exit status 2 matches the CLI's existing convention for a rejected command line.

### Mini recap

`--dry-run` can no longer turn into a real publish: the CLI rejects it, with nothing changed, on every verb that lacks a preview, while existing previews keep working.

## Discussion

### Adoption

Adopted from Triage into Next and marked Ready on 2026-10-04 under the owner-delegated estate roadmap push, for exactly the Boundary and Steps above. The dispatcher decision is extracted into a small pure module under `src/cli/` so the refusal can be unit-tested while `cli.ts` remains thin wiring.

### Reproduction before repair

Source inspection establishes the ignored-flag concern; mocked behavioural reproduction is still required before implementation. Exercise the CLI with synthetic roots and mocked touch/update calls, proving that an explicit unsupported `--dry-run` cannot invoke mutation. Define the affected resource/verb combinations from the current dispatcher rather than assuming only publish is affected, then keep the rejection before configuration-dependent work that could mutate state. Preserve supported delete/prune behaviour and their existing defaults.
