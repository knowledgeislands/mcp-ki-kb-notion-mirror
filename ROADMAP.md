# Roadmap

Forward-looking plans only. Shipped features live in [README.md](./README.md); release history lives in [CHANGELOG.md](./CHANGELOG.md) and the git log.

## Known gaps (deferred)

These are _known_ limitations, not bugs:

1. **Images.** Many KB notes reference local PNGs (`<Note Name> - images/foo.png`). Notion needs these uploaded via `POST /v1/file_uploads`, then referenced as `image` blocks with `type: file_upload`. The current iteration **skips** images: `@tryfabric/martian` renders a markdown image as a paragraph containing the alt text + path, which is visually obvious as "this needs fixing". Inlining data URIs is not an option — Notion rejects them.
2. **Wikilinks.** Markdown `[[X]]` doesn't resolve to anything in Notion, so it passes through as literal text. A later pass can resolve targets that already have a `notion_mirror_url` and rewrite them as `mention` blocks.
3. **Stable URLs across re-publish.** `force: true` archives the old mirror page and creates a new one, so the URL changes. This matches the canonical-wins rule (the mirror is disposable). If stable URLs become a requirement, switch to edit-in-place via `PATCH /v1/blocks/{page_id}/children` + clearing the old children — harder, and not needed yet.

## Next Up

- **Image upload pipeline** — resolve `<Note> - images/` siblings, upload via `POST /v1/file_uploads`, swap the alt-text placeholder paragraphs for real `image` blocks.
- **Wikilink resolution** — second pass that rewrites `[[X]]` to a Notion `mention` when `X` has a `notion_mirror_url`.
- **`notion_mirror_diff`** — show the block-level diff a publish/republish would produce without writing, so callers can review before mutating.

## Future Advanced Capabilities

- **Edit-in-place re-publish** — stable mirror URLs across republishes (see gap 3).
- **Backlink sync** — write the mirror's inbound links back into the KB note for a fuller provenance trail.

## Tooling

- Live integration test gated behind a real token env var (`src/**/*.live.test.ts`), skipped by default, for occasional end-to-end verification against a throwaway Notion workspace — in particular to confirm the `notion_mirror_move` cross-parent-type silent-failure detection behaves against the live API.

## Shipped

- **v1.0.0 — File-aware publisher rewrite.** Clean break: the tool surface is now `notion_mirror_publish` / `notion_mirror_move` / `notion_mirror_unpublish` / `notion_mirror_get`, each taking `kb_path` (+ a caller-supplied Notion `parent` for mutations). All orchestration — file discovery, parent resolution, folder/exclusion conventions, publish order — moved to the caller. `MCP_NOTION_MIRROR_WIKI_DATABASE_ID` is gone; the banner is now a `{date}` template (`MCP_NOTION_MIRROR_BANNER_TEMPLATE`, empty = disabled). The prior surface (`notion_mirror_note_*`, `notion_mirror_unpublished_list`, hierarchy auto-derivation from v0.1–v0.3) is removed.
