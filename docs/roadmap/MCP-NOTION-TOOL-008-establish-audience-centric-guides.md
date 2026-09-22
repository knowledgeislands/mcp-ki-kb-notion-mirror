---
id: MCP-NOTION-TOOL-008
title: Establish audience-centric guides
area: TOOL
theme: tool-surface
horizon: now
status: awaiting-review
blocks: []
blocked_by: []
transferred_from: ki-website
baseline_ref: bffc063e1e0114b46296b4c59b51efbde53c62f4
created_at: 2026-09-21T15:44:00Z
updated_at: 2026-09-22T08:30:00Z
---

## Goal

A reader can find practical instructions for this server grouped by the audience that needs them, and the repository declares `ki-guides` so that grouping is gated rather than conventional.

## Context

`mcp-ki-kb-notion-mirror` has no `docs/guides/` and does not declare `ki-guides`. Its README is unusual among the MCP servers: it opens with conceptual material — the verb model, the folder-index hierarchy convention, two-phase publishing, the frontmatter contract — and only then reaches Setup, environment variables, and running locally. Some of that is a specification rather than a guide, and separating the two is part of the work.

This repository's roadmap ledger reserves only a `TOOL` area. The transferred draft proposed opening an `FND` area alongside it; shaping rejected that, and the reasoning is recorded under Shaping.

KI Website now declares, for every page it publishes under `apps/site/src/guidance/`, the exact upstream document and pinned ref that page was written from, and a `verify:guidance --network` sweep reports the pages whose source has moved. The site intends to derive public guidance for this project from this repository's own guides and cite them at a pinned ref, so the quality and stability of `docs/guides/` here directly determines the quality of what the site can publish.

That is a pull, not an obligation: KI Website derives, it does not own. This repository decides what its guides say and when they change.

Separately, `ki-guides` is being asked to require audience directories under `docs/guides/` rather than permitting a flat collection (`ki-agentic-harness` `KI-HARNESS-GOV-083`). If that lands, this repository's collection has to satisfy it.

## Boundary

Adopted into `Now` by explicit approval, so this is prioritised work rather than intake. It was shaped to `ready` by `ki-plan` before any implementation, and this repository owns its plan and sequencing throughout.

KI Website derives and cites; it does not own this collection and must not be given approval rights over it. Nothing here requires a guide to be written for the website's benefit — if a guide would not serve this repository's own readers, it should not exist.

## Shaping

Shaping settled five questions. Each is a decision, not an option left for implementation.

### Two audiences, not three

`user/` and `developer/`. `operator/` is rejected.

An operator audience exists where running a system is a separate job from using it — a deployed service, a shared instance, a rota. This server is a local stdio process that the reader's own MCP client launches on the reader's own machine, against the reader's own Notion integration and the reader's own knowledge base. The person who creates the token is the person who publishes the notes. Nothing in the repository — no deployment, no hosted endpoint, no shared state beyond one local audit log — is written for anyone else. An `operator/` directory would hold the access level and the audit log, and both belong to the person who configured the token.

Material that looks operational therefore lands in `user/`: the access-level gate and the audit log are configuration choices the installing reader makes, and recovery from a failed publish is recovery for the person who ran it.

### The README loses its instructions, not its model

The README keeps what the server is, the verb model, the tool inventory, and a documentation map. It loses every step-by-step sequence: creating the Notion integration, building, wiring a client, the environment-variable table, the access-level table, running locally, and the publish CLI. Each of those moves once. Where the README needs to keep a concept intelligible it keeps a two-sentence summary and links to the guide that carries the procedure; a summary that a reader could act on is a second copy and is not acceptable.

### The tool inventory stays in the README and becomes no guide

A guide answers how. An inventory answers what, and this one is already a capability catalogue in the entry point where a reader deciding whether to adopt the server will look for it. Copying it under `docs/guides/` would create the drifting second copy the item warns about, and moving it there would push a catalogue into a category that does not hold catalogues.

