# Install and configure the mirror

Use this guide once, before your first publish. It ends with a check that proves the server can see both your notes and your Notion workspace.

You need Bun (>= 1.3) to build, Node (>= 22) to run the built server, a Notion workspace you can add an integration to, and a local knowledge base of markdown notes with YAML frontmatter.

## 1. Create the Notion integration

1. Go to <https://www.notion.so/my-integrations> and choose **New integration** (internal). Give it the **Read content**, **Insert content**, and **Update content** capabilities. It needs all three: reading to resolve parents and existing pages, inserting to create a page, updating to replace a body or re-parent a page.
2. Copy the **Internal Integration Secret** (`ntn_…`). Treat it like a password. The server never writes it to logs, error messages, or tool output, but nothing stops you pasting it somewhere it should not be.
3. Open every Notion page or database you intend to mirror under, then **⋯** → **Connections** → add your integration.

Step 3 is the one people skip. Without that connection the Notion API answers `restricted_resource` with HTTP 403 even though the token is valid, and the page looks perfectly visible in your browser the whole time.

## 2. Build the server

```bash
bun install
bun run build
```

This compiles to `dist/`, which is what an MCP client and the publish CLI both run. Rebuild after pulling changes.

## 3. Wire it into an MCP client

Add the server to your client's configuration. For Claude Desktop that is `~/Library/Application Support/Claude/claude_desktop_config.json`; Claude Code has an equivalent. [`claude-config-sample.json`](../../../claude-config-sample.json) in the repository root is a working example:

```json
{
  "mcpServers": {
    "mcp-ki-kb-notion-mirror": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-ki-kb-notion-mirror/dist/mcp-server/index.js"],
      "env": {
        "MCP_KI_KB_NOTION_MIRROR_TOKEN": "ntn_YOUR_INTEGRATION_SECRET",
        "MCP_KI_KB_NOTION_MIRROR_KB_ROOT": "/absolute/path/to/your/kb"
      }
    }
  }
}
```

Restart the client. A variable set in that `env` block always wins over anything the server would otherwise load from a file, so this is the authoritative place to configure a client-launched server.

## 4. Choose an access level

`MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL` decides which tools are registered at all. A tool below the configured level is not merely refused at call time — the client never sees it. Each level implies the ones below it:

| Level | Tools registered |
| ------------- | ---------------------------------------------------------- |
| `read` | the six read verbs: every `_get` / `_status` / `_preflight`, and `_roots_list` |
| `write` | the above + every `_touch` / `_update`, and `_note_move` — eleven in total |
| `destructive` | the above + `_note_delete`, `_tree_delete`, and `_tree_prune` — all fourteen |

The gate reads each tool's MCP annotations rather than its name, and an unannotated tool is treated as destructive rather than assumed safe. The default is `write`, because mutating the mirror is the server's whole purpose; set `read` while you are exploring a knowledge base you do not want changed, and `destructive` only when you intend to archive pages.

## 5. Set the rest of the environment

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `MCP_KI_KB_NOTION_MIRROR_TOKEN` | yes | — | Notion internal-integration secret (`ntn_…`). |
| `MCP_KI_KB_NOTION_MIRROR_KB_ROOT` | no † | unset | Absolute KB root. `kb_path` / `subtree` resolve under it and are confined to it. |
| `MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL` | no | `write` | `read` / `write` / `destructive`. |
| `MCP_KI_KB_NOTION_MIRROR_BANNER_TEMPLATE` | no | KB default | Banner copy. ‡ |
| `MCP_KI_KB_NOTION_MIRROR_API_BASE_URL` | no | `https://api.notion.com` | Notion API base URL. |
| `MCP_KI_KB_NOTION_MIRROR_SKIP_PREFIXES` | no | `+` | Comma-separated filename prefixes excluded from tree walking. |
| `MCP_KI_KB_NOTION_MIRROR_SKIP_PATHS` | no | (none) | Comma-separated kb-paths excluded from tree walking. |
| `MCP_KI_KB_NOTION_MIRROR_ICON_BASE_URL` | no | [Lucide static icons][lucide-icons] | Base URL for Lucide-style external page icons. |
| `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG` | no | `writes` | Audit-log scope. `off` / `writes` / `all`. |
| `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG_PATH` | no | `~/.local/state/mcp-ki-kb-notion-mirror/audit.jsonl` | Path to the JSONL audit log. |
| `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG_MAX_BYTES` | no | `10485760` (10 MiB) | Size-based rotation threshold in bytes. `0` disables rotation. |
| `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG_KEEP` | no | `5` | Number of rotated audit-log files to retain. |

† The `tree` and `roots` tools require `MCP_KI_KB_NOTION_MIRROR_KB_ROOT` and fail without it. The `note` tools work with absolute `kb_path`s when it is unset.

‡ `{date}` becomes today's UTC date and `**bold**` is honoured. An empty string disables the banner entirely.

The audit log records every write by default. It is a local JSONL file, rotated by size, and it is the fastest way to answer "what did this thing actually do to my notes last Tuesday". Set `MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG=all` to record reads too, or `off` to record nothing.

Notion parents are never configured through the environment. Every mutation takes the parent it attaches under per call, as a tool argument or a CLI flag, or reads it from `kb_notion_mirror_root` frontmatter. There is no fixed root folder and no fixed wiki database.

## 6. Confirm it works

Run the read-only verbs first. Neither makes a Notion call, so they prove the server can find and parse your notes without risking anything:

```bash
mcp-ki-kb-notion-mirror-publish tree preflight Alpha
mcp-ki-kb-notion-mirror-publish tree status    Alpha
```

Then prove the token and the connection, with a note that is already mirrored or with any subtree's roots:

```bash
mcp-ki-kb-notion-mirror-publish roots list
```

`roots list` reads your knowledge base and reports each declared root with the Notion parent it attaches under. An empty result means no folder index carries `kb_notion_mirror_root` yet — see [Mirror a knowledge base](mirroring-a-knowledge-base.md).

From an MCP client, ask it to list the server's tools. At the default `write` level you should see eleven of the fourteen; `kb_notion_mirror_note_delete`, `kb_notion_mirror_tree_delete`, and `kb_notion_mirror_tree_prune` appear only at `destructive`.

If any of this fails, [Troubleshoot the mirror](troubleshooting.md) covers every error these steps can produce.

[lucide-icons]: https://unpkg.com/lucide-static@latest/icons
