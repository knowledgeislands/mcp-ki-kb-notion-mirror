---
id: MCP-NOTION-TOOL-001
title: Build image upload pipeline
theme: tool-surface
horizon: next
status: open
blocks: []
blocked-by: []
baseline-ref: null
---

## Context

Resolve `<Note> - images/` siblings, upload each file through `POST /v1/file_uploads`, and replace alt-text placeholder paragraphs with Notion image blocks using `file_upload`.

## Boundary

Keep the work limited to the stated surface.
