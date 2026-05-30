import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DESTRUCTIVE_REMOTE, READ_ONLY_REMOTE, WRITE_REMOTE } from './annotations.js'

describe('levelFromAnnotations / makeAccessGatedRegister (mcp-notion-mirror)', () => {
  beforeEach(() => {
    process.env.MCP_NOTION_MIRROR_TOKEN = 'ntn_placeholder'
    delete process.env.MCP_NOTION_MIRROR_ACCESS_LEVEL
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.MCP_NOTION_MIRROR_ACCESS_LEVEL
  })

  it('maps READ_ONLY_REMOTE to read', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(READ_ONLY_REMOTE)).toBe('read')
  })

  it('maps WRITE_REMOTE to write', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(WRITE_REMOTE)).toBe('write')
  })

  it('maps DESTRUCTIVE_REMOTE to destructive', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(DESTRUCTIVE_REMOTE)).toBe('destructive')
  })

  it('defaults to destructive (fail-safe) for missing annotations', async () => {
    const { levelFromAnnotations } = await import('./access-level.js')
    expect(levelFromAnnotations(undefined)).toBe('destructive')
  })

  it('rejects an unknown MCP_NOTION_MIRROR_ACCESS_LEVEL at config load', async () => {
    process.env.MCP_NOTION_MIRROR_ACCESS_LEVEL = 'admin'
    await expect(import('../config.js')).rejects.toThrow(/Invalid MCP_NOTION_MIRROR_ACCESS_LEVEL="admin"/)
  })

  const makeStub = () => {
    const calls: string[] = []
    const stub = { registerTool: (name: string, _config: unknown, _handler: unknown) => calls.push(name) }
    return { calls, stub }
  }

  const registerSurface = (gated: ReturnType<typeof import('./access-level.js').makeAccessGatedRegister>) => {
    gated('notion_mirror_get', { title: 't', description: 'd', annotations: READ_ONLY_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('notion_mirror_publish', { title: 't', description: 'd', annotations: WRITE_REMOTE } as never, (async () => ({ content: [] })) as never)
    gated('notion_mirror_unpublish', { title: 't', description: 'd', annotations: DESTRUCTIVE_REMOTE } as never, (async () => ({ content: [] })) as never)
  }

  it('registers only read-level tools at gate=read', async () => {
    process.env.MCP_NOTION_MIRROR_ACCESS_LEVEL = 'read'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    registerSurface(makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0]))
    expect(calls).toEqual(['notion_mirror_get'])
  })

  it('registers read + write but not destructive by default (gate=write)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    registerSurface(makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0]))
    expect(calls).toEqual(['notion_mirror_get', 'notion_mirror_publish'])
  })

  it('registers every level when gate=destructive', async () => {
    process.env.MCP_NOTION_MIRROR_ACCESS_LEVEL = 'destructive'
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    registerSurface(makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0]))
    expect(calls).toEqual(['notion_mirror_get', 'notion_mirror_publish', 'notion_mirror_unpublish'])
  })

  it('treats an unannotated tool as destructive (fail-safe — skipped under default gate=write)', async () => {
    const { makeAccessGatedRegister } = await import('./access-level.js')
    const { calls, stub } = makeStub()
    const gated = makeAccessGatedRegister(stub as unknown as Parameters<typeof makeAccessGatedRegister>[0])
    gated('unannotated_tool', { title: 't', description: 'd' } as never, (async () => ({ content: [] })) as never)
    expect(calls).toEqual([])
  })
})
