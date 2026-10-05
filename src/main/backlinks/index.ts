import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { atomicWriteFile } from '../../utils/atomic-write.js'
import { resolveKbNotePath } from '../../utils/paths.js'
import { parseFrontmatter, upsertFrontmatterFields } from '../notes/frontmatter.js'
import { buildGraph, type LinkIssue } from './graph.js'

export const BACKLINKS_FIELD = 'kb_notion_mirror_backlinks'
const LIMITS = {
  entries: 10000,
  files: 2000,
  fileBytes: 1024 * 1024,
  bytes: 32 * 1024 * 1024,
  refs: 20000,
  results: 20000,
  depth: 32
}
const safePath = (p: string): boolean =>
  p.length <= 4096 &&
  // biome-ignore lint/suspicious/noControlCharactersInRegex: Reject control characters in filesystem identities.
  !/[\u0000-\u001f\\]/.test(p) &&
  !p.split('/').some((s) => s === '..' || s === '.' || s === '') &&
  p.endsWith('.md')

/** Only the canonical v1 JSON scalar is generated-owned; never consume arbitrary YAML. */
const fieldValue = (raw: string, sources: string[]): string => {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw)
  if (!fm) throw new Error('Note has no LF YAML frontmatter; refusing to invent it.')
  const lines = (fm[1] as string).split('\n')
  const owned = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.startsWith(`${BACKLINKS_FIELD}:`))
  if (
    lines.some(
      (line) =>
        new RegExp(`^[ \t-]*["']?${BACKLINKS_FIELD}["']?\\s*:`).test(line) && !line.startsWith(`${BACKLINKS_FIELD}:`)
    )
  ) {
    throw new Error('Unsafe generated backlinks field spelling or nesting.')
  }
  if (owned.length > 1) throw new Error('Duplicate generated backlinks field.')
  if (owned.length === 1) {
    const { line, index } = owned[0] as { line: string; index: number }
    for (const next of lines.slice(index + 1)) {
      if (next.trim() === '' || next.startsWith('#')) continue
      if (/^[ \t-]/.test(next)) throw new Error('Multiline generated backlinks field is unsafe.')
      break
    }
    const scalar = line.slice(BACKLINKS_FIELD.length + 1).trim()
    let decoded: unknown
    try {
      decoded = JSON.parse(JSON.parse(scalar) as string)
    } catch {
      throw new Error('Unsafe generated backlinks scalar.')
    }
    const value = decoded as { v?: unknown; sources?: unknown } | null
    if (
      value?.v !== 1 ||
      !Array.isArray(value.sources) ||
      value.sources.length > LIMITS.results ||
      !value.sources.every((p: unknown) => typeof p === 'string' && safePath(p)) ||
      JSON.stringify(value) !== JSON.stringify({ v: 1, sources: [...new Set(value.sources)].sort() }) ||
      scalar !== JSON.stringify(JSON.stringify(value))
    ) {
      throw new Error('Unsafe or unsupported generated backlinks value.')
    }
  }
  return JSON.stringify(JSON.stringify({ v: 1, sources }))
}

interface Snapshot {
  root: string
  notes: Map<string, string>
  membership: string[]
  bytes: number
}
const scan = async (kbRoot: string | undefined): Promise<Snapshot> => {
  if (!kbRoot) throw new Error('MCP_KI_KB_NOTION_MIRROR_KB_ROOT must be set for backlinks.')
  const root = resolveKbNotePath(kbRoot, kbRoot)
  const notes = new Map<string, string>()
  const membership: string[] = []
  let entries = 0
  let bytes = 0
  const walk = async (dir: string, depth: number): Promise<void> => {
    for (const name of (await fs.readdir(dir)).sort()) {
      if (name.startsWith('.') || name === 'node_modules') continue
      if (++entries > LIMITS.entries) throw new Error('Backlink entry bound exceeded; scan is incomplete.')
      const absolute = path.join(dir, name)
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      const st = await fs.lstat(absolute)
      if (st.isSymbolicLink()) throw new Error(`Symlink in backlink scope is unsafe: ${relative}`)
      if (resolveKbNotePath(root, absolute) !== absolute) throw new Error(`Backlink path drift: ${relative}`)
      membership.push(relative)
      if (st.isDirectory()) {
        if (depth >= LIMITS.depth) throw new Error('Backlink depth bound exceeded; scan is incomplete.')
        await walk(absolute, depth + 1)
      } else if (st.isFile() && name.endsWith('.md')) {
        if (!safePath(relative)) throw new Error(`Unsafe backlink note path: ${relative}`)
        if (notes.size >= LIMITS.files || st.size > LIMITS.fileBytes)
          throw new Error('Backlink file bound exceeded; scan is incomplete.')
        const buffer = await fs.readFile(absolute)
        bytes += buffer.length
        if (buffer.length > LIMITS.fileBytes || bytes > LIMITS.bytes)
          throw new Error('Backlink byte bound exceeded; scan is incomplete.')
        const raw = buffer.toString('utf8')
        if (!buffer.equals(Buffer.from(raw))) throw new Error(`Non-UTF8 backlink source: ${relative}`)
        notes.set(relative, raw)
      } else if (!st.isFile()) throw new Error(`Nonregular backlink scope entry: ${relative}`)
    }
  }
  await walk(root, 0)
  return { root, notes, membership, bytes }
}

