# Local backlinks

Incoming links are authoritative local KB wikilinks. Notion remains a derivative mirror and supplies no reverse-discovery authority. The only writable field is `kb_notion_mirror_backlinks`; all other fields and Markdown bytes are preserved.

## Preview and apply

Set `MCP_KI_KB_NOTION_MIRROR_KB_ROOT` to the intended KB root. Preview first:

```bash
mcp-ki-kb-notion-mirror-publish backlinks preview
mcp-ki-kb-notion-mirror-publish backlinks sync Alpha.md
mcp-ki-kb-notion-mirror-publish backlinks sync Alpha.md --apply
```

The first two commands are pure previews. `--apply` opts into writes; `--dry-run` and `--apply` together are refused. Omit the path to synchronise every note with editable LF frontmatter. Notes without frontmatter remain graph sources and are listed under `skipped_without_frontmatter`; explicitly selecting one refuses writeback. A `read` access level refuses apply.

The MCP tools are `kb_notion_mirror_backlinks_preview` and `kb_notion_mirror_backlinks_sync`. Both take optional `kb_path`; sync also takes `dry_run`, defaulting to `true`. The access gate exposes preview at `read` and sync at `write` or `destructive`. Both are closed-world, with no Notion request. The remote server still requires its token by default. Explicit `MCP_KI_KB_NOTION_MIRROR_LOCAL_ONLY=true` serves only these local tools without a Notion token; the local CLI needs no token or server-mode flag.

## Scope and grammar

Every invocation scans the configured KB root's visible, lowercase `.md` files, independent of mirror publishing exclusions or roots. Dot paths and `node_modules` are excluded deliberately; backlinks from those locations are outside this scope. `scan_complete: true` certifies that scope, rather than all possible KB content or Notion content. A target path limits proposals, never the source scan. Visible symlinks, nonregular entries, unreadable notes, non-UTF8 bytes and exceeded limits fail before writeback. The configured root may resolve through a symlink; discovered symlink entries are refused.

The accepted syntax is `[[target]]`, `[[target|display]]`, `[[target#heading]]` and `[[target#^block|display]]`. Targets are case-sensitive, trimmed, and root-relative paths with optional `.md`, or bare filenames with optional `.md`. Exact root-relative identities take precedence; bare basenames resolve only when unique. Display text does not change identity. An empty target before `#` refers to the source note. No title/property aliases or guessed relative paths are used. Frontmatter, fenced code (backticks or tildes, including quoted fences), indented code and closed inline backtick spans contribute no edges. An odd number of backslashes before `[[` escapes its opening. Links cannot contain newlines or nested brackets.

Unresolved targets are omitted and reported in `unresolved`; `resolution_complete` is false when unresolved or ambiguous targets exist. Ambiguous targets list their candidates and block every apply, even if they occur outside the selected write target. Successful sync may have unresolved targets; it reports that limitation explicitly. Sources are sorted unique KB-root-relative paths, so aliases and duplicate references produce one incoming source. Self-links count. Generated backlinks never feed the graph because frontmatter is excluded.

The scanner bounds visible entries to 10,000, Markdown files to 2,000, file bytes to 1 MiB, total bytes to 32 MiB, references to 20,000, returned source-path entries and diagnostic candidate entries to 20,000 each and directory depth to 32. Note paths cap at 4,096 characters and reject control characters, backslashes and unsafe segments. Bounds fail rather than returning a truncated complete result. Prepared writeback bytes must also fit both the per-file and final total-scope budgets; growth beyond either refuses the entire apply before any mutation.

## Generated field and failure handling

The scalar is YAML double-quoted JSON containing exactly a version and sources, for example:

```yaml
kb_notion_mirror_backlinks: "{\"v\":1,\"sources\":[\"Alpha/Beta.md\"]}"
```

The v1 value must be canonical JSON with sorted unique safe paths. Existing unknown versions, hand-authored values, duplicates, nested/quoted spellings, multiline values and noncanonical encoding are refused before writes. Recompute replaces stale sources, including an empty `sources` list when every incoming link disappears. It never appends to a hand-authored provenance section.

New backlinks fields are appended before the closing frontmatter delimiter; multiline preceding anchors remain intact. Existing values update in place. Atomic staging uses exclusive no-follow creation and preserves existing note permissions; a staging collision is refused without following or deleting its existing path.

All proposed edits are prepared and validated before apply. Apply rescans membership and all source bytes before the first write, then rechecks each target immediately before its atomic whole-file replacement. Source or membership drift at the preflight boundary writes nothing. These checks do not provide a filesystem lock against concurrent editors; avoid simultaneous KB editing during apply.

Each replacement is atomic; a multi-file sync is not a transaction. If a later replacement fails, the error lists the exact files already written. Inspect those paths, resolve the reported failure and preview again before retrying. No success or all-or-nothing claim is returned after partial application. No real private KB or live Notion is used by automated tests.
