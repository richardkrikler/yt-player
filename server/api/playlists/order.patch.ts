import { sqlite } from '../../db'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { ids } = await readBody<{ ids: string[] }>(event)

  if (!Array.isArray(ids)) {
    throw createError({ statusCode: 400, message: 'ids must be an array' })
  }

  // better-sqlite3 is synchronous — use its transaction directly
  const stmt = sqlite.prepare(
    `UPDATE user_playlists SET position = ? WHERE user_id = ? AND playlist_id = ?`,
  )
  sqlite.transaction(() => {
    for (let i = 0; i < ids.length; i++) {
      stmt.run(i, user.id, ids[i])
    }
  })()

  return { ok: true }
})
