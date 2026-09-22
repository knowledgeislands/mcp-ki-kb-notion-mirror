# What the mirror owns

Read this before pointing the server at a knowledge base you care about. It edits your notes in place, and it edits Notion pages in place, so it is worth knowing exactly where each of those edits stops.

One rule underlies all of it: **the knowledge base is canonical, and Notion is a derivative read surface.** Where the two disagree, the knowledge base wins and the Notion page is overwritten. Nothing in this server reads the mirror back.

## In your notes: three fields, nothing else

The server writes exactly three frontmatter fields, and treats every other field in the file as read-only:

| Field | Written by | Meaning |
| --- | --- | --- |
| `kb_notion_mirror_url` | `touch` | The mirror page's Notion URL. Stable for the life of the page. |
| `kb_notion_mirror_published_at` | `touch`, `update`, `baseline` | ISO-8601 UTC stamp of the last push. |
| `kb_notion_mirror_hash` | `update`, `baseline` | Digest of the last pushed state, so an unchanged note can be skipped. |

```yaml
---
status: current — May 2026
purpose: <one-line>
notion_source_url: https://www.notion.so/<32hex>
notion_path: Product & Eng / Platform Architecture / …
kb_notion_mirror_url: https://www.notion.so/<slug>-<32hex>
kb_notion_mirror_published_at: 2026-05-30T01:13:00Z
kb_notion_mirror_hash: 9f2c…
---
```

Frontmatter is edited by line surgery, not by a YAML round-trip, precisely so that nothing else moves: field order, quoting, spacing, and comments in the rest of the block survive untouched. New fields are inserted immediately after `notion_path`, falling back to `notion_source_url_secondary` and then `notion_source_url`. Writes are atomic, so an interrupted run leaves a whole file rather than half of one.

The server also **reads** three fields it never writes: `kb_notion_mirror_root` marks a folder index as a mirror root, `icon` selects the page icon, and `mirror: exclude` or `kb_notion_mirror_exclude` opts a note — or, on a folder index, a whole subtree — out of mirroring.

## What it refuses

- **It will not invent frontmatter.** A note with no frontmatter block is refused with `Note has no YAML frontmatter; refusing to mirror.` rather than given one.
- **It will not create a page implicitly.** There is no `create` verb. `update` on a note that has never been touched fails with `Note is not mirrored yet — call touch before update.` rather than quietly creating the page and a new URL.
- **It will not leave a subtree's root ambiguous.** Every mutation takes its Notion parent per call. There is no fixed root folder, no fixed wiki database, and no parent read from the environment.
- **It will not escape the configured root.** A `kb_path` containing `..`, or resolving outside `MCP_KI_KB_NOTION_MIRROR_KB_ROOT`, is rejected. Containment is symlink-aware.
- **It will not destroy a page's identity to move it.** Notion cannot re-parent a page between a `page_id` parent and a `database_id` parent; the API accepts the request and ignores the change. The server detects that and errors instead of reporting a move that did not happen.
- **It will not delete without being asked twice.** `note_delete`, `tree_delete`, and `tree_prune` default to `dry_run: true` at the MCP boundary, and are the only tools that require `MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL=destructive` to be registered at all. Through the CLI the flag is opt-in rather than default — see [Mirror a knowledge base](mirroring-a-knowledge-base.md).
- **It will not prune a note that merely moved.** `tree_prune` archives pages for notes deleted from git history; a note that moved keeps its URL and is left alone.
- **It will not leak the token.** The Notion secret is never written to logs, error messages, or tool output.

## In Notion: what it writes and what it leaves

`touch`, given a note and a parent, resolves the page title from the note's filename — and, under a database parent, the database's own title property — prepends a dated "Mirrored from Knowledge Base" banner callout, creates the page with that banner and no body, and writes the URL back into the note.

`update`, on a touched note, strips the frontmatter and the leading `# Title` H1 — Notion takes the title from a page property, so leaving it would duplicate it — converts the markdown body to Notion blocks, resolves `[[wikilinks]]` against the link map into `@`mentions, and replaces the page body in place. The URL does not change, and native child pages are spared.

Because the body is replaced, **anything a person adds to the body of a mirrored page in Notion is lost on the next update.** Child pages created natively in Notion are not: they survive as children, and `--verify` exists precisely to find pages someone has edited by hand.

## The `Child Pages` heading

Notion renders a page's children inline as native `child_page` blocks with no label. The server maintains a single `heading_2` reading exactly `Child Pages` immediately above the first of them, so the section has a heading. There is no tool for this: it is refreshed automatically whenever a `touch`, `update`, `delete`, or `move` affects a page parent. A refresh removes any previous heading before inserting one, and a page with no children gets none. Database parents need no heading and get none.

That heading is a mirror-only sentinel. It is **never** written back into the knowledge base source, and its text is exactly `Child Pages`. Any future path that reads the mirror back into the knowledge base has to recognise it and strip it.

## The audit log

Every write is recorded, by default, as a line of JSON at `~/.local/state/mcp-ki-kb-notion-mirror/audit.jsonl`, rotated by size. It is local, it is yours, and it is the fastest answer to "what did this do to my notes". [Install and configure the mirror](installation.md) covers the scope, path, and rotation settings.
