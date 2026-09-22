# Developing the mirror

- [Local development](local-development.md) explains running the server from TypeScript source, how it loads environment files, and how to drive it through the MCP Inspector.
- [Definition of done](definition-of-done.md) states the delivery boundary and the complete verification gate a change clears before review.

This package is consumed from a local checkout. There is no publish step, no release workflow, and therefore no release guide.

For the architectural invariants a change has to respect — configuration injection, the stdout discipline, the annotation-driven access gate, and why frontmatter is edited by line surgery — read [`CLAUDE.md`](../../../CLAUDE.md). [`AGENTS.md`](../../../AGENTS.md) holds the short standing conventions.
