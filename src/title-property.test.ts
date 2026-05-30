import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const DB_ID = '36f9f7187cc280f69272e60aa89bff24'
const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe('title-property', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(async () => {
    process.env.MCP_NOTION_MIRROR_TOKEN = 'ntn_secrettoken'
    process.env.MCP_NOTION_MIRROR_API_BASE_URL = 'https://api.notion.test'
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
    const { _clearTitlePropertyCache } = await import('./title-property.js')
    _clearTitlePropertyCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MCP_NOTION_MIRROR_API_BASE_URL
  })

  it('returns the name of the title-typed property', async () => {
    fetchMock.mockResolvedValueOnce(ok({ properties: { Tags: { id: 't', type: 'multi_select' }, Page: { id: 'p', type: 'title' } } }))
    const { getDatabaseTitleProperty } = await import('./title-property.js')
    expect(await getDatabaseTitleProperty(DB_ID)).toBe('Page')
    expect(fetchMock.mock.calls[0]?.[0]).toBe(`https://api.notion.test/v1/databases/${DB_ID}`)
  })

  it('caches the lookup (second call issues no request)', async () => {
    fetchMock.mockResolvedValueOnce(ok({ properties: { Name: { id: 'n', type: 'title' } } }))
    const { getDatabaseTitleProperty } = await import('./title-property.js')
    await getDatabaseTitleProperty(DB_ID)
    await getDatabaseTitleProperty(DB_ID)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('throws when the database has no title property', async () => {
    fetchMock.mockResolvedValueOnce(ok({ properties: { Tags: { id: 't', type: 'multi_select' } } }))
    const { getDatabaseTitleProperty } = await import('./title-property.js')
    await expect(getDatabaseTitleProperty(DB_ID)).rejects.toThrow(/no title property/)
  })
})
