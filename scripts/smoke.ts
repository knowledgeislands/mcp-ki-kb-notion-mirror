#!/usr/bin/env node
// End-to-end smoke test: boot the built server over stdio MCP, prove the
// modern 2026-07-28 protocol boundary, list its tools, and assert the surface
// matches what the registration tests expect. Catches drift between code and
// the *wire* contract (the in-process access-level tests cover registration;
// this covers the actual protocol round-trip).
//
// Three things only a live round-trip can prove are asserted here, because the
// source audit deliberately does not require a local `server/discover` literal:
//   1. the SDK owns discovery and negotiates the modern protocol revision;
//   2. every synchronous result carries the required `complete` discriminator;
//   3. the deliberate legacy fallback still serves a 2025-era opening.
//
// Run via `bun run ki:test:smoke` (builds dist/ first). Runs in CI without
// secrets: the server only needs MCP_KI_KB_NOTION_MIRROR_TOKEN to boot, so we
// pass a throwaway placeholder — no real Notion call is ever made.

import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

// Single source of truth for the tool surface — kept in sync with
// src/tools/{note,tree,roots}/index.ts and the access-level tests.
// Add a tool → update both.
const EXPECTED_TOOLS = [
  'kb_notion_mirror_note_get',
  'kb_notion_mirror_note_status',
  'kb_notion_mirror_note_preflight',
  'kb_notion_mirror_note_touch',
  'kb_notion_mirror_note_update',
  'kb_notion_mirror_note_move',
  'kb_notion_mirror_note_delete',
  'kb_notion_mirror_tree_status',
  'kb_notion_mirror_tree_preflight',
  'kb_notion_mirror_tree_touch',
  'kb_notion_mirror_tree_update',
  'kb_notion_mirror_tree_delete',
  'kb_notion_mirror_tree_prune',
  'kb_notion_mirror_roots_list'
] as const

const die = (msg: string, detail?: unknown): never => {
  console.error(`✗ smoke failed: ${msg}`)
  if (detail !== undefined) console.error(detail)
  process.exit(1)
}

// Placeholder config so boot validation passes headless, and access level
// raised to `destructive` so the smoke sees the full surface (the default
// `write` gate would otherwise hide the archive verbs).
const createTransport = (kbRoot: string): StdioClientTransport =>
  new StdioClientTransport({
    command: 'node',
    args: ['dist/mcp-server/index.js'],
    env: {
      ...(process.env as Record<string, string>),
      MCP_KI_KB_NOTION_MIRROR_TOKEN: 'ntn_smoke_placeholder',
      MCP_KI_KB_NOTION_MIRROR_KB_ROOT: kbRoot,
      MCP_KI_KB_NOTION_MIRROR_ACCESS_LEVEL: 'destructive',
      MCP_KI_KB_NOTION_MIRROR_AUDIT_LOG: 'off'
    }
  })

const main = async (): Promise<void> => {
  // An empty throwaway KB root: every assertion below is a pure local read, so
  // nothing is written and no Notion call is ever made.
  const kbRoot = mkdtempSync(join(tmpdir(), 'mcp-ki-kb-notion-mirror-smoke-'))
  const client = new Client(
    { name: 'mcp-ki-kb-notion-mirror-smoke', version: '0.0.0' },
    { capabilities: {}, versionNegotiation: { mode: 'auto' } }
  )

  await client.connect(createTransport(kbRoot))

  try {
    const discovery = client.getDiscoverResult()
    if (client.getProtocolEra() !== 'modern') die('server/discover did not select the modern protocol era')
    if (client.getNegotiatedProtocolVersion() !== '2026-07-28') {
      die('unexpected negotiated protocol version', client.getNegotiatedProtocolVersion())
    }
    if (
      discovery?.resultType !== 'complete' ||
      !discovery.supportedVersions.includes('2026-07-28') ||
      discovery._meta?.['io.modelcontextprotocol/serverInfo']?.name !== 'mcp-ki-kb-notion-mirror'
    ) {
      die('invalid server/discover result', discovery)
    }

    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name).sort()
    const expected = [...EXPECTED_TOOLS].sort()

    // Diff with clear messages so CI logs are actionable.
    const missing = expected.filter((n) => !names.includes(n))
    const extra = names.filter((n) => !expected.includes(n as (typeof EXPECTED_TOOLS)[number]))
    if (missing.length || extra.length) {
      die('tool surface mismatch', { missing, extra, actualCount: names.length, expectedCount: expected.length })
    }

    // Sanity: every tool advertises an inputSchema object.
    const missingSchema = tools.filter((t) => !t.inputSchema || typeof t.inputSchema !== 'object').map((t) => t.name)
    if (missingSchema.length) die('tools missing inputSchema', missingSchema)

    // The v2 client validates the required wire-level resultType, then lifts a
    // complete result into the stable callTool return shape without the
    // discriminator — so a helper that forgot it fails here, not silently.
    const roots = await client.callTool({ name: 'kb_notion_mirror_roots_list', arguments: {} })
    if (roots.isError) die('tool call returned an error envelope', roots)

    const malformed = await client.callTool({ name: 'kb_notion_mirror_note_status', arguments: { kb_path: 7 } })
    if (!malformed.isError) die('malformed tool arguments were accepted', malformed)

    // The deliberate legacy fallback: a 2025-era opening must still be served
    // from the same factory, with the same surface, while sibling clients
    // finish migrating.
    const legacyClient = new Client({ name: 'mcp-ki-kb-notion-mirror-legacy-smoke', version: '0.0.0' }, { capabilities: {} })
    await legacyClient.connect(createTransport(kbRoot))
    try {
      if (legacyClient.getProtocolEra() !== 'legacy') {
        die('legacy initialize fallback did not remain available', legacyClient.getProtocolEra())
      }
      if ((await legacyClient.listTools()).tools.length !== EXPECTED_TOOLS.length) {
        die('legacy tool surface differs from modern tool surface')
      }
    } finally {
      await legacyClient.close()
    }

    console.error(`✓ smoke passed: modern discovery, legacy fallback, ${names.length} tools, valid result envelope`)
  } finally {
    await client.close()
    rmSync(kbRoot, { recursive: true, force: true })
  }
}

main().catch((err) => die('uncaught', err))
