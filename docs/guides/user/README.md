# Using the mirror

This server publishes Knowledge Base markdown notes into Notion and writes each resulting page URL back into the note's frontmatter. Your knowledge base stays canonical; Notion is a derivative read surface for people who do not work in the knowledge base.

## Guides

- [Install and configure the mirror](installation.md) covers the Notion integration and its capabilities, building the server, wiring it into an MCP client, every environment variable, and the access-level gate.
- [Mirror a knowledge base](mirroring-a-knowledge-base.md) covers the folder-index convention, declaring mirror roots, the two-phase publish, wikilink resolution, and the publish CLI.
- [What the mirror owns](what-the-mirror-owns.md) covers the three frontmatter fields the server writes, the `Child Pages` heading it maintains in Notion, and everything it deliberately refuses to touch.
- [Troubleshoot the mirror](troubleshooting.md) covers the failures a publish actually produces, what each one means, and how to recover.

## Quick start

Create a Notion integration, connect it to the page or database you want to mirror under, then confirm the server can read your notes before it writes anything:

```bash
export MCP_KI_KB_NOTION_MIRROR_TOKEN=ntn_…
export MCP_KI_KB_NOTION_MIRROR_KB_ROOT=/absolute/path/to/your/kb

mcp-ki-kb-notion-mirror-publish tree preflight Alpha
mcp-ki-kb-notion-mirror-publish tree status    Alpha
```

Both are read-only and make no Notion call. Once they are clean, [Mirror a knowledge base](mirroring-a-knowledge-base.md) takes you through the publish itself.

Read [What the mirror owns](what-the-mirror-owns.md) before pointing this at a knowledge base you care about. The server edits your notes in place, and knowing exactly which three fields it edits is cheaper before the first publish than after it.
