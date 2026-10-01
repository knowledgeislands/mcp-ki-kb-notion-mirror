import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { expect, it } from 'vitest'
import type { Config } from '../../src/config/index.js'
import { archivePage, createPage, getPage, NotionApiError } from '../../src/main/notion-client/index.js'
import { deleteNote, getNote, moveNote, statusNote, touchNote, updateNote } from '../../src/main/notes/index.js'
import { parseLiveGate, withOwnedPages } from './support.js'

const NOTE_BODY = 'Alpha body for disposable Beta review.'

it('smokes a created note and observes a cross-parent-type move', async () => {
  // The complete gate runs before temp files, config, client calls, or remote fixtures.
  const gate = parseLiveGate(process.env)
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'ki-notion-live-'))
  const cfg: Config = {
    notionToken: gate.token,
    notionApiBaseUrl: 'https://api.notion.com',
    notionApiVersion: '2022-06-28',
    kbRoot: temp,
    bannerTemplate: '',
    mirror: { skipPrefixes: [], skipKbPaths: new Set(), iconBaseUrl: 'https://example.invalid/icons/' },
    accessLevel: 'write',
    auditLogMode: 'off',
    auditLogPath: path.join(temp, 'audit.jsonl'),
    auditLogMaxBytes: 0,
    auditLogKeep: 0
  }
  const runId = randomUUID()
  try {
    await withOwnedPages(
      (id) => archivePage(cfg, id),
      async (ledger) => {
        const fixtureParent = await createPage(cfg, {
          parent: { type: 'page_id', page_id: gate.pageParentId }, title: `Alpha live ${runId}`, children: []
        })
        ledger.track(fixtureParent.id)

        const kbPath = `Alpha-${runId}.md`
        await fs.writeFile(path.join(temp, kbPath), `---\nstatus: current\n---\n# Alpha\n\n${NOTE_BODY}\n`)
        const databaseParent = { type: 'database_id' as const, database_id: gate.databaseParentId }
        const touched = await touchNote(cfg, kbPath, databaseParent)
        expect(touched).toHaveProperty('page_id')
        if (!('page_id' in touched)) throw new Error('Touch did not create a fixture page.')
        ledger.track(touched.page_id)

        const updated = await updateNote(cfg, kbPath, databaseParent)
        expect(updated).toHaveProperty('page_id', touched.page_id)
        expect(await statusNote(cfg, kbPath)).toMatchObject({ published: true })
        expect(await getNote(cfg, kbPath)).toBeDefined()

        let moveOutcome: 'rejected' | 'silently-ignored-and-caught' | 'supported'
        try {
          const moved = await moveNote(cfg, kbPath, { type: 'page_id', page_id: fixtureParent.id })
          const after = await getPage(cfg, touched.page_id)
          if (!moved.moved || after.parent.type !== 'page_id' || after.parent.page_id !== fixtureParent.id) {
            throw new Error('Move result disagrees with the observed postcondition.')
          }
          moveOutcome = 'supported'
        } catch (error) {
          if (error instanceof NotionApiError && (error.status === 400 || error.status === 409)) {
            moveOutcome = 'rejected'
          } else if (error instanceof Error && error.message.includes('silently ignored the parent change')) {
            const after = await getPage(cfg, touched.page_id)
            if (after.parent.type !== 'database_id' || after.parent.database_id !== gate.databaseParentId) {
              throw new Error('Silent-move detection disagrees with the observed postcondition.')
            }
            moveOutcome = 'silently-ignored-and-caught'
          } else {
            throw error
          }
        }
        console.log(`Disposable Notion cross-parent move outcome: ${moveOutcome}`)

        const deleted = await deleteNote(cfg, kbPath, false)
        expect(deleted).toMatchObject({ archived: true, page_id: touched.page_id })
        expect((await getPage(cfg, touched.page_id)).archived).toBe(true)
        ledger.release(touched.page_id)
      },
      [gate.token, NOTE_BODY]
    )
  } finally {
    await fs.rm(temp, { recursive: true, force: true })
  }
})
