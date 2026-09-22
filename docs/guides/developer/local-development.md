# Local development

Use this guide when changing the server's source. It covers running it from TypeScript without building, how it finds your credentials, and how to exercise the wire surface by hand.

Use Bun (>= 1.3) for installing, running, and testing. The published `dist/` runs under Node (>= 22).

## Run from source

```bash
bun run ki:server:mcp:dev      # bun --watch, runs the server from TS source
bun run ki:server:mcp:inspect  # MCP Inspector against the TS source
```

Both set `NODE_ENV=development`. Keep `NODE_ENV=development` confined to these commands: production configuration comes from the host environment, not from a mode flag.

`bun run` with no arguments lists every script. Use `bun run test`, never `bun test` — the latter invokes Bun's own runner instead of vitest.

## How the environment is loaded

The server hydrates `process.env` from the package root, highest precedence first:

1. `.env.local` — loaded in every mode.
2. `.env.${NODE_ENV}` — so `.env.development` under the commands above.
3. `.env`.

A variable already present in the environment always wins over all three, which is why an MCP client's `env` block is authoritative for a client-launched server and why exporting a variable in your shell beats the file you just edited.

To get started, copy [`.env.example`](../../../.env.example) to `.env.development`, or to `.env.local` if you want it loaded in every mode, and fill in your Notion token. [Install and configure the mirror](../user/installation.md) documents every variable.

The publish CLI loads `.env.local` and then `.env` from the package root, and does not read `.env.${NODE_ENV}`.

## Drive the server by hand

`bun run ki:server:mcp:inspect` opens the MCP Inspector against the TypeScript source, which is the quickest way to see the registered tool list, call a verb with real arguments, and read the exact envelope a client receives.

Two things are worth checking there rather than in a unit test: that a tool appears at the access level you expect, since the gate omits a tool rather than refusing its call; and that nothing writes to stdout except protocol traffic, since stdout is the transport and any stray `console.log` corrupts the stream.

The built server has its own end-to-end check:

```bash
bun run ki:test:smoke
```

This builds, boots the server over stdio, and asserts the fourteen-tool wire surface. Adding or renaming a tool means updating `EXPECTED_TOOLS` in `scripts/smoke.ts` to match the three registration sites, and the smoke test failing is how you find out you forgot.

## Where things live

- `src/mcp-server/` — the stdio entry point. It loads configuration once and passes the smallest useful slice into registration.
- `src/tools/{note,tree,roots}/` — MCP envelope validation and adaptation only. Every tool registers through the annotation-driven access gate with an explicit annotation preset.
- `src/main/` — the implementation: notes, trees, roots, and the Notion client. Behaviour belongs here, not in a tool module.
- `src/cli/` — the `mcp-ki-kb-notion-mirror-publish` binary, which mirrors the tool surface as `<resource> <verb>` subcommands.
- `src/utils/` — the access gate, audit log, atomic writes, path containment, and result envelopes.

Tests are co-located with the code they cover. Fixtures are isolated and Notion is mocked; a live Notion call from a test needs explicit authority.

## Verify

Before handing a change over, run the gate in [Definition of done](definition-of-done.md). While iterating, `bun run test:watch` and `bunx tsc --noEmit` are the fast loop.
