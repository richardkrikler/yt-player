import { db } from '../../../../db'
import { playlistItems, videos, userPlaylists, playlistShares } from '../../../../db/schema'
import { eq, and, gt, lt, asc, desc } from 'drizzle-orm'
import { requireAuth } from '../../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const { position, direction } = getQuery(event)

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()

  if (!owned) {
    const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
      .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, playlistId))).get()
    if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const pos = Number(position)
  const isPrev = direction === 'prev'

  const result = await db
    .select({ item: playlistItems, video: videos })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(and(
      eq(playlistItems.playlistId, playlistId),
      isPrev ? lt(playlistItems.position, pos) : gt(playlistItems.position, pos),
    ))
    .orderBy(isPrev ? desc(playlistItems.position) : asc(playlistItems.position))
    .limit(1)
    .get()

  if (!result) throw createError({ statusCode: 404, message: 'No more videos' })
  return result
})
