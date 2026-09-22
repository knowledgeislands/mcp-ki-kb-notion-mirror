# Troubleshoot the mirror

Use this guide when a publish fails, refuses, or does less than you expected. Every message the server produces names either the field it could not read or the thing it declined to do, so the message itself is usually the fastest route to the fix.

Nothing here needs unwinding first. `touch` is idempotent, `update` replaces a body in place and keeps the URL, and a failing note never stops the rest of a tree run — so once you have fixed the cause, running the same sequence again is safe.

## Notion refuses the request

Every Notion failure surfaces as `Notion <METHOD> <path> → HTTP <status> (<code>): <message>`, carrying Notion's own status and code.

- **`HTTP 403 (restricted_resource)`** — the integration is not connected to that page or database. This is the single most common failure and it survives having a perfectly valid token, because the page is visible to _you_ in the browser while being invisible to the integration. Open the page or database in Notion → **⋯** → **Connections** → add your integration, then run the command again. Connecting a parent is enough for pages the server creates beneath it.
- **`HTTP 401 (unauthorized)`** — the token is wrong, revoked, or truncated. An internal integration secret starts `ntn_`. Check the value actually reaching the process: a variable in your MCP client's `env` block overrides anything in a `.env` file.
- **`HTTP 404 (object_not_found)`** — the id in `--parent-db`, `--parent-page`, or a `kb_notion_mirror_root` value does not exist, or the integration cannot see it. The two are indistinguishable from outside, so check the connection before assuming the id is wrong.
- **`HTTP 400`** — Notion rejected the payload. The message carries its reason.
- **`timed out after …ms`** — the request did not complete. Run the sequence again; already-published notes will skip.

## The server cannot find your knowledge base

- **`MCP_KI_KB_NOTION_MIRROR_KB_ROOT must be set to use the tree tools.`**, **`… must be set to list roots.`**, **`… — the tree walk needs a root.`**, **`… — prune needs the KB root.`** — the `tree` and `roots` verbs need an absolute knowledge-base root. Only the `note` verbs work without one, and only with absolute `kb_path`s.
- **`MCP_KI_KB_NOTION_MIRROR_TOKEN is required but not set.`** — no token reached the process at all.
- **`kb_path must not be empty`**, **`kb_path must not contain ".." segments: …`**, **`Path escapes the allowed KB root: <candidate> is not under <root>`** — the path left the configured root. Containment is symlink-aware, so a symlink pointing outside the root is refused even though the path looks local.

## A note is refused

- **`Note has no YAML frontmatter; refusing to mirror.`** — the file has no leading `---` block. The server will not invent one, because inventing frontmatter in someone's knowledge base is worse than failing. Add the block and run again.
- **`Note is not mirrored yet — call touch before update.`** — there is no `kb_notion_mirror_url` to update. This is the two-phase model working as intended: publish with touch first, then update. See [Mirror a knowledge base](mirroring-a-knowledge-base.md).
- **`Note is not mirrored — cannot move.`** — same cause, for `note_move`.
- **`Not a discoverable mirror-eligible note: <kb_path>`** — the note is not in the subtree the walk covers. Usually it is excluded (`mirror: exclude` or `kb_notion_mirror_exclude`, possibly inherited from its folder index), starts with a skip prefix (`+` by default), or is in the configured skip list.
- **`Could not extract a 32-hex page id from kb_notion_mirror_url: <value>`** — the recorded URL has been hand-edited or truncated. Delete both mirror fields from that note's frontmatter and touch it again to re-establish the page.

## A tree run is incomplete

- **`Missing folder index: <path>`** from `tree preflight` — a folder has no `<Folder>/<Folder>.md`, so its children have no page to nest under. Add the index note. Always fix preflight findings before publishing.
- **`required parent index not yet published: <path>`** during an update — an ancestor index has no URL yet, because the touch phase did not complete for it. Run the touch phase again across the subtree before updating: the order is always touch-all, then update-all.
- **Notes reported as `skip` with no error** — their content has not changed since the last mirror, so no Notion call was made. That is the hash gate working. Use `--force` to push regardless, or `--verify` to re-push anything edited directly in Notion.

## A move silently does nothing

**`Notion silently ignored the parent change — cannot move between page-id and database-id parents. Use delete + touch instead.`** (and the equivalent message from `update`).

Notion cannot re-parent a page between a page parent and a database parent. `PATCH /v1/pages` accepts the request and ignores it, reporting success. The server reads the parent back to detect this and errors rather than report a move that did not happen. To relocate the page across that boundary, delete it and touch it under the new parent, accepting that the URL changes and every mention of it needs republishing.

## A tool is missing from the client

The access-level gate does not refuse a call — it never registers the tool, so the client cannot see it. At the default `write` level, `kb_notion_mirror_note_delete`, `kb_notion_mirror_tree_delete`, and `kb_notion_mirror_tree_prune` are absent by design. Set `MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL=destructive` and restart the client if you need them.

A tool with missing or partial annotations is treated as destructive rather than assumed safe, so a newly added tool that disappears at `write` level has an annotation problem — see [Definition of done](../developer/definition-of-done.md).

## A setting is rejected at startup

- **`Invalid MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL="…". Allowed: read, write, destructive`**
- **`Invalid MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG="…" — expected one of: off, writes, all.`**
- **`Invalid MCP_KI_KB_NOTION_MIRROR_API_BASE_URL="…" — must be a valid absolute URL.`**
- **`Invalid <VAR>="…" — expected a non-negative integer.`** for the audit-log size and retention settings.

Configuration is validated once at startup, so the server fails immediately rather than partway through a publish.

## Prune will not run

**`prune needs the KB root to be a git repository: <path>`** — orphan detection is git-driven: an orphan is a note that git says has been deleted while its mirror page still exists. Without git history there is no way to distinguish a deleted note from one that was never there, so `prune` declines rather than guess.

## The CLI rejects the command line

These exit with status 2 and print the full usage:

- **`this verb requires --parent-db <id> or --parent-page <id>`** — a mutation needs its Notion parent explicitly. Parents are never read from the environment.
- **`note <verb> requires a <kbPath>`**, **`tree <verb> requires a <subtree>`**, **`Unknown note verb: …`**, **`Unknown resource: …`** — check the spelling against `mcp-ki-kb-notion-mirror-publish` with no arguments, which prints every verb and flag.

Note that `--dry-run` is honoured by `delete` and `prune` only. It is accepted and ignored elsewhere, so it offers no protection on a publish.

## Something changed in Notion and came back

That is the design, not a fault. The knowledge base is canonical and `update` replaces the page body in place, so an edit made in the body of a mirrored page is overwritten on the next push. Native child pages created in Notion are preserved. Run a publish with `--verify` to find pages that have drifted, and see [What the mirror owns](what-the-mirror-owns.md) for the full boundary.

## Still stuck

The audit log at `~/.local/state/mcp-ki-kb-notion-mirror/audit.jsonl` records every write by default, with the tool, its arguments, and its outcome. Set `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG=all` to capture reads too, then reproduce the failure and read the last entries.
