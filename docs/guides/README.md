# mcp-ki-kb-notion-mirror guides

These guides explain how to run this MCP server against your own knowledge base and how to change its code. Every practical instruction about the server lives here, under the audience that needs it. [`README.md`](../../README.md) orients — what the server is and what its tools do — and sends you here to act.

- [User guides](user/README.md) cover installing the server, giving it a Notion integration, mirroring a knowledge base, what the mirror will and will not touch, and recovering when a publish fails.
- [Developer guides](developer/README.md) cover local development against the TypeScript source and the delivery boundary a change has to clear.

There is no operator audience. This is a local stdio process that your MCP client launches on your own machine, against your own Notion integration and your own notes — the person who creates the token is the person who publishes. Access levels and the audit log are therefore configuration choices in [Install and configure the mirror](user/installation.md), not a separate operator's concern.

## What lives elsewhere

A guide answers how. The neighbouring documentation roots answer the other questions, and a guide links to them rather than restating them:

- [Decision records](../decisions/) answer why, for the structural choices this repository has made.
- [Roadmap items](../roadmap/) answer when, covering behaviour that is planned rather than delivered.
- [`README.md`](../../README.md) is the capability catalogue: the verb model and the fourteen tools, with what each one returns.
- `mcp-ki-kb-notion-mirror-publish` with no arguments prints the complete CLI usage, including every flag. These guides explain the sequences and the choices between them; they do not repeat every option.
- [`CLAUDE.md`](../../CLAUDE.md) and [`AGENTS.md`](../../AGENTS.md) hold the standing conventions for working in this repository.
