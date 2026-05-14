import { db } from '../../db'
import { playlists, userPlaylists } from '../../db/schema'
import { eq, asc, sql } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rows = await db
    .select({ playlist: playlists, customTitle: userPlaylists.customTitle })
    .from(userPlaylists)
    .innerJoin(playlists, eq(userPlaylists.playlistId, playlists.id))
    .where(eq(userPlaylists.userId, user.id))
    // NULL positions sort last (not yet manually ordered), then by add time
    .orderBy(sql`${userPlaylists.position} IS NULL`, asc(userPlaylists.position), asc(userPlaylists.addedAt))

  return rows.map(r => ({ ...r.playlist, customTitle: r.customTitle }))
})
