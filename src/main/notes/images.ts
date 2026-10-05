/** Opt-in local image rendering and rebuildable upload identity state. No canonical-note fields are added. */
import { createHash, randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Config } from '../../config/index.js'
import { resolveKbNotePath } from '../../utils/paths.js'
import { normalizeId, uploadImage } from '../notion-client/index.js'
import { renderNoteBody } from './render.js'

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
}
const PREFIX = 'https://ki-image.invalid/'
const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex')
export interface ImageAsset {
  marker: string
  hash: string
  filename: string
  mime: string
  bytes: Buffer
  alt: string
}
export interface ImageRender {
  blocks: unknown[]
  assets: ImageAsset[]
}

/** Render code-free Markdown references as stable digest placeholders; reads bytes but never uploads or writes state. */
export const renderImages = async (
  cfg: Config,
  abs: string,
  body: string,
  linkMap?: Record<string, string>
): Promise<ImageRender> => {
  if (!cfg.imagesEnabled) return { blocks: renderNoteBody(body, linkMap), assets: [] }
  const noteDir = await fs.realpath(path.dirname(abs))
  const kbRoot = await fs.realpath(cfg.kbRoot ?? noteDir)
  const sibling = path.join(noteDir, `${path.basename(abs, path.extname(abs))} - images`)
  const assets: ImageAsset[] = []
  let total = 0
  const unique = new Set<string>()
  // Code spans and fenced blocks remain literal. External images retain the existing renderer's behavior.
  const chunks = body.split(/(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g)
  for (let i = 0; i < chunks.length; i += 2) {
    const chunk = chunks[i]!
    const matches = [...chunk.matchAll(/!\[([^\]\n]*)\]\(([^)\n]+)\)/g)]
    let transformed = chunk
    for (const match of matches) {
      const ref = match[2]!.trim()
      if (/^https?:\/\//i.test(ref)) continue
      if (path.isAbsolute(ref) || ref.includes('\\') || ref.split('/').includes('..'))
        throw new Error('Image reference must name a confined sibling asset')
      const target = resolveKbNotePath(kbRoot, path.resolve(noteDir, ref))
      resolveKbNotePath(sibling, path.resolve(noteDir, ref))
      const mime = MIME[path.extname(target).toLowerCase()]
      if (!mime) throw new Error('Unsupported local image type')
      const stat = await fs.stat(target)
      if (!stat.isFile() || stat.size > 5 * 1024 * 1024) throw new Error('Image must be a file no larger than 5 MiB')
      const bytes = await fs.readFile(target)
      if (bytes.length > 5 * 1024 * 1024) throw new Error('Image grew beyond 5 MiB')
      if (!unique.has(target)) {
        unique.add(target)
        total += bytes.length
      }
      if (unique.size > 16 || total > 20 * 1024 * 1024) throw new Error('Note image budget exceeded')
      const hash = digest(bytes)
      const marker = `${PREFIX}${assets.length}/`
      assets.push({ marker, hash, filename: path.basename(target), mime, bytes, alt: match[1]! })
      transformed = transformed.replace(match[0], marker)
    }
    chunks[i] = transformed
  }
  const blocks = renderNoteBody(chunks.join(''), linkMap)
  const imageBlock = (asset: ImageAsset): unknown => ({
    object: 'block',
    type: 'image',
    image: {
      type: 'external',
      external: { url: `${PREFIX}${asset.hash}` },
      caption: asset.alt ? [{ type: 'text', text: { content: asset.alt } }] : []
    }
  })
  const replace = (node: unknown): unknown => {
    if (Array.isArray(node))
      return node.flatMap((item) => {
        const result = replace(item)
        return Array.isArray(result) ? result : [result]
      })
    if (!node || typeof node !== 'object') return node
    const record = node as Record<string, unknown>
    const container = record[record.type as string] as
      | { rich_text?: Array<{ text?: { content?: string } }> }
      | undefined
    const content = container?.rich_text?.map((item) => item.text?.content ?? '').join('')
    const selected = assets.filter((asset) => content?.includes(asset.marker))
    if (selected.length) {
      const richText = container!.rich_text!.map((item) =>
        item.text
          ? {
              ...item,
              text: {
                ...item.text,
                content: selected.reduce((text, asset) => text.replaceAll(asset.marker, ''), item.text.content!)
              }
            }
          : item
      )
      const retained = richText.some((item) => (item.text ? item.text.content!.trim() : true))
        ? [{ ...record, [record.type as string]: { ...container, rich_text: richText } }]
        : []
      return [...retained, ...selected.map(imageBlock)]
    }
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, replace(value)]))
  }
  return { blocks: replace(blocks) as unknown[], assets }
}

export interface UploadedImages {
  blocks: unknown[]
  persist: () => Promise<void>
}
/** Upload only on an actual push. State loss is safe: re-upload. Malformed state fails before mutation. */
export const uploadRenderedImages = async (
  cfg: Config,
  abs: string,
  pageId: string,
  rendered: ImageRender,
  fresh = false
): Promise<UploadedImages> => {
  if (rendered.assets.length === 0) return { blocks: rendered.blocks, persist: async () => {} }
  const stateDir = path.join(path.dirname(cfg.auditLogPath), 'image-uploads')
  const cachePath = path.join(stateDir, `${digest(JSON.stringify([abs, pageId, cfg.notionApiBaseUrl]))}.json`)
  let cache: Record<string, string> = {}
  try {
    cache = JSON.parse(await fs.readFile(cachePath, 'utf8')) as Record<string, string>
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
  if (
    !cache ||
    Array.isArray(cache) ||
    typeof cache !== 'object' ||
    Object.entries(cache).some(([key, value]) => !/^[a-f0-9]{64}$/.test(key) || typeof value !== 'string')
  )
    throw new Error('Invalid image upload cache')
  for (const id of Object.values(cache)) normalizeId(id)
  const current: Record<string, string> = {}
  for (const asset of rendered.assets)
    current[asset.hash] =
      current[asset.hash] ??
      (fresh ? undefined : cache[asset.hash]) ??
      (await uploadImage(cfg, asset.filename, asset.mime, asset.bytes))
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (!node || typeof node !== 'object') return node
    const record = node as Record<string, unknown>
    const image = record.image as { external?: { url?: string }; caption?: unknown } | undefined
    if (image?.external?.url?.startsWith(PREFIX))
      return {
        ...record,
        image: {
          type: 'file_upload',
          file_upload: { id: current[image.external.url.slice(PREFIX.length)] },
          caption: image.caption
        }
      }
    return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, rewrite(value)]))
  }
  return {
    blocks: rewrite(rendered.blocks) as unknown[],
    persist: async () => {
      await fs.mkdir(stateDir, { recursive: true, mode: 0o700 })
      const temp = `${cachePath}.${randomUUID()}.tmp`
      try {
        await fs.writeFile(temp, JSON.stringify(current), { mode: 0o600 })
        await fs.rename(temp, cachePath)
      } catch (err) {
        await fs.rm(temp, { force: true })
        throw err
      }
    }
  }
}
