# mcp-ki-kb-notion-mirror

Local stdio MCP server that **mirrors** Knowledge Base markdown notes into Notion and records the resulting Notion URL back into each note's YAML frontmatter.

The KB is canonical; the Notion mirror is a derivative read surface for people who don't work in the KB. The server exposes **three resources** of tools, all prefixed `kb_notion_mirror_` (the repo-derived app name):

- **`note`** (`kb_notion_mirror_note_*`) — act on one `kb_path` per call and (for mutations) a Notion `parent` you supply. File-aware but layout-agnostic: no directory walking, no parent resolution.
- **`tree`** (`kb_notion_mirror_tree_*`) — walk a caller-supplied `subtree` folder under the KB root, apply the folder-index hierarchy convention, and attach the subtree's root under a caller-supplied `parent`. Built on the note verbs.
- **`roots`** (`kb_notion_mirror_roots_list`) — pure discovery: list the folders declared as mirror roots (`kb_notion_mirror_root` frontmatter) and the parent each attaches under, so a client drives the `tree` verbs per root without rescanning the KB.

There is **no fixed root folder and no fixed wiki database**. Every mutation takes the `kb_path`/`subtree` and the `parent` it attaches under **per call** — so you can mirror any note or folder under any Notion parent.

A `mcp-ki-kb-notion-mirror-publish` binary ships alongside the server and mirrors the same surface as `<resource> <verb>` subcommands, for driving a publish from a shell instead of a client.

Conforms to the **MCP specification 2026-07-28**.

## Getting started

- **[Install and configure the mirror](docs/guides/user/installation.md)** — the Notion integration, the build, client wiring, and every environment variable.
- **[Mirror a knowledge base](docs/guides/user/mirroring-a-knowledge-base.md)** — the two-phase publish, mirror roots, and the publish CLI.
- **[What the mirror owns](docs/guides/user/what-the-mirror-owns.md)** — the fields it writes into your notes and everything it refuses to touch. Worth reading before the first publish.
- **[Troubleshoot the mirror](docs/guides/user/troubleshooting.md)** — what each failure means and how to recover.
- **[Developer guides](docs/guides/developer/README.md)** — running from source and the delivery gate.

## The verb model

Each resource shares one verb set (the `note`/`tree` columns show where a verb exists):

| Verb | note | tree | What it does |
| --- | :-: | :-: | --- |
| `get` | ✅ | — | Fetch the **live** Notion page state. Pure read. |
| `status` | ✅ | ✅ | Is it mirrored? (frontmatter only, no Notion call). Tree aggregates + orders. |
| `preflight` | ✅ | ✅ | Local readiness check (no Notion call). Tree adds the missing-folder-index check. |
| `touch` | ✅ | ✅ | Create a body-less scaffold so the page URL becomes known for linking.† Idempotent. |
| `update` | ✅ | ✅ | Push the body + resolve `[[wikilinks]]`. **Requires a prior `touch`.** URL preserved. |
| `move` | ✅ | — | Re-parent the page. URL/content unchanged. |
| `delete` | ✅ | ✅ | Archive the page + clear the mirror frontmatter. Destructive — `dry_run` defaults to `true`. |

† The scaffold is a title + icon + banner, with no body — just enough for the page (and its URL) to exist.

**Mirroring is two-phase by design.** There is no `create`: `touch` is how a page comes into existence (a scaffold with a stable URL), then `update` fills the body and turns `[[wikilinks]]` into `@`mentions. Splitting them guarantees every link target exists before any body renders — so the order is always **touch-all → update-all**. [Mirror a knowledge base](docs/guides/user/mirroring-a-knowledge-base.md) walks through it.

## Tools

Fourteen tools across the three resources. `note` (7):

