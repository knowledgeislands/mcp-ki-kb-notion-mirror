/**
 * Which CLI resource/verb combinations honour `--dry-run`.
 *
 * Only the archive verbs have a preview contract: they report what would be
 * archived without touching Notion. Every other mutating verb would ignore the
 * flag and write to Notion (and stamp local metadata), so an explicit
 * `--dry-run` on one of them is refused before any configuration is loaded or
 * any orchestration runs. Read-only verbs make no changes, so the flag is
 * harmless there and is accepted as before. Unknown verbs fall through to the
 * dispatcher's own usage error.
 */
const DRY_RUN_VERBS: Readonly<Record<string, readonly string[]>> = {
  note: ['delete'],
  tree: ['delete', 'prune'],
  roots: ['delete', 'prune']
}

const MUTATING_WITHOUT_PREVIEW: Readonly<Record<string, readonly string[]>> = {
  note: ['touch', 'update', 'move'],
  tree: ['touch', 'update', 'baseline'],
  roots: ['touch', 'update', 'publish', 'baseline']
}

/**
 * Returns a refusal message when `--dry-run` was supplied to a mutating verb
 * that cannot honour it, otherwise `null`.
 */
export const unsupportedDryRunError = (resource: string, verb: string, dryRun: boolean): string | null => {
  if (!dryRun || !MUTATING_WITHOUT_PREVIEW[resource]?.includes(verb)) return null
  const supported = Object.entries(DRY_RUN_VERBS)
    .flatMap(([res, verbs]) => verbs.map((v) => `${res} ${v}`))
    .join(', ')
  return `--dry-run is not supported for "${resource} ${verb}": it has no preview mode and would write to Notion. Nothing was changed. Remove --dry-run to run it for real; previews exist only for: ${supported}.`
}
