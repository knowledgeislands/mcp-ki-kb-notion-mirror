# AGENTS.md

## Runtime

Use Bun (>= 1.3) for installation, development, and tests; use `bun run test`, never `bun test`. The published `dist/` MCP runs under Node (>= 22). Keep `NODE_ENV=development` confined to development and inspector commands; production configuration comes from the host environment.

## MCP architecture

Keep configuration injectable: no module-level environment reads or configuration singleton. The server loads configuration once and passes the smallest required slice into registration or implementation functions. Tool modules validate and adapt MCP envelopes only; implementation belongs in `src/main/`. Register every tool through the annotation-driven access gate with an explicit annotation preset.

## Mirror safety

Keep the local Knowledge Base authoritative unless a tool explicitly documents another direction. Constrain local filesystem operations to configured roots with symlink-aware containment, preserve Notion identifier and payload validation, and keep writes idempotent or protected by explicit safe defaults. Tests use isolated fixtures and mocks; live Notion access requires explicit authority.

## Verification

Run `bunx tsc --noEmit`, `bun run test`, `bun run test:coverage`, `bun run build`, `bun run ki:test:smoke`, and the relevant focused `ki repo audit` commands.