export interface BacklinksReport {
  scope: 'visible-markdown-under-kb-root'
  scan_complete: true
  resolution_complete: boolean
  dry_run: boolean
  note_count: number
  reference_count: number
  unresolved: LinkIssue[]
  ambiguous: LinkIssue[]
  skipped_without_frontmatter: string[]
  proposals: { kb_path: string; sources: string[]; changed: boolean }[]
  written: string[]
}

export class BacklinksWriteError extends Error {
  constructor(
    public readonly written: string[],
    cause: unknown
  ) {
    super(`Backlinks write failed; files already written: ${JSON.stringify(written)}. ${String(cause)}`, { cause })
    this.name = 'BacklinksWriteError'
  }
}

/** Whole-scope graph, optional single write target; no Notion dependency. */
export const syncBacklinks = async (
  cfg: { kbRoot: string | undefined },
  options: { kb_path?: string; dry_run?: boolean } = {}
): Promise<BacklinksReport> => {
  const snapshot = await scan(cfg.kbRoot)
  const graph = buildGraph(snapshot.notes, LIMITS.refs)
  let targets: string[]
  if (options.kb_path !== undefined) {
    const absolute = resolveKbNotePath(snapshot.root, options.kb_path)
    const relative = path.relative(snapshot.root, absolute).split(path.sep).join('/')
    if (!snapshot.notes.has(relative)) throw new Error('Backlink target is outside the visible Markdown scan scope.')
    targets = [relative]
  } else
    targets = [...snapshot.notes.keys()].filter((p) => parseFrontmatter(snapshot.notes.get(p) as string).hasFrontmatter)
  const edits = new Map<string, string>()
  let resultingBytes = snapshot.bytes
  const proposals = targets.map((p) => {
    const raw = snapshot.notes.get(p) as string
    const sources = graph.incoming.get(p) as string[]
    const value = fieldValue(raw, sources)
    const next =
      parseFrontmatter(raw).fields[BACKLINKS_FIELD] !== undefined
        ? upsertFrontmatterFields(raw, { [BACKLINKS_FIELD]: value })
        : raw.replace(
            /^(---\n[\s\S]*?)(\n---\n)/,
            (_match, head: string, end: string) => `${head}\n${BACKLINKS_FIELD}: ${value}${end}`
          )
    const nextBytes = Buffer.byteLength(next)
    if (nextBytes > LIMITS.fileBytes)
      throw new Error('Backlink generated output exceeds the per-file byte bound; no files were written.')
    resultingBytes += nextBytes - Buffer.byteLength(raw)
    if (next !== raw) edits.set(p, next)
    return { kb_path: p, sources, changed: next !== raw }
  })
  if (resultingBytes > LIMITS.bytes)
    throw new Error('Backlink generated output exceeds the total scope byte bound; no files were written.')
  const report: BacklinksReport = {
    scope: 'visible-markdown-under-kb-root',
    scan_complete: true,
    resolution_complete: graph.unresolved.length === 0 && graph.ambiguous.length === 0,
    dry_run: options.dry_run !== false,
    note_count: snapshot.notes.size,
    reference_count: graph.references,
    unresolved: graph.unresolved,
    ambiguous: graph.ambiguous,
    skipped_without_frontmatter: [...snapshot.notes.keys()].filter(
      (p) => !parseFrontmatter(snapshot.notes.get(p) as string).hasFrontmatter
    ),
    proposals,
    written: []
  }
  if (report.dry_run) return report
  if (graph.ambiguous.length) throw new Error('Ambiguous wikilinks block backlink writes; inspect preview diagnostics.')
  const fresh = await scan(cfg.kbRoot)
  if (
    fresh.root !== snapshot.root ||
    JSON.stringify(fresh.membership) !== JSON.stringify(snapshot.membership) ||
    [...snapshot.notes].some(([p, raw]) => fresh.notes.get(p) !== raw)
  ) {
    throw new Error('Backlink source or membership drift; no files were written.')
  }
  try {
    for (const [p, next] of edits) {
      const absolute = path.join(snapshot.root, p)
      if (
        resolveKbNotePath(snapshot.root, absolute) !== absolute ||
        (await fs.lstat(absolute)).isSymbolicLink() ||
        (await fs.readFile(absolute, 'utf8')) !== snapshot.notes.get(p)
      ) {
        throw new Error(`Backlink target drift: ${p}`)
      }
      await atomicWriteFile(absolute, next)
      report.written.push(p)
    }
  } catch (cause) {
    throw new BacklinksWriteError([...report.written], cause)
  }
  return report
}
