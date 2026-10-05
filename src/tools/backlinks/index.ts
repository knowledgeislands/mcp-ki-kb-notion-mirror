import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import type { LocalConfig } from '../../config/index.js'
import { syncBacklinks } from '../../main/backlinks/index.js'
import { READ_ONLY, WRITE_IDEMPOTENT } from '../../utils/annotations.js'
import { errorResult, jsonResult } from '../../utils/results.js'

const kbPath = z
  .string()
  .min(1)
  .max(4096)
  .refine((p) => !p.split(/[\\/]/).includes('..'))
  .optional()
const previewInput = z.object({ kb_path: kbPath }).strict()
const syncInput = z.object({ kb_path: kbPath, dry_run: z.boolean().default(true) }).strict()
const issue = z.object({ source: z.string(), target: z.string(), candidates: z.array(z.string()) })
const output = z.object({
  scope: z.literal('visible-markdown-under-kb-root'),
  scan_complete: z.literal(true),
  resolution_complete: z.boolean(),
  dry_run: z.boolean(),
  note_count: z.number(),
  reference_count: z.number(),
  unresolved: z.array(issue),
  ambiguous: z.array(issue),
  skipped_without_frontmatter: z.array(z.string()),
  proposals: z.array(z.object({ kb_path: z.string(), sources: z.array(z.string()), changed: z.boolean() })),
  written: z.array(z.string())
})

export const registerBacklinksTools = (server: McpServer, cfg: LocalConfig): void => {
  server.registerTool(
    'kb_notion_mirror_backlinks_preview',
    {
      title: 'Preview local KB backlinks',
      description:
        'Read the complete visible Markdown scope under configured KB root and propose the generated backlinks field. Optional kb_path limits targets, never the source scan. Dot paths/node_modules are excluded; symlinks and exceeded bounds fail closed. No Notion calls or writes. Unresolved and ambiguous identities are reported, never guessed.',
      inputSchema: previewInput,
      outputSchema: output,
      annotations: READ_ONLY
    },
    async (args) => {
      try {
        return jsonResult(await syncBacklinks(cfg, { ...args, dry_run: true }))
      } catch (err) {
        return errorResult('previewing backlinks', err)
      }
    }
  )
  server.registerTool(
    'kb_notion_mirror_backlinks_sync',
    {
      title: 'Synchronise generated local KB backlinks',
      description:
        'Recompute only kb_notion_mirror_backlinks from authoritative local wikilinks. Default dry_run=true; set false explicitly to write. Optional kb_path limits targets. Scan scope is visible Markdown under KB root, excluding dot paths/node_modules. Ambiguity, incomplete scans, unsafe fields and prewrite source drift fail closed. Each file is atomic; batch writes are not transactional and failure reports files already written. Unresolved targets are omitted and reported.',
      inputSchema: syncInput,
      outputSchema: output,
      annotations: WRITE_IDEMPOTENT
    },
    async (args) => {
      try {
        return jsonResult(await syncBacklinks(cfg, args))
      } catch (err) {
        return errorResult('synchronising backlinks', err)
      }
    }
  )
}
