import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PARENT = 'a'.repeat(32)
const CHILD_A = 'b'.repeat(32)
const CHILD_B = 'c'.repeat(32)
const SENT = 'd'.repeat(32)
const OLD_BULLET = 'e'.repeat(32)
const CHILD_NEW = 'f'.repeat(32)

const childPage = (id: string, title: string) => ({ id, type: 'child_page', child_page: { title } })
const sentinel = (id: string) => ({ id, type: 'heading_2', heading_2: { rich_text: [{ plain_text: '📂 Child Pages' }] } })
const oldBullet = (id: string) => ({ id, type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'old' }] } })

const childrenPage = (results: unknown[], next: string | null = null) => new Response(JSON.stringify({ results, has_more: next !== null, next_cursor: next }), { status: 200 })
const ok = (body: unknown = {}) => new Response(JSON.stringify(body), { status: 200 })

interface Call {
  method: string
  url: string
  body?: unknown
}

describe('footer', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  const calls: Call[] = []

  beforeEach(() => {
    process.env.MCP_NOTION_MIRROR_TOKEN = 'ntn_secrettoken'
    process.env.MCP_NOTION_MIRROR_API_BASE_URL = 'https://api.notion.test'
    calls.length = 0
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.resetModules()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MCP_NOTION_MIRROR_API_BASE_URL
  })

  describe('buildFooterBlocks', () => {
    it('returns [] for no children (no orphan heading)', async () => {
      const { buildFooterBlocks } = await import('./footer.js')
      expect(buildFooterBlocks([])).toEqual([])
    })

    it('returns the sentinel heading then one mention bullet per child', async () => {
      const { buildFooterBlocks, SENTINEL_TEXT } = await import('./footer.js')
      const blocks = buildFooterBlocks([
        { id: CHILD_A, title: 'A' },
        { id: CHILD_B, title: 'B' }
      ])
      expect(blocks).toHaveLength(3)
      expect((blocks[0] as unknown as { heading_2: { rich_text: Array<{ text: { content: string } }> } }).heading_2.rich_text[0].text.content).toBe(SENTINEL_TEXT)
      expect((blocks[1] as unknown as { bulleted_list_item: { rich_text: Array<{ mention: { page: { id: string } } }> } }).bulleted_list_item.rich_text[0].mention.page.id).toBe(CHILD_A)
      expect((blocks[2] as unknown as { bulleted_list_item: { rich_text: Array<{ mention: { page: { id: string } } }> } }).bulleted_list_item.rich_text[0].mention.page.id).toBe(CHILD_B)
    })
  })

  describe('refreshFooter', () => {
    // Route a single fetch call, recording it, and reply by method + URL.
    const route = (children: unknown[][]) => {
      let getCount = 0
      fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
        const method = init?.method ?? 'GET'
        calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined })
        if (method === 'GET') {
          const pageIdx = Math.min(getCount, children.length - 1)
          getCount++
          // children is an array of pages; last page has next_cursor null
          const next = pageIdx < children.length - 1 ? `cur${pageIdx}` : null
          return childrenPage(children[pageIdx], next)
        }
        return ok()
      })
    }

    it('appends a child-pages footer when there is no prior sentinel', async () => {
      route([[childPage(CHILD_A, 'A'), childPage(CHILD_B, 'B')]])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
      const patch = calls.find((c) => c.method === 'PATCH')
      expect(patch?.url).toBe(`https://api.notion.test/v1/blocks/${PARENT}/children`)
      const appended = (patch?.body as { children: Array<{ type: string }> }).children
      expect(appended.map((b) => b.type)).toEqual(['heading_2', 'bulleted_list_item', 'bulleted_list_item'])
    })

    it('deletes the prior footer (sentinel + its bullets) before appending, sparing child pages', async () => {
      route([[childPage(CHILD_A, 'A'), sentinel(SENT), oldBullet(OLD_BULLET)]])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      const deleted = calls.filter((c) => c.method === 'DELETE').map((c) => c.url)
      expect(deleted).toEqual([`https://api.notion.test/v1/blocks/${SENT}`, `https://api.notion.test/v1/blocks/${OLD_BULLET}`])
      expect(deleted.some((u) => u.includes(CHILD_A))).toBe(false)
      expect(calls.some((c) => c.method === 'PATCH')).toBe(true)
    })

    it('spares a child_page that was created after the footer', async () => {
      route([[sentinel(SENT), oldBullet(OLD_BULLET), childPage(CHILD_NEW, 'New')]])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      const deleted = calls.filter((c) => c.method === 'DELETE').map((c) => c.url)
      expect(deleted).toEqual([`https://api.notion.test/v1/blocks/${SENT}`, `https://api.notion.test/v1/blocks/${OLD_BULLET}`])
      const patch = calls.find((c) => c.method === 'PATCH')
      const appended = (patch?.body as { children: Array<{ bulleted_list_item?: { rich_text: Array<{ mention: { page: { id: string } } }> } }> }).children
      expect(appended[1].bulleted_list_item?.rich_text[0].mention.page.id).toBe(CHILD_NEW)
    })

    it('deletes the old footer and appends nothing when there are no child pages', async () => {
      route([[sentinel(SENT), oldBullet(OLD_BULLET)]])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(2)
      expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    })

    it('follows pagination across multiple GET pages', async () => {
      route([[childPage(CHILD_A, 'A')], [childPage(CHILD_B, 'B')]])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      const gets = calls.filter((c) => c.method === 'GET')
      expect(gets).toHaveLength(2)
      expect(gets[1].url).toContain('start_cursor=cur0')
      const appended = (calls.find((c) => c.method === 'PATCH')?.body as { children: unknown[] }).children
      expect(appended).toHaveLength(3) // heading + A + B
    })

    it('serialises refreshes for the same parent (no interleaving)', async () => {
      route([[childPage(CHILD_A, 'A')]])
      const { refreshFooter } = await import('./footer.js')
      await Promise.all([refreshFooter(PARENT), refreshFooter(PARENT)])
      // With a per-parent lock the calls run GET,PATCH,GET,PATCH — not GET,GET,…
      expect(calls.map((c) => c.method)).toEqual(['GET', 'PATCH', 'GET', 'PATCH'])
    })

    it('tolerates odd heading blocks and untitled child pages when scanning for the sentinel', async () => {
      route([
        [
          { id: 'h1', type: 'heading_2' }, // no inner object
          { id: 'h2', type: 'heading_2', heading_2: { rich_text: [{}] } }, // item without plain_text
          { id: CHILD_A, type: 'child_page', child_page: {} } // child page without a title
        ]
      ])
      const { refreshFooter } = await import('./footer.js')
      await refreshFooter(PARENT)
      expect(calls.filter((c) => c.method === 'DELETE')).toHaveLength(0) // no sentinel matched
      const appended = (calls.find((c) => c.method === 'PATCH')?.body as { children: Array<{ bulleted_list_item?: { rich_text: Array<{ mention: { page: { id: string } } }> } }> }).children
      expect(appended[1].bulleted_list_item?.rich_text[0].mention.page.id).toBe(CHILD_A)
    })

    it('continues the per-parent chain after a failed refresh (lock survives rejection)', async () => {
      let n = 0
      fetchMock.mockImplementation(async (url: string, init?: { method?: string; body?: string }) => {
        const method = init?.method ?? 'GET'
        calls.push({ method, url })
        n++
        if (n === 1) return new Response(JSON.stringify({ code: 'x', message: 'boom' }), { status: 500 }) // first refresh's GET fails
        if (method === 'GET') return childrenPage([childPage(CHILD_A, 'A')])
        return ok()
      })
      const { refreshFooter } = await import('./footer.js')
      const [first, second] = await Promise.allSettled([refreshFooter(PARENT), refreshFooter(PARENT)])
      expect(first.status).toBe('rejected') // its own GET 500 surfaced to the caller
      expect(second.status).toBe('fulfilled') // chain survived and the second refresh completed
    })
  })
})
