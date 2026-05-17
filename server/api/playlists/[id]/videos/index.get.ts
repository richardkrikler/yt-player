import { db } from '../../../../db'
import { playlistItems, videos, userPlaylists, playlistShares } from '../../../../db/schema'
import { eq, and, asc, count } from 'drizzle-orm'
import { requireAuth } from '../../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const { page = '1', limit = '50' } = getQuery(event)
  const offset = (Number(page) - 1) * Number(limit)

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()

  if (!owned) {
    const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
      .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, playlistId))).get()
    if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const [{ total }] = await db
    .select({ total: count() })
    .from(playlistItems)
    .where(eq(playlistItems.playlistId, playlistId))

  const results = await db
    .select({ item: playlistItems, video: videos })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.position))
    .limit(Number(limit))
    .offset(offset)

  return { total, results }
})
