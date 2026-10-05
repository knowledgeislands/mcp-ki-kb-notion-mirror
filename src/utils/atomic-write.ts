import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/** Exclusive private staging; atomic per-file replacement preserving existing permissions. */
export const atomicWriteFile = async (filePath: string, contents: string): Promise<void> => {
  let mode = 0o600
  try {
    const target = await fs.lstat(filePath)
    if (!target.isFile() || target.isSymbolicLink()) throw new Error('Atomic write target must be a regular file.')
    mode = target.mode & 0o777
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const tmp = path.join(path.dirname(filePath), `.kb-notion-${randomUUID()}.tmp`)
  // Exclusive creation refuses collisions, including symlinks. A failure before
  // successful open owns nothing and must never delete someone else's path.
  const handle = await fs.open(
    tmp,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
    0o600
  )
  try {
    try {
      await handle.writeFile(contents, { encoding: 'utf8' })
      await handle.chmod(mode)
    } finally {
      await handle.close()
    }
    await fs.rename(tmp, filePath)
  } catch (error) {
    await fs.rm(tmp, { force: true })
    throw error
  }
}
