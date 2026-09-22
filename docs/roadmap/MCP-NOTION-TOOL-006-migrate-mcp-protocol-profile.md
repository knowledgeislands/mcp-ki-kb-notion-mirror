---
id: MCP-NOTION-TOOL-006
area: TOOL
title: Migrate MCP protocol profile
theme: tool-surface
horizon: now
status: awaiting-review
blocks: []
blocked_by: []
baseline_ref: 94dedce0352df6865fa3bc5dd3e397203b9ea3f1
created_at: 2026-09-02T01:12:46Z
updated_at: 2026-09-22T07:02:00Z
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

- [x] Swap the server dependency in `package.json`: drop `@modelcontextprotocol/sdk`, add `@modelcontextprotocol/server` `2.0.0` as a dependency and `@modelcontextprotocol/client` `2.0.0` as a devDependency, and relax `zod` from the exact `4.4.3` to `^4.6.5` now that the pin's cause is removed. Run `bun install` and confirm the lockfile updates.
- [x] Remove the now-obsolete zod `dependency_holds` entry from `.ki.toml`.
- [x] Repoint the four type-only import sites (`src/utils/access-level.ts`, `src/tools/note/index.ts`, `src/tools/tree/index.ts`, `src/tools/roots/index.ts`) at `@modelcontextprotocol/server`, taking `ToolAnnotations` from the same package root.
- [x] Add `resultType: 'complete' as const` to both helpers in `src/utils/results.ts` and update `src/utils/results.test.ts` to assert the discriminator on both the success and the error envelope.
- [x] Rewrite `src/mcp-server/index.ts` as a per-connection `createServer(): McpServer` factory handed to `serveStdio`, with `legacy: 'serve'` for the deliberate compatibility fallback and an `onerror` reporter; keep the existing startup stderr banner, the access-gated `registerTool` wiring, and the registration order, and close the returned handle on SIGINT.
- [x] Move `scripts/smoke.ts` to the v2 `@modelcontextprotocol/client` and add the receiver-specific boundary assertions: modern protocol era, negotiated `2026-07-28`, a `complete` `server/discover` result whose `serverInfo` name is `mcp-ki-kb-notion-mirror`, the unchanged fourteen-tool surface with schemas, a successful `kb_notion_mirror_roots_list` call returning a non-error envelope, a malformed-argument call returning an error envelope, and a second legacy-era client that still sees all fourteen tools.
- [x] Update the `README.md` conformance line from 2025-11-25 to 2026-07-28.
- [x] Run every gate and record the outcomes, then confirm `ki repo audit` still passes at 15 skills with PROTO-1 now selecting the modern profile.

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

## Review

### Delivered

The approved boundary held exactly: the modern MCP 2026-07-28 server profile is adopted, the fourteen public tool names, input and output schemas, annotations and access-level gate are untouched, and the deliberate legacy fallback is retained rather than dropped. The excluded areas stayed excluded — no change to the Notion client, the note or tree domain logic, the frontmatter contract, the audit log or the CLI, and the advertised server version is still the literal in the entry point rather than being sourced from package.json.

Immutable baseline: `94dedce0352df6865fa3bc5dd3e397203b9ea3f1`. That baseline was itself verified green on the legacy profile before any change — build clean, 288 tests across 19 files, smoke listing 14 tools, `ki repo audit` PASS at 15 skills — which is the "passing legacy audit before migration" this record required.

Resulting evidence: `c5fa84edabb9b6989c381554e88f369467c72caf`.

### Summary of changes

- `package.json`, `bun.lock` — `@modelcontextprotocol/sdk` `^1.30.0` replaced by `@modelcontextprotocol/server` `2.0.0` as a dependency; `@modelcontextprotocol/client` `2.0.0` added as a devDependency for the smoke boundary; `zod` relaxed from the exact `4.4.3` to `^4.6.5` and resolved at 4.6.5.
- `.ki.toml` — the `ki-engineering` `dependency_holds` entry explaining the zod pin is removed, because the v1 SDK that caused it is gone.
- `src/mcp-server/index.ts` — the module-level `McpServer` plus `StdioServerTransport` and `main()` are replaced by a per-connection `createServer()` factory handed to `serveStdio` with `legacy: 'serve'` and an `onerror` reporter, closing the returned handle on SIGINT. The startup stderr banner, the access-gated `registerTool` wiring and the registration order are unchanged.
- `src/utils/results.ts` — both helpers now return `resultType: 'complete'`; `src/utils/results.test.ts` asserts it on the success and both error envelopes, and adds a `structuredContent` assertion.
- `src/utils/access-level.ts`, `src/tools/{note,tree,roots}/index.ts` — type-only imports repointed at `@modelcontextprotocol/server`, with `ToolAnnotations` now coming from the same package root.
- `scripts/smoke.ts` — moved to the v2 client and given the receiver-specific boundary assertions listed under Verification below, against a fresh empty temporary KB root rather than the shared OS temp directory.
- `README.md` — the conformance line moves from 2025-11-25 to 2026-07-28.