Drift is real but it is not a placement problem. `scripts/smoke.ts` asserts the exact fourteen-name wire surface against the built server, so a tool added or renamed without updating that list fails `bun run ki:test:smoke`; nothing mechanically checks the README's prose about those tools. Making the inventory generated, or giving it normative force in a specification, is a separate piece of work: this repository does not declare `ki-specs`, and manufacturing a specification corpus to make a guide look complete is exactly what the Guides standard forbids. The gap is named here and routed to `ki-specs`; it is not closed by this item.

### No new area

The item is `MCP-NOTION-TOOL-008`, already issued under the `TOOL` area. Adding an `FND` area to `.ki.toml` for an item that cannot use it would leave a reserved namespace no record occupies. Documentation of a tool's use is part of that tool's surface, which is what `TOOL` and the `tool-surface` theme already cover.

### No release guide

`tools-git-almanac` and `tools-mgit` both carry `developer/releasing.md` because both publish a release a stranger installs. This package is consumed from a local checkout, has no publish script, no release workflow in `.github/workflows/`, and no tap or installer route. Writing a release guide would be documenting a procedure that does not exist. `developer/` gets local development and a definition of done.

## Current state

There is no `docs/guides/` directory and `.ki.toml` declares no `[skills.ki-guides]` block, so nothing gates whether the collection exists or what shape it takes. `docs/` holds `decisions/` and `roadmap/` only. `ki repo audit --concise --progress never` passes at 15 skills, and `ki-guides` will be the sixteenth.

`README.md` is 256 lines and carries both concerns at once. Read against the split above, its sections divide as follows.

- Orientation that stays: the opening description, the three resources, the no-fixed-root statement, the conformance line, the verb model table, the two-phase design statement, and the fourteen-tool inventory.
- Model material that becomes a summary plus a link: the folder-index hierarchy convention, what a `touch`/`update` actually does, the wikilink `link_map`, the child-pages footer and its `Child Pages` sentinel, and the frontmatter contract.
- Instruction that moves out whole: `## Setup` (integration, build, client wiring), `## Environment variables`, `## Access levels`, `## Publish CLI`, `## Running locally`, the two-phase publish procedure block, the roots declaration, and the move/delete caveat.

The failure modes a troubleshooting guide has to cover already exist as literal strings in the source and are quotable rather than invented: `Note is not mirrored yet — call touch before update.`, `Note has no YAML frontmatter; refusing to mirror.`, `Notion silently ignored the parent change`, `Missing folder index:`, `required parent index not yet published:`, `prune needs the KB root to be a git repository:`, `MCP_KI_KB_NOTION_MIRROR_KB_ROOT must be set`, and the `NotionApiError` envelope carrying Notion's own `restricted_resource` / HTTP status.

## Steps

- [x] Create `docs/guides/README.md` as the collection index: scope, a route to each audience, and a "what lives elsewhere" pointer to `docs/decisions/` and `docs/roadmap/`.
- [x] Create `docs/guides/user/README.md` and `docs/guides/developer/README.md` as audience indexes.
- [x] Write `docs/guides/user/installation.md` from the README's `## Setup`, `## Environment variables` and `## Access levels`, adding the confirmation step a reader needs to know it worked.
- [x] Write `docs/guides/user/mirroring-a-knowledge-base.md` from the folder-index convention, the roots declaration, the two-phase publish procedure, the wikilink `link_map`, and the publish CLI.
- [x] Write `docs/guides/user/what-the-mirror-owns.md` from the frontmatter contract, the touch/update mechanics, the child-pages sentinel, and the exclusion rules — stated as what the server writes, what it leaves alone, and what it refuses.
- [x] Write `docs/guides/user/troubleshooting.md` against the failure strings listed under Current state, each with its cause and its recovery.
- [x] Write `docs/guides/developer/local-development.md` from `## Running locally`, including the `.env` precedence order and the inspector route.
- [x] Write `docs/guides/developer/definition-of-done.md` from the gates in `AGENTS.md` and the invariants in `CLAUDE.md`.
- [x] Reduce `README.md` to orientation: delete every moved section, replace the model sections with a summary and a link, and add a documentation map.
- [x] Declare `[skills.ki-guides]` in `.ki.toml`.
- [x] Run the guides and authoring audits, then the full audit, and repair what they report.

