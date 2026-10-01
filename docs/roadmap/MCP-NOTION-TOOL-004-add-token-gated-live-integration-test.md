---
id: MCP-NOTION-TOOL-004
area: TOOL
title: Add gated integration test
theme: tool-surface
horizon: next
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-07-29T00:37:05Z
updated_at: 2026-10-01T19:30:08Z
---

## Goal

Maintainers can deliberately run an isolated live Notion smoke suite, while ordinary tests remain credential-free and make no live requests.

## Context

The normal suite mocks Notion and maintains complete coverage of product code. A live suite would detect drift in the page lifecycle and cross-parent-type move behaviour that mocks cannot establish. Merely finding a token in the host environment must never enable live writes.

## Boundary

Implement a separately invoked, skipped-by-default suite and its safety-gate tests. Live execution requires a later explicit operator invocation with disposable fixture parents; this planning and implementation scope does not authorise a live run or use of existing Knowledge Base notes.

## Current state

[vitest.config.ts](../../vitest.config.ts) discovers `src/**/*.test.ts` for normal tests. [The Notion client](../../src/main/notion-client/index.ts) supports the page operations needed for fixtures, and `moveNote`/`updateNote` verify cross-parent-type silent failures. No live suite or explicit live command currently exists. Developer guidance already requires explicit authority for a real Notion call.

## Steps

- [ ] Add a dedicated live-test configuration and `test:live` script. Exclude `*.live.test.ts` from the normal unit/coverage configuration so a developer's environment cannot silently change those commands into network tests.
- [ ] Require an explicit opt-in flag, a dedicated test token, and caller-supplied disposable page and database parent IDs. Validate the complete input before creating clients or fixtures; missing prerequisites make the explicit live command fail clearly with zero HTTP requests. Ordinary suites must not inspect production token values.
- [ ] Build synthetic Greek local fixtures in an OS temporary directory and create uniquely named remote pages only beneath the nominated disposable parents. Track every created page ID in memory for cleanup; never enumerate a workspace or modify/archive either caller-supplied parent.
- [ ] Exercise touch, update, status/get, and delete against a created test note and test cross-parent-type move detection on a created page. Record whether Notion rejects the move, silently ignores it and is caught, or now supports it; only report success when observed postconditions and the client result agree.
- [ ] Use try/finally cleanup to archive only pages created in this run, remove local temporary files, and report cleanup failures with residual page IDs but no token, request headers, or note content. Do not let cleanup hide the original test failure.
- [ ] Add offline tests for incomplete gate inputs, opt-in absence, fixture ownership, partial setup failure, and cleanup failure using mocks. Document invocation, fixture-parent prerequisites, expected skipped/default behaviour, and explicit operator responsibility for each live run.

## Files touched

- [vitest.config.ts](../../vitest.config.ts), a dedicated `vitest.live.config.ts`, and [package.json](../../package.json).
- A focused `src/main/notes/*.live.test.ts` suite plus a test-only fixture/gate helper with offline tests, kept outside product runtime exports.
- [The local development guide](../guides/developer/local-development.md), [definition of done](../guides/developer/definition-of-done.md), and [README.md](../../README.md) only for navigation to the documented opt-in command.

## Verify

1. Run `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage`, `bun run build`, and `bun run ki:test:smoke` sequentially; maintain product coverage and the current fourteen-tool surface, or the contemporaneous fifteen-tool surface if the separately approved diff item has landed.
2. In an isolated child process with HTTP disabled, ordinary tests and coverage never load the live suite, including when dummy production-looking environment variables exist. The explicit live command with absent/incomplete opt-in exits before any network request.
3. Offline fixture tests prove cleanup touches only IDs created in the run and preserves both the original failure and any cleanup failure. No product token or real KB path is required for these checks.
4. Run focused `ki-engineering`, `ki-repo-mcp`, and `ki-work-roadmap` audits. Record the live API suite as not run until separately invoked with explicit operator authority; implementation readiness is not evidence that Notion behaviour has been validated live.

## Dependencies / blocks

No build dependency on image upload or diff. Implement and verify the gate and harness offline. A real live run additionally needs disposable workspace parents, a dedicated token, and explicit authority; those are execution prerequisites for the live command rather than blockers to safely implementing the skipped-by-default harness.

## Documentation impact

### Decision Records

No architectural policy change; retain the existing explicit-authority boundary for live Notion access.

### Specifications

The test gate and fixture cleanup contract are exercised by offline tests; no MCP behaviour or schema changes.

### Guides

Document setup, explicit invocation, cleanup limits, and the distinction between offline validation and a live result in developer guidance.

### Roadmap

This item delivers the test harness; later live runs record actual evidence and do not imply acceptance of other product items.

## Discussion

### Readiness review

An ambient production token is insufficient authority. The dedicated command, explicit gate, and disposable fixture parents make the harness implementable and verifiable offline; no live run has been performed or authorised by this review.
