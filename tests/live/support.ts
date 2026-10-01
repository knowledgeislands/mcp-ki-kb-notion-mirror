/** Test-only gate and ownership ledger. Never import this into product runtime. */
const OPT_IN = 'yes-i-am-using-disposable-parents'
const NOTION_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/i

export type LiveGate = { token: string; pageParentId: string; databaseParentId: string }

export const parseLiveGate = (env: NodeJS.ProcessEnv): LiveGate => {
  if (env.KI_NOTION_LIVE_RUN !== OPT_IN) throw new Error(`Live Notion suite is disabled. Set KI_NOTION_LIVE_RUN=${OPT_IN} explicitly.`)
  const token = env.KI_NOTION_LIVE_TOKEN?.trim()
  const pageParentId = env.KI_NOTION_LIVE_PAGE_PARENT_ID?.trim()
  const databaseParentId = env.KI_NOTION_LIVE_DATABASE_PARENT_ID?.trim()
  if (!token || !pageParentId || !databaseParentId) {
    throw new Error('Live Notion suite requires a dedicated KI_NOTION_LIVE_TOKEN and disposable page/database parent IDs.')
  }
  if (!NOTION_ID.test(pageParentId) || !NOTION_ID.test(databaseParentId) || pageParentId.replaceAll('-', '').toLowerCase() === databaseParentId.replaceAll('-', '').toLowerCase()) {
    throw new Error('Live Notion suite requires distinct valid disposable page and database parent IDs.')
  }
  return { token, pageParentId, databaseParentId }
}

export type PageLedger = { track: (id: string) => void; release: (id: string) => void }

const safeError = (error: unknown, secrets: readonly string[]): string => {
  const name = error instanceof Error ? error.name : 'Failure'
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of secrets) if (secret) message = message.replaceAll(secret, '[redacted]')
  message = message.replace(/Authorization:\s*Bearer\s+\S+/gi, 'Authorization: Bearer [redacted]')
  return `${name}: ${message}`
}

export const withOwnedPages = async <T>(
  archive: (id: string) => Promise<void>,
  run: (ledger: PageLedger) => Promise<T>,
  secrets: readonly string[] = []
): Promise<T> => {
  const owned: string[] = []
  const ledger: PageLedger = {
    track(id) {
      if (!NOTION_ID.test(id) || owned.includes(id)) throw new Error('Fixture page ID is invalid or already tracked.')
      owned.push(id)
    },
    release(id) {
      const index = owned.indexOf(id)
      if (index < 0) throw new Error('Cannot release a page not created by this live run.')
      owned.splice(index, 1)
    }
  }
  let failed = false
  let primary: unknown
  let result: T | undefined
  try {
    result = await run(ledger)
  } catch (error) {
    failed = true
    primary = error
  }
  const residual: string[] = []
  for (const id of owned.reverse()) {
    try {
      await archive(id)
    } catch {
      residual.push(id)
    }
  }
  if (failed || residual.length) {
    const reason = failed ? safeError(primary, secrets) : 'Live fixture cleanup failed.'
    throw new Error(`${reason}${residual.length ? ` Cleanup left page IDs: ${residual.join(', ')}.` : ''}`)
  }
  return result as T
}
