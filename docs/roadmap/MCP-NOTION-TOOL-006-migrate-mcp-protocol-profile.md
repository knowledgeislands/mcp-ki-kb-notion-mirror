---
id: MCP-NOTION-TOOL-006
area: TOOL
title: Migrate MCP protocol profile
theme: tool-surface
horizon: now
status: ready
blocks: []
blocked_by: []
baseline_ref: null
created_at: 2026-09-02T01:12:46Z
updated_at: 2026-09-22T06:58:00Z
---

## Goal

Move mcp-ki-kb-notion-mirror to the supported MCP 2026-07-28 server profile without breaking its existing tool surface or legacy clients.

## Context

The Harness KI-HARNESS-GOV-006 rollout now derives protocol applicability from the runtime dependency. This repository still declares @modelcontextprotocol/sdk major 1 and remains conformant to the legacy 2025-11-25 profile. The accepted mcp-git-audit pilot proves the modern package family, per-connection stdio factory, SDK-owned discovery, complete result envelopes, smoke boundary, and deliberate compatibility fallback.

## Boundary

Do not change the public tool contract, remove legacy compatibility without evidence, or treat the Harness rollout as receiver acceptance. This record captures receiver-owned migration work only; prioritisation, implementation, verification, acceptance, release, and publication remain in this repository.

The fourteen tool names, their input and output schemas, their annotations, and the access-level gate stay exactly as they are. The Notion client, note and tree domain logic, frontmatter contract, audit log, and CLI are out of scope. Sourcing the advertised server version from package.json is deliberately excluded: it is a separate tidy-up, not part of the profile move.

## Shaping

Adopt the accepted pilot as the first comparison baseline: move to the v2 server package family, replace the legacy stdio transport with a per-connection serveStdio factory, add resultType: "complete" to synchronous result helpers, retain deliberate legacy fallback, and prove SDK-owned discovery through the repository smoke boundary.

The dependency delta, entry-point change, compatibility boundary, and smoke assertions below were reviewed against this repository's current source on 2026-09-22, which discharges the promotion condition this record carried at Soon.

## Current state

The server is a conformant legacy 2025-11-25 implementation and every gate passes in that shape: `bun run build`, `bun run test` (19 files, 288 tests), `bun run ki:test:smoke` (14 tools listed) and `ki repo audit` (PASS, 15 skills). That passing legacy audit is the immutable baseline this migration must not regress.

The legacy surface is narrow, which is what makes the move tractable:

- `package.json` declares `@modelcontextprotocol/sdk` `^1.30.0` and pins `zod` to the exact `4.4.3`, with `.ki.toml` carrying a `dependency_holds` entry explaining that zod 4.5.4 and later break the SDK 1.30.0 schema types.
- `src/mcp-server/index.ts` constructs one module-level `McpServer`, registers the three tool groups against it, and connects a single `StdioServerTransport` in an async `main()`.
- `src/utils/access-level.ts` imports `McpServer` from `@modelcontextprotocol/sdk/server/mcp.js` and `ToolAnnotations` from `@modelcontextprotocol/sdk/types.js`; the three `src/tools/*/index.ts` files import `McpServer` as a type only.
- `src/utils/results.ts` returns envelopes with no `resultType` discriminator, and `src/utils/results.test.ts` asserts those exact shapes.
- `scripts/smoke.ts` drives the v1 `Client` and `StdioClientTransport`, and asserts only the tool-name set and schema presence. It makes no discovery, protocol-era, result-envelope or legacy-fallback assertion.
- `README.md` states that the server conforms to the MCP specification 2025-11-25.

`@modelcontextprotocol/server`, `@modelcontextprotocol/client` and `@modelcontextprotocol/core` 2.0.0 are already resolved in `bun.lock` as transitive dependencies of `mcporter`, so the package family is available without a new resolution risk. `src/generated/client.ts` contains no MCP SDK import, so the generated client needs no change.

## Steps

- [ ] Swap the server dependency in `package.json`: drop `@modelcontextprotocol/sdk`, add `@modelcontextprotocol/server` `2.0.0` as a dependency and `@modelcontextprotocol/client` `2.0.0` as a devDependency, and relax `zod` from the exact `4.4.3` to `^4.6.5` now that the pin's cause is removed. Run `bun install` and confirm the lockfile updates.
- [ ] Remove the now-obsolete zod `dependency_holds` entry from `.ki.toml`.
- [ ] Repoint the four type-only import sites (`src/utils/access-level.ts`, `src/tools/note/index.ts`, `src/tools/tree/index.ts`, `src/tools/roots/index.ts`) at `@modelcontextprotocol/server`, taking `ToolAnnotations` from the same package root.
- [ ] Add `resultType: 'complete' as const` to both helpers in `src/utils/results.ts` and update `src/utils/results.test.ts` to assert the discriminator on both the success and the error envelope.
- [ ] Rewrite `src/mcp-server/index.ts` as a per-connection `createServer(): McpServer` factory handed to `serveStdio`, with `legacy: 'serve'` for the deliberate compatibility fallback and an `onerror` reporter; keep the existing startup stderr banner, the access-gated `registerTool` wiring, and the registration order, and close the returned handle on SIGINT.
- [ ] Move `scripts/smoke.ts` to the v2 `@modelcontextprotocol/client` and add the receiver-specific boundary assertions: modern protocol era, negotiated `2026-07-28`, a `complete` `server/discover` result whose `serverInfo` name is `mcp-ki-kb-notion-mirror`, the unchanged fourteen-tool surface with schemas, a successful `kb_notion_mirror_roots_list` call returning a non-error envelope, a malformed-argument call returning an error envelope, and a second legacy-era client that still sees all fourteen tools.
- [ ] Update the `README.md` conformance line from 2025-11-25 to 2026-07-28.
- [ ] Run every gate and record the outcomes, then confirm `ki repo audit` still passes at 15 skills with PROTO-1 now selecting the modern profile.

