/** Local wikilink identities: exact root-relative path, then unique bare basename. */
export interface LinkIssue {
  source: string
  target: string
  candidates: string[]
}

/** Frontmatter, fenced/indented code, inline code and escaped openings are not edges. */
export const wikilinkTargets = (raw: string): string[] => {
  let fence = ''
  const body = raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
  const prose = body
    .split('\n')
    .map((line) => {
      const marker = /^(?: {0,3}> ?)* {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
      if (marker) {
        if (!fence) fence = marker
        else if (
          marker[0] === fence[0] &&
          marker.length >= fence.length &&
          /^\s*$/.test(line.slice(line.indexOf(marker) + marker.length))
        )
          fence = ''
        return ''
      }
      return fence || /^(?: {4}|\t)/.test(line) ? '' : line
    })
    .join('\n')
  let visible = ''
  for (let i = 0; i < prose.length; ) {
    if (prose[i] === '`') {
      const start = i
      while (prose[i] === '`') i++
      const marker = prose.slice(start, i)
      const rest = prose.slice(i)
      const close = new RegExp(`(?<!\x60)${marker}(?!\x60)`).exec(rest)
      if (close) {
        i += close.index + marker.length
        visible += ' '
        continue
      }
      visible += marker
    } else {
      visible += prose[i]
      i++
    }
  }
  const out: string[] = []
  for (const match of visible.matchAll(/\[\[([^[\]\n|]+)(?:\|[^[\]\n]+)?\]\]/g)) {
    const prefix = visible.slice(0, match.index)
    const slashes = (/\\*$/.exec(prefix) as RegExpExecArray)[0].length
    if (slashes % 2 === 0) out.push((match[1] as string).trim().split('#')[0] as string)
  }
  return out
}

export const buildGraph = (
  notes: Map<string, string>,
  maxRefs: number
): {
  incoming: Map<string, string[]>
  unresolved: LinkIssue[]
  ambiguous: LinkIssue[]
  references: number
} => {
  const paths = new Map<string, string>()
  const basenames = new Map<string, string[]>()
  const incoming = new Map<string, Set<string>>()
  for (const p of notes.keys()) {
    paths.set(p.replace(/\.md$/, ''), p)
    const base = p.slice(p.lastIndexOf('/') + 1).replace(/\.md$/, '')
    basenames.set(base, [...(basenames.get(base) ?? []), p])
    incoming.set(p, new Set())
  }
  const unresolved: LinkIssue[] = []
  const ambiguous: LinkIssue[] = []
  let references = 0
  let diagnostics = 0
  for (const [source, raw] of notes) {
    for (const target of wikilinkTargets(raw)) {
      if (++references > maxRefs) throw new Error('Backlink reference bound exceeded; scan is incomplete.')
      const identity = target.replace(/\.md$/, '')
      const exact = paths.get(identity)
      const candidates =
        target === '' ? [source] : exact ? [exact] : identity.includes('/') ? [] : (basenames.get(identity) ?? [])
      if (candidates.length === 1) (incoming.get(candidates[0] as string) as Set<string>).add(source)
      else {
        diagnostics += Math.max(1, candidates.length)
        if (diagnostics > maxRefs) throw new Error('Backlink diagnostic result bound exceeded; scan is incomplete.')
        ;(candidates.length ? ambiguous : unresolved).push({ source, target, candidates: [...candidates].sort() })
      }
    }
  }
  return {
    incoming: new Map([...incoming].map(([p, sources]) => [p, [...sources].sort()])),
    unresolved,
    ambiguous,
    references
  }
}
