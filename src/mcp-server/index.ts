#!/usr/bin/env node

/**
 * mcp-notion-mirror
 *
 * Local stdio MCP server that mirrors local Knowledge Base markdown notes to a
 * Notion wiki and records the resulting Notion page URL back into each note's
 * YAML frontmatter. The KB is canonical; the mirror is a derivative read
 * surface for non-KB consumers.
 *
 * This is a FILE-AWARE, LAYOUT-AGNOSTIC publisher: it acts on one `kb_path` per
 * call and (for mutations) a Notion `parent` the caller supplies. It does not
 * walk directories, resolve parents, or know any folder convention — that is
 * the orchestrator's job (see REWRITE-SPEC-v1.md).
 *
 * Configuration (environment variables):
 *   MCP_NOTION_MIRROR_TOKEN            Required. Notion internal-integration
 *                                      secret (ntn_…). Needs Read + Insert +
 *                                      Update content and a Connection to every
 *                                      page/database it publishes into.
 *   MCP_NOTION_MIRROR_KB_ROOT          Optional. Absolute KB root. When set,
 *                                      kb_path args resolve under it and are
 *                                      confined to it; when unset, kb_path must
 *                                      be absolute (caller bounds traversal).
 *   MCP_NOTION_MIRROR_ACCESS_LEVEL     Optional. read | write | destructive.
 *                                      Default: write.
 *   MCP_NOTION_MIRROR_BANNER_TEMPLATE  Optional. Banner copy; {date} → today's
 *                                      UTC date. Empty string disables the banner.
 *   MCP_NOTION_MIRROR_AUDIT_LOG        Optional. off | writes | all. Default: writes.
 *   MCP_NOTION_MIRROR_AUDIT_LOG_PATH   Optional. Default
 *                                      ~/.local/state/mcp-notion-mirror/audit.jsonl.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ACCESS_LEVEL, AUDIT_LOG_MODE, AUDIT_LOG_PATH, KB_ROOT, NOTION_API_BASE_URL } from '../config.js'
import { registerMirrorTools } from '../tools/mirror/index.js'
import { makeAccessGatedRegister } from '../utils/access-level.js'

console.error(`mcp-notion-mirror starting...`)
console.error(`  MCP_NOTION_MIRROR_API_BASE_URL=${NOTION_API_BASE_URL}`)
console.error(`  MCP_NOTION_MIRROR_KB_ROOT=${KB_ROOT ?? '(unset — kb_path must be absolute)'}`)
console.error(`  MCP_NOTION_MIRROR_ACCESS_LEVEL=${ACCESS_LEVEL}`)
console.error(`  MCP_NOTION_MIRROR_AUDIT_LOG=${AUDIT_LOG_MODE}${AUDIT_LOG_MODE === 'off' ? '' : ` (path: ${AUDIT_LOG_PATH})`}`)

const server = new McpServer({
  name: 'mcp-notion-mirror',
  version: '1.0.0'
})
server.registerTool = makeAccessGatedRegister(server)

registerMirrorTools(server)

const main = async (): Promise<void> => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`mcp-notion-mirror ready`)
}

main().catch((err) => {
  console.error('mcp-notion-mirror fatal:', err)
  process.exit(1)
})
