/** The one pure body-rendering path used by update, baseline, and diff. */
import { bodyToBlocks } from './markdown.js'
import { convertMentionPlaceholders, rewriteWikilinks } from './wikilinks.js'

export const renderNoteBody = (body: string, linkMap: Record<string, string> = {}): unknown[] =>
  convertMentionPlaceholders(bodyToBlocks(rewriteWikilinks(body, linkMap))) as unknown[]
