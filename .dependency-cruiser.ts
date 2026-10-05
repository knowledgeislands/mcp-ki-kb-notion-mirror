import type { IConfiguration } from 'dependency-cruiser'

/** One or more top-level areas under `src/`, matched as whole directories. */
const areas = (...names: readonly string[]) => `^src/(${names.join('|')})(/|$)`
/** Everything the repository owns; anything else is a dependency. */
const owned = '^src/'
const testFile = '\\.test\\.ts$'
const mcpSdk = '(^|/)node_modules/@modelcontextprotocol/'
/** The stdio MCP server and the `mcp-ki-kb-notion-mirror-publish` bin; `cli/index.ts` is a library barrel. */
const entrypoints = '^src/(mcp-server(/|$)|cli/cli\\.ts$)'

const config: IConfiguration = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'A cycle is two modules disagreeing about which of them is underneath.',
      severity: 'error',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-unresolvable',
      comment: 'Every rule matches resolved paths, so an unresolved import would cross any boundary unseen.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true }
    },
    {
      name: 'config-is-the-floor',
      comment:
        'Configuration is the only place the environment is read and a plain value every layer receives; it depends on no implementation that consumes it.',
      severity: 'error',
      from: { path: areas('config') },
      to: { path: owned, pathNot: areas('config') }
    },
    {
      name: 'utils-stay-shared',
      comment:
        "Helpers shared with sibling MCPs take config primitives, never this server's implementations, tools or entrypoints.",
      severity: 'error',
      from: { path: areas('utils') },
      to: { path: areas('main', 'tools', 'cli', 'mcp-server') }
    },
    {
      name: 'main-stays-transport-free',
      comment:
        'Implementations in main/ are usable from a script or the CLI: they never reach the tool layer, the operator surface, the entrypoints or the MCP SDK.',
      severity: 'error',
      from: { path: areas('main') },
      to: { path: `${areas('tools', 'cli', 'mcp-server')}|${mcpSdk}` }
    },
    {
      name: 'tools-stay-thin',
      comment:
        'A tool module validates arguments, confines paths and hands them to the main/ surface (each resource index, the note diff verb and the MirrorSettings type) or the cli/ library barrel, then maps the result to an envelope; logic reached past that surface escapes the tested implementation.',
      severity: 'error',
      from: { path: areas('tools'), pathNot: testFile },
      to: {
        path: owned,
        pathNot:
          '^src/(tools/|main/[^/]+/index\\.ts$|cli/index\\.ts$|main/notes/diff\\.ts$|main/trees/settings\\.ts$|config/index\\.ts$|utils/(annotations|notion-args|paths|results)\\.ts$)'
      }
    },
    {
      name: 'cli-stays-off-the-mcp-layer',
      comment:
        'The operator CLI drives main/ directly and does its own printing; it never reaches the MCP tool layer, the server entrypoint or the MCP SDK.',
      severity: 'error',
      from: { path: areas('cli') },
      to: { path: `${areas('tools', 'mcp-server')}|${mcpSdk}` }
    },
    {
      name: 'entrypoints-are-not-imported',
      comment:
        'The MCP server and the publish bin load configuration and start a process; nothing else may import them (the CLI test spawns the bin instead).',
      severity: 'error',
      from: { path: owned, pathNot: entrypoints },
      to: { path: entrypoints }
    },
    {
      name: 'generated-client-stays-unimported',
      comment:
        'The mcporter-emitted client is a consumer artefact regenerated from the running server; product source never depends on it.',
      severity: 'error',
      from: { path: owned, pathNot: areas('generated') },
      to: { path: areas('generated') }
    },
    {
      name: 'registration-tests-keep-the-tool-seam',
      comment:
        'Tool tests assert schemas, annotations, access gating and envelopes through the tool modules, with main/ mocked rather than imported.',
      severity: 'error',
      from: { path: `^src/tools/.+${testFile}` },
      to: { path: areas('main', 'cli', 'mcp-server') }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    // A type-only import crosses a boundary exactly as a value import does.
    tsPreCompilationDeps: true,
    // The MCP SDK and Zod resolve only through subpath exports.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'types', 'default'],
      extensions: ['.ts', '.js', '.mjs', '.cjs', '.d.ts', '.json']
    }
  }
}

export default config