Two material decisions, both already reasoned in Discussion: the zod pin was released rather than carried forward, because removing the SDK removed its only cause; and `legacy: 'serve'` was kept and made assertable rather than left implicit.

One thing worth naming for the reviewer: `kb_notion_mirror_roots_list` declares an array `outputSchema`, so its `structuredContent` is an array rather than an object. The v2 client accepted it on a live round-trip, so this is recorded as observed behaviour, not as an assumed compatibility.

No approved deviation from the plan was needed; every planned step was executed as written.

### Verification

Each gate was run from the repository root after integration.

- `bun install` — pass. "Saved lockfile ... + zod@4.6.5 ... 3 packages installed".
- `bun run build` — pass. `tsc -p tsconfig.build.json` completed with no diagnostic output.
- `bunx tsc -p tsconfig.json --noEmit` — pass, with no output. Run in addition to the declared gates because the build project excludes tests and `scripts/`, so it is the only check that typechecks the rewritten smoke script.
- `bun run test` — pass. "Test Files 19 passed (19) / Tests 289 passed (289)", up one from the 288-test baseline.
- `bun run test:coverage` — pass. "Test Files 19 passed (19) / Tests 289 passed (289)", Statements 100% (1072/1072), Branches 100% (532/532), Functions 100% (183/183), Lines 100% (899/899).
- `bun run ki:test:smoke` — pass. "✓ smoke passed: modern discovery, legacy fallback, 14 tools, valid result envelope". It asserts the modern protocol era, a negotiated `2026-07-28`, a `complete` `server/discover` result advertising `2026-07-28` with `serverInfo.name` `mcp-ki-kb-notion-mirror`, the fourteen-tool surface with every `inputSchema` present, a non-error envelope from a live `kb_notion_mirror_roots_list` call, an error envelope from a malformed `kb_notion_mirror_note_status` call, and a second legacy-era client that still sees all fourteen tools.
- `bunx @biomejs/biome check` — pass. "Checked 57 files in 48ms. No fixes applied. Found 1 info." The single info is the pre-existing `biome.json` schema-version mismatch (2.5.12 declared against CLI 2.5.14), unrelated to this change.
- `bunx knip` — pass. Only the five pre-existing configuration hints, no unused files, exports or dependencies.
- `ki repo audit --concise --progress never` — pass. "summary: KI REPO AUDIT on mcp-ki-kb-notion-mirror PASS · 15 skills", matching the baseline count exactly.

The tests and smoke were re-run after the `lint-staged` formatting pass on commit, and both still pass.

### Outstanding concerns

None blocking.

Two observations for the reviewer rather than defects. First, `@modelcontextprotocol/sdk` 1.30.0 is still present in `node_modules` as a transitive dependency of `mcporter`; nothing in `src/` or `scripts/` imports it, and the profile rubric reads `package.json` rather than the installed tree, so this does not weaken the claim. Second, `CHANGELOG.md` was deliberately not touched: it currently records only a `[1.0.0]` "Initial release." against a `0.9.0` package, so adding an entry would have meant inventing a release convention this repository has not established. That is a separate call for the reviewer.

### Post-change review

The Goal is met. The repository now selects exactly one supported profile, and it is the modern one: no legacy SDK import or `StdioServerTransport` survives in `src/`, `serveStdio` is the boundary, and both result helpers carry the discriminator. Scope held with no expansion; every file changed appears in the planned Files touched list.

Regression risk is low and well bounded. The tool contract is provably unchanged because the smoke test compares the live wire surface against the same fourteen-name list it used before, and the access gate and audit-log wrapper were not modified — the wrapper keys on `isError`, which is untouched by the added discriminator. The one genuinely new runtime behaviour is per-connection instantiation: tools are now registered once per connection instead of once per process. That is the profile's intent, registration is pure, and both the modern and the legacy client in the smoke test exercise it.

The residual risk this repository cannot close locally is client-side: a consumer pinned to a v1 client library is covered by the retained fallback, which is asserted, but no assertion here can speak for a host that negotiates in some third way. That is an acceptance judgement rather than a verification gap.

Acceptance readiness: ready for human review. No push, release or publication has been performed.

### Mini recap

Delivered the protocol-profile migration for MCP-NOTION-TOOL-006 from baseline `94dedce` in one implementation commit, `c5fa84e`. Every declared gate plus three additional checks pass, and `ki repo audit` still reports PASS at 15 skills.

Proposed learning routes, none promoted automatically:

- The smoke boundary is where this migration earned its confidence. The source audit deliberately cannot see discovery, era negotiation or envelope validity, so the pattern of asserting them in a live round-trip is the transferable part for the remaining legacy siblings.
- A dependency hold is a claim with an owner and an expiry. This one outlived its cause by exactly as long as it took someone to notice; holds are worth re-reading whenever the dependency they constrain is replaced.
- Whether this fleet keeps `legacy: 'serve'` is a fleet-level question, not a per-repository one. It deserves a single decision once enough siblings have migrated, rather than five independent judgements.

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