- **`kb_notion_mirror_note_get(kb_path)`** — read. Live Notion page state, or `{ exists: false, reason: "not-mirrored" }`.
- **`kb_notion_mirror_note_status(kb_path)`** — read. `{ published, url?, published_at? }` from frontmatter; no Notion call.
- **`kb_notion_mirror_note_preflight(kb_path)`** — read. `{ ok, issues }`; no Notion call.
- **`kb_notion_mirror_note_touch(kb_path, parent, icon?)`** — write. Scaffold + write URL back. Idempotent → `{ skipped: true, existing_url }` when already mirrored, else `{ url, page_id, published_at }`.
- **`kb_notion_mirror_note_update(kb_path, parent, icon?, link_map?)`** — write. Body push + wikilink resolution; `{ url, page_id, updated_at }`. Errors if not touched first.
- **`kb_notion_mirror_note_move(kb_path, parent)`** — write. `{ moved: true, page_id, previous_parent, new_parent }`.
- **`kb_notion_mirror_note_delete(kb_path, dry_run?)`** — destructive. Archive + clear frontmatter; `dry_run` default `true`.

`tree` (6) — each takes `subtree` and (for mutations) `parent`; `touch`/`update`/`delete` accept an optional `kb_path` to act on just one note's ancestor chain:

- **`kb_notion_mirror_tree_status(subtree)`** / **`_preflight(subtree)`** — read.
- **`kb_notion_mirror_tree_touch(subtree, parent, kb_path?)`** — write. Scaffold every note DFS so all URLs exist.
- **`kb_notion_mirror_tree_update(subtree, parent, kb_path?, link_map?)`** — write. Push bodies; pass `link_map` to resolve **cross-root** wikilinks.
- **`kb_notion_mirror_tree_delete(subtree, kb_path?, dry_run?)`** — destructive.
- **`kb_notion_mirror_tree_prune(subtree, dry_run?)`** — destructive. Git-driven: archive the mirror pages of notes **deleted** under the subtree (a moved note keeps its URL and is never pruned). Requires the KB root to be a git repo; `dry_run` defaults to `true`.

Tree verbs return `{ eligible, outcomes: NoteOutcome[] }` where `NoteOutcome` is `{ kbPath, action: "touch"|"update"|"delete"|"skip"|"plan"|"error", url?, error? }`. `tree_prune` reuses this shape: `plan` (dry-run preview), `delete` (page archived), or `error`.

`roots` (1):

- **`kb_notion_mirror_roots_list()`** — read. `[{ subtree, indexKbPath, parent }]`.

Which of the fourteen are registered depends on the configured access level; the three destructive tools are absent unless you ask for them. See [Install and configure the mirror](docs/guides/user/installation.md).

## Conventions it relies on

Four conventions shape what the tools do. Each is explained, with what to do about it, in the guide named beside it.

- **The folder-index hierarchy.** A folder's index note is `<Folder>/<Folder>.md`, and that note becomes the folder's Notion page; leaves nest under it and sub-folder indexes nest under the grandparent. → [Mirror a knowledge base](docs/guides/user/mirroring-a-knowledge-base.md)
- **Mirror roots.** A folder index carrying `kb_notion_mirror_root` declares itself a root and names the Notion parent it attaches under. Discovery reads it; mutation never does. → [Mirror a knowledge base](docs/guides/user/mirroring-a-knowledge-base.md)
- **Wikilinks.** `[[target]]` and `[[target|display]]` resolve through a `link_map` into Notion `@`mentions; an unresolved target renders as italic text rather than failing. → [Mirror a knowledge base](docs/guides/user/mirroring-a-knowledge-base.md)
- **The mirror frontmatter.** The server writes three fields — `kb_notion_mirror_url`, `kb_notion_mirror_published_at`, `kb_notion_mirror_hash` — and treats everything else in the block as read-only. → [What the mirror owns](docs/guides/user/what-the-mirror-owns.md)

It also maintains one mirror-only artefact: a `Child Pages` `heading_2` above a page's native child links, refreshed automatically and never written back into the KB. Any future "read the mirror back into the KB" path must recognise that sentinel and strip it.

## Documentation

| Root | Question | What it holds |
| --- | --- | --- |
| [`docs/guides/`](docs/guides/README.md) | How | Practical instructions, grouped by audience. |
| [`docs/decisions/`](docs/decisions/) | Why | Decision records for this repository's structural choices. |
| [`docs/roadmap/`](docs/roadmap/) | When | Work items, planned and delivered. `ROADMAP.md` explains the queue. |

## Roadmap

See [ROADMAP.md](./ROADMAP.md) for how forward work is managed, and [`docs/roadmap/`](docs/roadmap/) for the items themselves.
