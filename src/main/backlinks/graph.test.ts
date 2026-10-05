import { describe, expect, it } from 'vitest'
import { buildGraph, wikilinkTargets } from './graph.js'

describe('local backlink grammar and identities', () => {
  it('ignores generated frontmatter, fences, indentation, inline code and escaped openings', () => {
    expect(
      wikilinkTargets(
        '---\nfield: [[Gamma]]\n---\n[[ Alpha#Heading |alias]] [[Beta.md#^block]] [[#self]]\n```js\n[[Gamma]]\n~~~\n[[Gamma]]\n```\n~~~\n[[Gamma]]\n~~~\n    [[Gamma]]\n\t[[Gamma]]\n`[[Gamma]]` ``[[Gamma]] ` nested`` \\[[Gamma]] \\\\[[Beta]]\n`unclosed [[Alpha]]'
      )
    ).toEqual(['Alpha', 'Beta.md', '', 'Beta', 'Alpha'])
    expect(wikilinkTargets('> ```\n[[Alpha]]\n> ```\n[[Beta]]\n````\n[[Alpha]]\n```\n[[Alpha]]\n````')).toEqual([
      'Beta'
    ])
    expect(wikilinkTargets('text only')).toEqual([])
    expect(wikilinkTargets('---\r\nfield: [[Alpha]]\r\n---\r\n[[Beta]]')).toEqual(['Beta'])
    expect(wikilinkTargets('```\n```still code\n[[Alpha]]\n```\n[[Beta]]')).toEqual(['Beta'])
  })
  it('resolves exact paths before basenames without collisions or source authority from generated fields', () => {
    const notes = new Map([
      ['Alpha.md', '[[Omega/Beta]] [[Beta]] [[Missing]] [[Gamma/Absent]] [[#self]] [[Omega/Beta.md|alias]]'],
      ['Omega/Beta.md', '[[Alpha]] [[Alpha.md]]'],
      ['Gamma/Beta.md', ''],
      ['Gamma.md', '[[Beta]]']
    ])
    const result = buildGraph(notes, 20)
    expect(result.incoming.get('Omega/Beta.md')).toEqual(['Alpha.md'])
    expect(result.incoming.get('Alpha.md')).toEqual(['Alpha.md', 'Omega/Beta.md'])
    expect(result.ambiguous).toHaveLength(2)
    expect(result.ambiguous[0]?.candidates).toEqual(['Gamma/Beta.md', 'Omega/Beta.md'])
    expect(result.unresolved.map((x) => x.target)).toEqual(['Missing', 'Gamma/Absent'])
    expect(() =>
      buildGraph(
        new Map([
          ['Alpha.md', '[[Beta]]'],
          ['Omega/Beta.md', ''],
          ['Gamma/Beta.md', '']
        ]),
        1
      )
    ).toThrow('diagnostic result bound')
    expect(() => buildGraph(new Map([['Alpha.md', '[[Alpha]] [[Alpha]]']]), 1)).toThrow('reference bound')
  })
})
