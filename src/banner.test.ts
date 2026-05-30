import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// banner.ts reads BANNER_TEMPLATE from config at import time, so each case sets
// the env, resets modules, and dynamically imports.
describe('banner', () => {
  beforeEach(() => {
    process.env.MCP_NOTION_MIRROR_TOKEN = 'ntn_placeholder'
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.MCP_NOTION_MIRROR_BANNER_TEMPLATE
  })

  it('builds a 📘 callout, interpolates {date}, and renders **bold** via martian', async () => {
    delete process.env.MCP_NOTION_MIRROR_BANNER_TEMPLATE
    const { bannerBlock } = await import('./banner.js')
    const block = bannerBlock('2026-05-30') as { type: string; callout: { icon: { emoji: string }; rich_text: Array<{ text: { content: string }; annotations?: { bold?: boolean } }> } }
    expect(block.type).toBe('callout')
    expect(block.callout.icon).toEqual({ type: 'emoji', emoji: '📘' })
    const fullText = block.callout.rich_text.map((r) => r.text.content).join('')
    expect(fullText).toContain('Mirrored from Knowledge Base on 2026-05-30')
    // The default template wraps the lead clause in bold.
    expect(block.callout.rich_text.some((r) => r.annotations?.bold)).toBe(true)
  })

  it('honours a custom template', async () => {
    process.env.MCP_NOTION_MIRROR_BANNER_TEMPLATE = 'Synced {date} — see KB.'
    const { bannerBlock } = await import('./banner.js')
    const block = bannerBlock('2026-01-02') as { callout: { rich_text: Array<{ text: { content: string } }> } }
    expect(block.callout.rich_text.map((r) => r.text.content).join('')).toBe('Synced 2026-01-02 — see KB.')
  })

  it('returns undefined when the template is the empty string (disabled)', async () => {
    process.env.MCP_NOTION_MIRROR_BANNER_TEMPLATE = ''
    const { bannerBlock } = await import('./banner.js')
    expect(bannerBlock('2026-05-30')).toBeUndefined()
  })
})
