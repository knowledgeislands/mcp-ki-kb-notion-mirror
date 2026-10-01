import { describe, expect, it, vi } from 'vitest'
import { parseLiveGate, withOwnedPages } from '../../tests/live/support.js'

const ALPHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const BETA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
const GAMMA = 'cccccccccccccccccccccccccccccccc'
const optIn = 'yes-i-am-using-disposable-parents'
const valid = {
  KI_NOTION_LIVE_RUN: optIn,
  KI_NOTION_LIVE_TOKEN: 'dedicated-fixture-token',
  KI_NOTION_LIVE_PAGE_PARENT_ID: ALPHA,
  KI_NOTION_LIVE_DATABASE_PARENT_ID: BETA
}

describe('live suite opt-in gate', () => {
  it('does not activate from an ambient production-looking token', () => {
    const network = vi.fn()
    const env = { MCP_KI_KB_NOTION_MIRROR_TOKEN: 'production-looking-token' }
    expect(() => parseLiveGate(env)).toThrow('disabled')
    expect(network).not.toHaveBeenCalled()
  })

  it.each([
    { ...valid, KI_NOTION_LIVE_TOKEN: '' },
    { ...valid, KI_NOTION_LIVE_PAGE_PARENT_ID: '' },
    { ...valid, KI_NOTION_LIVE_DATABASE_PARENT_ID: '' }
  ])('requires every dedicated prerequisite', (env) => {
    expect(() => parseLiveGate(env)).toThrow('requires a dedicated')
  })

  it.each([
    { ...valid, KI_NOTION_LIVE_PAGE_PARENT_ID: 'not-an-id' },
    { ...valid, KI_NOTION_LIVE_DATABASE_PARENT_ID: 'not-an-id' },
    { ...valid, KI_NOTION_LIVE_DATABASE_PARENT_ID: ALPHA }
  ])('requires distinct valid disposable parents', (env) => {
    expect(() => parseLiveGate(env)).toThrow('distinct valid')
  })

  it('returns only dedicated values after complete opt-in', () => {
    expect(parseLiveGate(valid)).toEqual({
      token: 'dedicated-fixture-token',
      pageParentId: ALPHA,
      databaseParentId: BETA
    })
  })
})

describe('live suite owned-page ledger', () => {
  it('archives only pages created during the run, in reverse order', async () => {
    const archive = vi.fn().mockResolvedValue(undefined)
    const result = await withOwnedPages(archive, async (ledger) => {
      ledger.track(ALPHA)
      ledger.track(BETA)
      return 'complete'
    })
    expect(result).toBe('complete')
    expect(archive.mock.calls).toEqual([[BETA], [ALPHA]])
  })

  it('does not archive a caller parent or a released page', async () => {
    const archive = vi.fn().mockResolvedValue(undefined)
    await withOwnedPages(archive, async (ledger) => {
      ledger.track(GAMMA)
      ledger.release(GAMMA)
    })
    expect(archive).not.toHaveBeenCalled()
  })

  it('cleans an owned first page after a partial setup failure', async () => {
    const archive = vi.fn().mockResolvedValue(undefined)
    await expect(
      withOwnedPages(archive, async (ledger) => {
        ledger.track(GAMMA)
        throw new Error('second fixture creation failed')
      })
    ).rejects.toThrow('second fixture creation failed')
    expect(archive).toHaveBeenCalledExactlyOnceWith(GAMMA)
  })

  it('reports the original failure and residual owned ID without leaking secret content', async () => {
    const archive = vi.fn().mockRejectedValue(new Error('Authorization: Bearer secret-token with Alpha content'))
    await expect(
      withOwnedPages(
        archive,
        async (ledger) => {
          ledger.track(GAMMA)
          throw new Error('setup failed with secret-token and Alpha content')
        },
        ['secret-token', 'Alpha content']
      )
    ).rejects.toThrow(`Error: setup failed with [redacted] and [redacted] Cleanup left page IDs: ${GAMMA}.`)
    expect(archive).toHaveBeenCalledExactlyOnceWith(GAMMA)
  })

  it('reports a cleanup-only failure by residual ID', async () => {
    const archive = vi.fn().mockRejectedValue(new Error('secret-token'))
    await expect(
      withOwnedPages(
        archive,
        async (ledger) => {
          ledger.track(ALPHA)
        },
        ['secret-token']
      )
    ).rejects.toThrow(`Cleanup left page IDs: ${ALPHA}.`)
  })

  it('rejects invalid, duplicate, and unowned IDs before they can be archived', async () => {
    const archive = vi.fn().mockResolvedValue(undefined)
    await expect(withOwnedPages(archive, async (ledger) => ledger.track('bad-id'))).rejects.toThrow(
      'invalid or already tracked'
    )
    await expect(
      withOwnedPages(archive, async (ledger) => {
        ledger.track(ALPHA)
        ledger.track(ALPHA)
      })
    ).rejects.toThrow('invalid or already tracked')
    await expect(withOwnedPages(archive, async (ledger) => ledger.release(BETA))).rejects.toThrow(
      'not created by this live run'
    )
    expect(archive).toHaveBeenCalledExactlyOnceWith(ALPHA)
  })
})
