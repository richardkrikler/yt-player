import { db } from '../../../../db'
import { playlistItems, videos, userPlaylists, playlistShares } from '../../../../db/schema'
import { eq, and, lt, count } from 'drizzle-orm'
import { requireAuth } from '../../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const { videoId } = getQuery(event)

  if (!videoId || typeof videoId !== 'string') {
    throw createError({ statusCode: 400, message: 'videoId required' })
  }

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
    .where(and(eq(playlistItems.playlistId, playlistId), eq(playlistItems.videoId, videoId)))
    .get()

  if (!result) throw createError({ statusCode: 404, message: 'Video not found in playlist' })

  const [{ rank }] = await db
    .select({ rank: count() })
    .from(playlistItems)
    .where(and(
      eq(playlistItems.playlistId, playlistId),
      lt(playlistItems.position, result.item.position),
    ))

  return { ...result, rank }
})