## Files touched

- `docs/guides/README.md` (new)
- `docs/guides/user/README.md`, `installation.md`, `mirroring-a-knowledge-base.md`, `what-the-mirror-owns.md`, `troubleshooting.md` (new)
- `docs/guides/developer/README.md`, `local-development.md`, `definition-of-done.md` (new)
- `README.md`
- `.ki.toml`
- `docs/roadmap/MCP-NOTION-TOOL-008-establish-audience-centric-guides.md`

## Verify

- `ki repo audit --skill ki-guides --concise --progress never` passes.
- `ki repo audit --skill ki-authoring --concise --progress never` passes over the new Markdown.
- `ki repo audit --concise --progress never` passes at 16 skills — the 15 it passes today plus `ki-guides`.
- Every relative link in the new collection and in the reduced `README.md` resolves to a file that exists.
- No instruction the README carried today exists in two places: each moved section appears in exactly one guide, and what remains in the README is a summary a reader cannot act on without following the link.
- The code gates are untouched by this item, but `bun run test` and `bun run build` are run once at the end to prove no source file was disturbed.

## Dependencies / blocks

Nothing blocks this. `KI-HARNESS-GOV-083` in `ki-agentic-harness` proposes making audience directories a `ki-guides` requirement: if it lands first this collection satisfies it by construction, and if it lands later this collection already conforms. KI Website intends to derive public guidance from these guides and cite them at a pinned ref, but it derives rather than owns and its schedule does not gate this work.

## Documentation impact

### Decision Records

No decision record is needed. Audience-centric grouping is the house arrangement `ki-guides` already encodes, so adopting it here is conformance rather than a new decision. One becomes owed only if this repository concludes it needs an exception.

### Specifications

No behaviour-level contract changes. The server's tool surface is untouched; this item changes only where its instructions live and who they are written for.

### Guides

This item is entirely guide impact. It creates the collection, its audience directories, and their indexes, and it empties the README of instruction.

### Roadmap

No further roadmap change is expected. If writing the guides exposes behaviour that cannot honestly be explained — an unclear failure mode, a configuration step with no recovery — that is a separate item raised at the time.

## Review

### Delivered

`docs/guides/` now exists as a gated collection with two audience directories, and `.ki.toml` declares `[skills.ki-guides]` so its shape is checked rather than merely conventional. Nine files were created: the collection index, an index per audience, four user guides (`installation.md`, `mirroring-a-knowledge-base.md`, `what-the-mirror-owns.md`, `troubleshooting.md`) and two developer guides (`local-development.md`, `definition-of-done.md`).

`README.md` fell from 256 lines to 92. Every step-by-step sequence it carried moved out exactly once; what remains is orientation — what the server is, the verb model, the fourteen-tool inventory, a four-item summary of the conventions the tools rely on, and a documentation map. The three shaping decisions that constrain the result held: two audiences and no `operator/`, the tool inventory staying in the README as a capability catalogue rather than becoming a guide, and no release guide for a package with no release.

### Summary of changes

- `docs/guides/README.md` — collection index: scope, a route to each audience, and a pointer to `docs/decisions/` and `docs/roadmap/` for the material that is not a guide.
- `docs/guides/user/README.md`, `docs/guides/developer/README.md` — audience indexes, each naming who it is for and routing to its guides.
- `docs/guides/user/installation.md` — the Notion internal integration and the connection step that causes most first-run failures, the build, client wiring with a worked `claude_desktop_config.json`, the full environment-variable table, the access-level table, and a confirmation step that tells a reader the install worked.
- `docs/guides/user/mirroring-a-knowledge-base.md` — the folder-index hierarchy convention, mirror-root declaration, preflight, the touch-all then update-all procedure, wikilink resolution through `link_map`, and the publish CLI including the `--dry-run` asymmetry between the CLI and the MCP tools.
- `docs/guides/user/what-the-mirror-owns.md` — the three frontmatter fields the server writes and when each is written, the fields it reads but never writes, the anchor order line surgery uses, what it refuses to do, and the `Child Pages` sentinel it maintains in Notion only.
- `docs/guides/user/troubleshooting.md` — each failure the server can produce, quoted from source, with its cause and its recovery.
- `docs/guides/developer/local-development.md` — the dev loop, the inspector route, and the `.env` precedence order.
- `docs/guides/developer/definition-of-done.md` — the gates from `AGENTS.md` and the invariants from `CLAUDE.md` stated as a checklist a change must pass.
- `README.md` — reduced to orientation; moved sections deleted, model sections replaced by a summary plus a link, documentation map added.
- `CONTRIBUTING.md` — one link repointed from the now-removed `README.md#setup` anchor to the installation guide.
- `.ki.toml` — `[skills.ki-guides]` declared with no keys, matching the exemplar repositories.

