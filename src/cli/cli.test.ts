/**
 * Process-level checks of the CLI's --dry-run refusal.
 *
 * The CLI runs `main()` on import, so it is exercised as a child process. The
 * environment pins a dummy token and a non-existent KB root (pre-set variables
 * are never overridden by the CLI's optional .env loading), so even a
 * regression could not reach a real workspace: without the refusal these
 * invocations would fail later, on configuration, with a different message.
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CLI = path.join(path.dirname(fileURLToPath(import.meta.url)), 'cli.ts')

const runCli = (...args: string[]) =>
  spawnSync('bun', [CLI, ...args], {
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH ?? '',
      MCP_KI_KB_NOTION_MIRROR_TOKEN: 'dummy-token-not-used',
      MCP_KI_KB_NOTION_MIRROR_KB_ROOT: path.join(path.sep, 'nonexistent', 'kb-root-for-dry-run-test')
    },
    timeout: 20_000
  })

describe('CLI --dry-run refusal', () => {
  it.each([
    ['roots', 'publish'],
    ['roots', 'update'],
    ['tree', 'baseline', 'Pillars'],
    ['note', 'touch', 'Pillars/Note.md']
  ])('refuses %s %s with --dry-run before loading configuration', (...args) => {
    const result = runCli(...args, '--dry-run')
    expect(result.status).toBe(2)
    expect(result.stderr).toContain('--dry-run is not supported')
    expect(result.stderr).toContain('Nothing was changed')
    expect(result.stdout).toBe('')
  })

  it('still reaches configuration for a supported preview verb', () => {
    const result = runCli('roots', 'prune', '--dry-run')
    expect(result.stderr).not.toContain('--dry-run is not supported')
  })
})
