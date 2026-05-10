import { db } from '../../db'
import { playlists, userPlaylists } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rows = await db
    .select({ playlist: playlists })
    .from(userPlaylists)
    .innerJoin(playlists, eq(userPlaylists.playlistId, playlists.id))
    .where(eq(userPlaylists.userId, user.id))

  return rows.map(r => r.playlist)
})
