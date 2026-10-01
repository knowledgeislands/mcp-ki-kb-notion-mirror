import type { McpServer } from '@modelcontextprotocol/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type { AccessLevel, Config } from '../../config/index.js'
import { makeAccessGatedRegister } from '../../utils/access-level.js'
import { registerNoteTools } from './index.js'

interface Registration {
  name: string
  config: { inputSchema: z.ZodType; outputSchema: z.ZodType; annotations: Record<string, unknown> }
}

const registrations = (level: AccessLevel): Registration[] => {
  const calls: Registration[] = []
  const server = {
    registerTool: (name: string, config: Registration['config']) => calls.push({ name, config })
  } as unknown as McpServer
  const gated = {
    registerTool: makeAccessGatedRegister(server, level, { mode: 'off', path: '/dev/null', maxBytes: 0, keep: 0 })
  } as McpServer
  registerNoteTools(gated, {} as Config)
  return calls
}

describe('note diff tool contract', () => {
  it('is visible at read access and accepts only the planned inputs', () => {
    const entry = registrations('read').find((call) => call.name === 'kb_notion_mirror_note_diff')
    expect(entry).toBeDefined()
    expect(entry?.config.annotations).toMatchObject({ readOnlyHint: true })
    const valid = { kb_path: 'note.md', parent: { type: 'page_id', page_id: 'a'.repeat(32) } }
    expect(entry?.config.inputSchema.safeParse(valid).success).toBe(true)
    expect(entry?.config.inputSchema.safeParse({ ...valid, extra: true }).success).toBe(false)
    expect(entry?.config.inputSchema.safeParse({ kb_path: 'note.md' }).success).toBe(false)
    expect(entry?.config.outputSchema.safeParse({ status: 'not-mirrored', reason: 'not-mirrored' }).success).toBe(true)
    expect(
      entry?.config.outputSchema.safeParse({
        status: 'compared',
        page_id: 'a',
        url: 'u',
        identical: true,
        body_changes: [],
        metadata_changes: [],
        excluded_generated: { banner: false, footer: false, child_pages: 0 }
      }).success
    ).toBe(true)
    expect(
      entry?.config.outputSchema.safeParse({ status: 'not-mirrored', reason: 'not-mirrored', extra: true }).success
    ).toBe(false)
  })
})
