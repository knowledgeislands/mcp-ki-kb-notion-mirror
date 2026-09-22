# Mirror a knowledge base

Use this guide to publish a folder of notes into Notion and keep it up to date. It assumes the server is installed and can reach your workspace — see [Install and configure the mirror](installation.md).

Every example uses the `mcp-ki-kb-notion-mirror-publish` CLI because it is the easiest thing to read. An MCP client drives the same verbs through the tools of the same name.

## Before you begin

- Every note you want mirrored has YAML frontmatter. A note without it is refused rather than given some.
- Every folder you want mirrored has an index note (see below). A folder without one has nowhere to attach its children.
- The Notion page or database you are mirroring under is connected to your integration.

## How folders become pages

The `tree` verbs encode one convention for turning a folder tree into a Notion page tree:

- A folder's **index note** is `<Folder>/<Folder>.md` — its basename equals the containing folder's basename. That note becomes the folder's Notion page.
- A **leaf note** nests under its own folder's index page.
- A **sub-folder's index** nests under the **grandparent** folder's index page, not under its own.
- The **subtree-root index** — the index of the `subtree` folder you named — attaches to the parent you supplied.

So for `subtree = "Alpha"` published under a wiki database:

```text
Alpha/Alpha.md            → page under the wiki database (the parent)
Alpha/Leaf.md             → page under Alpha
Alpha/Beta/Beta.md        → page under Alpha
Alpha/Beta/Gamma.md       → page under Beta
```

A note is excluded from mirroring when its frontmatter carries `mirror: exclude` or `kb_notion_mirror_exclude`, when its filename starts with a configured skip prefix (`+` by default), or when its kb-path is in the configured skip list. Setting an exclude flag on a **folder index** prunes the whole subtree beneath it, so excluding a folder never orphans its children.

## Check before you publish

Both of these are read-only and make no Notion call:

```bash
mcp-ki-kb-notion-mirror-publish tree preflight Alpha
mcp-ki-kb-notion-mirror-publish tree status    Alpha
```

`preflight` reports notes with no frontmatter and folders with no index note. `status` reports which notes are already mirrored, and in the order a publish would walk them. Fix what `preflight` reports before publishing: a missing folder index stops its children from resolving a parent partway through the run.

## Publish in two phases

Mirroring is two-phase by design and there is no `create` verb. `touch` brings a page into existence as a scaffold — a title, an icon, and a dated banner, with no body — so its URL becomes known. `update` then fills the body and turns `[[wikilinks]]` into Notion `@`mentions.

The split exists because a mention needs its target's URL to already exist, and that URL has to stay stable afterwards. So the order is always **touch everything, then update everything**:

```text
touch  (URLs do not exist yet)
  for each note in tree order: tree_touch  → every note gets a stable kb_notion_mirror_url
update (URLs are stable)
  build a link map from every note's URL
  for each note: tree_update with that link map  → every [[X]] becomes an @mention
```

`update` replaces the body in place and keeps the URL, so the mentions other notes already carry keep resolving.

By hand, against one subtree and one parent:

```bash
mcp-ki-kb-notion-mirror-publish tree touch  Alpha --parent-db <wiki-db-id>
mcp-ki-kb-notion-mirror-publish tree update Alpha --parent-db <wiki-db-id>
```

Use `--parent-page <page-id>` instead to nest the subtree under an ordinary Notion page rather than a database. Add `--note Alpha/Beta/Gamma.md` to either verb to act on just one note and the ancestor chain it needs.

Each tree verb reports `{ eligible, outcomes }`, one outcome per note, with an action of `touch`, `update`, `delete`, `skip`, `plan`, or `error`. A failing note does not stop the run — the rest of the tree still publishes, and the error is recorded against that note's path.

## Declare roots and publish everything

Rather than naming a subtree and a parent on every invocation, mark a folder index as a mirror root in its own frontmatter:

```yaml
kb_notion_mirror_root: 36f9f7187cc280f69272e60aa89bff24 # the Notion parent this root attaches under
```

