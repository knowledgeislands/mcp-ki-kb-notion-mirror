/**
 * Result shapes shared by the tree verbs (`index.ts`) and the git-driven prune
 * (`prune.ts`). They live apart from both so prune can name them without
 * importing the module that re-exports it; `index.ts` re-exports them unchanged.
 */

/** The outcome of acting on a single note during a tree op. */
export interface NoteOutcome {
  kbPath: string
  action: 'touch' | 'update' | 'delete' | 'skip' | 'plan' | 'baseline' | 'error'
  url?: string
  error?: string
}

export interface TreeResult {
  eligible: number
  outcomes: NoteOutcome[]
}
