# Definition of done

Use this checklist before presenting a change to this server for review.

## Confirm the change

- Configuration stays injectable: no module-level environment read and no configuration singleton. The server loads configuration once and passes the smallest required slice into registration or implementation.
- Tool modules validate and adapt MCP envelopes only. Implementation belongs in `src/main/`.
- Every tool is registered through the annotation-driven access gate with an explicit annotation preset. An unannotated tool is gated as destructive, so a new tool that vanishes at the default `write` level has an annotation defect, not a gate defect.
- Nothing writes to stdout but protocol traffic. Stdout is the transport.
- The knowledge base stays authoritative unless a tool explicitly documents another direction. Local filesystem operations stay inside the configured root with symlink-aware containment, Notion identifier and payload validation is preserved, and writes stay idempotent or protected by an explicit safe default.
- Frontmatter edits stay line surgery rather than a YAML round-trip, so field order and formatting outside the mirror fields survive unchanged.
- The Notion token reaches no log, error message, or tool output.
- Tests use isolated fixtures and mocks. A live Notion call requires explicit authority.
- A change to the tool surface updates `EXPECTED_TOOLS` in `scripts/smoke.ts` and the three registration sites together.
- Affected documentation moves with the change: the README's verb model and tool inventory, the [user guides](../user/README.md), and any decision record or roadmap item the change resolves.

## Verify the repository

Run the complete gate:

```bash
bunx tsc --noEmit
bun run test
bun run test:coverage
bun run build
bun run ki:test:smoke
bunx @biomejs/biome check
ki repo audit --concise --progress never
git diff --check
```

`bun run test:coverage` enforces 100% line, branch, function, and statement coverage. The exclusions are the entry points and wiring — `src/mcp-server/index.ts`, `src/tools/**/index.ts`, `src/cli/cli.ts` — plus the pure-data `src/utils/annotations.ts` and `src/utils/notion-args.ts`. Everything else, including `src/main/trees` and `src/main/roots`, stays fully covered.

Run the focused audits too when a change touches what they govern, for example `ki repo audit --skill ki-guides --concise --progress never` after editing these guides.

## Prepare review

- Commit one coherent, verified unit with only the intended paths staged.
- Record any check that could not be run, and any follow-up that belongs to someone else, explicitly.
- Do not push, tag, publish, release, or close roadmap work without separate authority.