The value is the Notion parent: a wiki **database** id by default, `db:<id>` to say so explicitly, or `page:<id>` to nest the root under a Notion page. Roots do not nest — discovery prunes below a root it has found — and excluded or skip-prefixed branches are ignored.

```bash
mcp-ki-kb-notion-mirror-publish roots list                 # every declared root and its parent
mcp-ki-kb-notion-mirror-publish roots publish              # touch everything, then update everything
```

`--dry-run` applies to `delete` and `prune` only. It is accepted and silently ignored on every other verb, so `roots publish --dry-run` performs a real publish. To see what a publish would cover without writing anything, use `roots list` and `tree status`, which make no Notion call.

`roots publish` is the only place the cross-root sequence lives. It touches every declared root, then updates them all with a single link map spanning every root, so a `[[wikilink]]` that points from one root into another resolves to a real mention. Where a bare name exists in more than one root, the local root's note wins.

Discovery is the only thing frontmatter drives. The MCP tools never perform a frontmatter-driven batch mutation: `roots_list` returns `[{ subtree, indexKbPath, parent }]` and the client loops the `tree` verbs itself, so every mutation still carries an explicit parent.

## Wikilinks

Notes use `[[target]]` and `[[target|display]]`. `update` takes a `link_map` from target string to mirror URL; each resolved link becomes a Notion page `@`mention, and an unresolved target renders as italic text rather than failing.

`tree_update` builds that map from the subtree automatically, which resolves links within the subtree. Pass an explicit `link_map` — or use `roots publish`, which does it for you — when a link crosses from one root into another.

## Republish after editing notes

Run the update again. By default `update` skips a note whose content has not changed since its last mirror, using a hash of the resolved blocks, title, icon, and parent recorded in the note's frontmatter. The dated banner is deliberately excluded from that hash, so an unchanged note does not re-push merely because the date moved on.

Two flags override the skip:

- `--force` pushes every note whether or not its hash changed. Use it after a change to the renderer, which invalidates every hash once.
- `--verify` reads each page's last-edited time from Notion and re-pushes anything edited there since the last mirror. Use it when you suspect someone has been editing the mirror by hand. The knowledge base wins: their Notion edit is overwritten.

```bash
mcp-ki-kb-notion-mirror-publish roots publish --verify
```

## Remove things

```bash
mcp-ki-kb-notion-mirror-publish note delete Alpha/Leaf.md --dry-run
mcp-ki-kb-notion-mirror-publish tree delete Alpha         --dry-run
mcp-ki-kb-notion-mirror-publish tree prune  Alpha         --dry-run
```

`delete` archives the page and clears the mirror fields from the note. `prune` is git-driven: it archives the mirror pages of notes that have been **deleted** from the subtree, and it needs the knowledge base root to be a git repository. A note that was moved keeps its URL and is never pruned.

The two ways in differ, and the difference matters. Through an MCP client, `dry_run` defaults to `true`: a destructive tool called with no argument previews. Through the CLI, `--dry-run` is off unless you pass it, so the commands above preview only because the flag is there. Always run the preview first and drop the flag only when it reports what you expect.

Archiving a page cascade-archives its descendants, and `note delete` clears only that one note's frontmatter — use `tree delete` to tear down a subtree so no note is left pointing at an archived page.

## Verify

After a publish, `tree status Alpha` reports every note as mirrored with a URL, and the pages exist under the parent you named with their bodies rendered and their `[[wikilinks]]` showing as mentions rather than italics.

Straight after a successful full publish you can record that state without any further Notion call:

```bash
mcp-ki-kb-notion-mirror-publish roots baseline
```

`baseline` renders and hashes every note exactly as `update` would and stamps the mirror fields, asserting "Notion already reflects this". Subsequent publishes then skip those notes. Only use it when that assertion is actually true, and pass `--skip <kbPath>` for any note whose push failed so the next publish still pushes it.

## Recovery

If a publish fails partway, nothing needs unwinding: `touch` is idempotent and `update` replaces bodies in place, so running the sequence again is safe. [Troubleshoot the mirror](troubleshooting.md) covers each specific failure and what it means.