### Verification

- `ki repo audit --skill ki-guides --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-notion-mirror PASS · 1 skill`
- `ki repo audit --skill ki-authoring --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-notion-mirror PASS · 1 skill`
- `ki repo audit --concise --progress never` → `summary: KI REPO AUDIT on mcp-ki-kb-notion-mirror PASS · 16 skills` — the 15 that passed at baseline plus `ki-guides`.
- Every relative link in the collection and in the reduced `README.md` and `CONTRIBUTING.md` was resolved against the filesystem; none is broken.
- Ten marker strings from the moved sections were grepped across `README.md`, `CONTRIBUTING.md` and `docs/guides/`; each appears in exactly one guide, and what the README retains is a summary that cannot be acted on without following its link.
- `bun run build` — exit 0.
- `bun run test` → `Test Files  19 passed (19)` / `Tests  289 passed (289)`, unchanged from the baseline this item started at.

The authoring audit failed once during the work, reporting `[MD049] Emphasis use _ instead of *` in the troubleshooting guide and `[MD051] Link fragment 'setup' not found in './README.md'` in `CONTRIBUTING.md` — the second being real breakage caused by deleting the README's Setup section. Both were fixed and the audit re-run clean.

### Outstanding concerns

`roots publish --dry-run` is a silent no-op. `--dry-run` is honoured by `delete` and `prune` only; elsewhere the CLI accepts it and publishes for real. The guides state this plainly rather than paper over it, but it is a safety defect in the CLI, not in the documentation, and it wants its own item.

Nothing mechanically checks the README's tool inventory. `scripts/smoke.ts` asserts the exact fourteen-name wire surface, so a renamed tool fails `bun run ki:test:smoke`, but the prose beside it can drift silently. Closing that means generating the inventory or giving it normative force in a specification; this repository does not declare `ki-specs`, so the gap is named and routed rather than closed here.

`CONTRIBUTING.md` still carries developer how-to — the dev loop, the conventions, the pre-PR checklist — that now also has a home under `docs/guides/developer/`. That overlap predates this item and was left alone deliberately: `CONTRIBUTING.md` is the file a drive-by contributor opens, and collapsing it into the guides is a separate decision about who that file is for.

### Post-change review

The split that mattered was not user versus developer but instruction versus model. Sorting the README by audience first produced an incoherent result, because its conceptual material serves both audiences and its procedures serve one each; sorting by whether a section tells a reader what to type made the audience assignment fall out by itself.

Writing the troubleshooting guide against literal strings from the source rather than from recollection caught two errors that would otherwise have shipped: a message quoted from memory did not match the source, and the `--dry-run` scope was narrower than the README implied. Any guide that quotes a failure should be written with the source open.

The `operator/` rejection is the decision most likely to be revisited. It holds because this is a local stdio process where the person who creates the token is the person who publishes the notes. If the server ever acquires a hosted or shared mode, that reasoning expires and the access-level and audit-log material moves.

### Mini recap

A repository with no guides and a 256-line README that mixed a specification with a manual now has a gated `docs/guides/` collection, two audiences, nine files, and a 92-line README that orients rather than instructs. All three audits pass, the full audit is up from 15 skills to 16, and the code gates are untouched.

## Discussion

Shaping settles how far the restructure goes, not whether it happens. The prompting question is whether a reader who has never opened this repository can install it, run it, and recover from its common failures without reading source.
