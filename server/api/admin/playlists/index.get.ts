import { db } from '../../../db'
import { playlists, userPlaylists } from '../../../db/schema'
import { eq, sql } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return db.select({
    playlist: playlists,
    userCount: sql<number>`count(${userPlaylists.userId})`,
  })
    .from(playlists)
    .leftJoin(userPlaylists, eq(userPlaylists.playlistId, playlists.id))
    .groupBy(playlists.id)
})