## Files touched

- `package.json`, `bun.lock`
- `.ki.toml`
- `src/mcp-server/index.ts`
- `src/utils/access-level.ts`, `src/utils/results.ts`, `src/utils/results.test.ts`
- `src/tools/note/index.ts`, `src/tools/tree/index.ts`, `src/tools/roots/index.ts`
- `scripts/smoke.ts`
- `README.md`
- `docs/roadmap/MCP-NOTION-TOOL-006-migrate-mcp-protocol-profile.md`

## Verify

- `bun install` succeeds and `bun run build` compiles with no TypeScript error.
- `bun run test` passes with no fewer than the baseline 19 files and 288 tests.
- `bun run test:coverage` passes.
- `bun run ki:test:smoke` passes and prints the modern-discovery, legacy-fallback and fourteen-tool assertions.
- `ki repo audit --concise --progress never` reports PASS across 15 skills.

## Dependencies / blocks

Nothing blocks this item and it blocks nothing. `blocked_by` is empty because the modern package family is already resolved locally and the ki-repo-mcp profile rubric already accepts both eras; nothing has to be built first.

MCP-NOTION-TOOL-007 reviews the conformance audit and MCP-NOTION-TOOL-008 establishes audience-centric guides. Neither is a build-order dependency, but both read the protocol profile, so each should be re-read against the modern profile after this lands rather than before.

## Documentation impact

### Decision Records

No new Decision Record. The rationale for a package-derived protocol profile is already held by the ki-repo-mcp standard and the Harness KI-HARNESS-GOV-006 rollout; this repository is a receiver applying an existing decision, not making one.

### Specifications

No behaviour-level contract changes. The fourteen tool names, schemas, annotations and error semantics are unchanged; the wire envelope gains a `resultType` discriminator required by the protocol itself, not by this repository's contract.

### Guides

`README.md` states the conformed specification revision and must move from 2025-11-25 to 2026-07-28. No other human guidance describes the transport or the result envelope.

### Roadmap

No new roadmap item is expected. MCP-NOTION-TOOL-007 and MCP-NOTION-TOOL-008 should be re-read against the modern profile once this is accepted; if that re-reading surfaces real work, it is captured then rather than pre-empted now.

## Discussion

### Source evidence

The portable profile and rubric live in ki-repo-mcp; the accepted mcp-git-audit migration is implementation evidence, not a patch to copy mechanically. Receiver-specific authentication, configuration, generated client, and tool-envelope differences remain local design inputs.

The differences that matter here are that this repository has a second binary (`dist/cli/cli.js`) outside the MCP entry point, a required `MCP_KI_KB_NOTION_MIRROR_TOKEN` that the smoke test satisfies with a placeholder, and a default access level of `write` rather than `read`. None of them touches the protocol boundary, so the pilot's entry-point and result-helper shape transfers directly while its configuration and smoke environment do not.

### Compatibility boundary

`legacy: 'serve'` is a deliberate retention, not a default accepted by omission. Clients in this fleet are still mid-migration, and the standard explicitly permits a modern-profile server to keep legacy fallback while that is true. The smoke test therefore asserts the fallback rather than merely tolerating it: a second client connects without modern version negotiation and must still see the full fourteen-tool surface. Removing the fallback later needs its own evidence that no consumer opens a 2025-era connection.

### Zod pin

The exact `zod` pin and its `.ki.toml` hold exist only because @modelcontextprotocol/sdk 1.30.0 could not accept zod 4.5.4 or later. Removing the SDK removes the cause, so leaving the pin in place would leave a stale explanation in governance that a future reader would have to disprove. The modern packages require `zod` `^4.2.0`, and the accepted pilot runs `^4.6.5`, so aligning on that range is both permitted and consistent.

### Acceptance boundary

The modern profile is not claimed until this repository's package, result helpers, stdio entry point, focused tests, live smoke, and ki-repo-mcp audit agree. A passing legacy audit before migration remains expected.

That legacy baseline was taken before any change on 2026-09-22: build clean, 288 tests passing across 19 files, smoke listing 14 tools, and `ki repo audit` PASS at 15 skills.

### Selection

This record was promoted from Soon to Now under an explicit human instruction to plan and deliver it in this session. The promotion condition recorded at Soon — reviewing the dependency delta, entry-point change, compatibility boundary, and receiver-specific smoke assertions against current source — is discharged by the Current state and Steps sections above rather than assumed.
