---
code: TOOL
---

# Tool surface roadmap

Current limitations: local images currently render as alt-text and a path because Notion needs them uploaded through `POST /v1/file_uploads`; unresolved wikilinks render as italic placeholder text until their target has a `link_map` entry.

## Blocking

Actively broken, or blocking the `Next` horizon: takes priority over everything else and must clear before `Next` work proceeds. Empty means nothing is on fire.

## Next

Scoped and ready to start — the immediate queue, picked up before anything in **Soon** or **Future**.

### Build image upload pipeline

Resolve `<Note> - images/` siblings, upload each file through `POST /v1/file_uploads`, and replace alt-text placeholder paragraphs with Notion `image` blocks using `file_upload`.

### Add `kb_notion_mirror_note_diff`

Expose the block-level diff an update would produce without writing, so callers can review a mutation before it occurs.

## Soon

Understood and roughly scoped but not yet started — worth doing once the **Next** queue clears, ahead of anything still speculative.

## Waiting for

Worth doing, but presently blocked on an external dependency or decision. Revisit when its named condition changes rather than treating it as dormant local work.

## Future

Speculative or not yet scoped — items marked _(candidate)_ need a scoping pass (or a decision to drop them) before they're actionable.

### Synchronise backlinks

Write the mirror's inbound links back into the KB note for a fuller provenance trail.

### Add a token-gated live integration test

Add a skipped-by-default `*.live.test.ts` suite for occasional end-to-end checks against a throwaway Notion workspace, including cross-parent-type `kb_notion_mirror_note_move` failure detection.
