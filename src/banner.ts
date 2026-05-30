/**
 * The "Mirrored from Knowledge Base" banner prepended to every published page.
 *
 * The template comes from config (`MCP_NOTION_MIRROR_BANNER_TEMPLATE`, with a
 * KB-flavoured default). `{date}` interpolates the supplied UTC date. Markdown
 * `**bold**` / links in the template are honoured via martian's inline
 * converter. An empty template disables the banner entirely — `bannerBlock`
 * returns `undefined`, and the publish pipeline simply omits it.
 *
 * Rendered as a Notion `callout` block with the 📘 icon. (The icon is fixed; a
 * leading emoji is not expected in the template — see config DEFAULT_BANNER_TEMPLATE.)
 */
import { markdownToRichText } from '@tryfabric/martian'
import { BANNER_TEMPLATE } from './config.js'

const BANNER_ICON = '📘'

/** Build the banner callout for `dateStr` (YYYY-MM-DD), or `undefined` when disabled. */
export const bannerBlock = (dateStr: string): Record<string, unknown> | undefined => {
  if (BANNER_TEMPLATE === '') return undefined
  const text = BANNER_TEMPLATE.replaceAll('{date}', dateStr)
  return {
    object: 'block' as const,
    type: 'callout' as const,
    callout: {
      icon: { type: 'emoji' as const, emoji: BANNER_ICON },
      rich_text: markdownToRichText(text)
    }
  }
}
