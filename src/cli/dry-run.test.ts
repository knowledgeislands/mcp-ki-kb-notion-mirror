import { describe, expect, it } from 'vitest'
import { unsupportedDryRunError } from './dry-run.js'

describe('unsupportedDryRunError', () => {
  it.each([
    ['note', 'touch'],
    ['note', 'update'],
    ['note', 'move'],
    ['tree', 'touch'],
    ['tree', 'update'],
    ['tree', 'baseline'],
    ['roots', 'touch'],
    ['roots', 'update'],
    ['roots', 'publish'],
    ['roots', 'baseline']
  ])('refuses --dry-run on %s %s, which has no preview mode', (resource, verb) => {
    const message = unsupportedDryRunError(resource, verb, true)
    expect(message).toContain(`"${resource} ${verb}"`)
    expect(message).toContain('Nothing was changed')
    expect(message).toContain('note delete, tree delete, tree prune, roots delete, roots prune')
  })

  it.each([
    ['note', 'delete'],
    ['tree', 'delete'],
    ['tree', 'prune'],
    ['roots', 'delete'],
    ['roots', 'prune']
  ])('accepts --dry-run on the %s %s preview', (resource, verb) => {
    expect(unsupportedDryRunError(resource, verb, true)).toBeNull()
  })

  it.each([
    ['note', 'get'],
    ['note', 'status'],
    ['note', 'preflight'],
    ['note', 'diff'],
    ['tree', 'status'],
    ['tree', 'preflight'],
    ['roots', 'list']
  ])('leaves read-only %s %s unaffected', (resource, verb) => {
    expect(unsupportedDryRunError(resource, verb, true)).toBeNull()
  })

  it('leaves unknown resources and verbs to the dispatcher usage error', () => {
    expect(unsupportedDryRunError('roots', 'nonsense', true)).toBeNull()
    expect(unsupportedDryRunError('nonsense', 'publish', true)).toBeNull()
  })

  it('never refuses when --dry-run was not supplied', () => {
    expect(unsupportedDryRunError('roots', 'publish', false)).toBeNull()
    expect(unsupportedDryRunError('note', 'update', false)).toBeNull()
  })
})
