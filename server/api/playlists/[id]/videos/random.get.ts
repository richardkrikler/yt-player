import { db } from '../../../../db'
import { playlistItems, videos, userPlaylists, playlistShares } from '../../../../db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { requireAuth } from '../../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()

  if (!owned) {
    const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
      .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, playlistId))).get()
    if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const result = await db
    .select({ item: playlistItems, video: videos })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(sql`RANDOM()`)
    .limit(1)
    .get()

  if (!result) throw createError({ statusCode: 404, message: 'No videos in playlist' })
  return result
})
