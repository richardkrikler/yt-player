import { db } from '../../db'
import { videos, playlistItems, userPlaylists, playlistShares } from '../../db/schema'
import { eq, like, and, inArray, isNotNull } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { q } = getQuery(event)

  if (!q || typeof q !== 'string' || q.trim().length < 1) return []

  const ownedRows = await db
    .select({ playlistId: userPlaylists.playlistId })
    .from(userPlaylists)
    .where(eq(userPlaylists.userId, user.id))

  const sharedRows = await db
    .select({ playlistId: playlistShares.playlistId })
    .from(playlistShares)
    .where(eq(playlistShares.toUserId, user.id))

  const accessibleIds = [
    ...ownedRows.map(r => r.playlistId),
    ...sharedRows.map(r => r.playlistId),
  ]

  if (accessibleIds.length === 0) return []

  const rows = await db
    .selectDistinct({ channelTitle: videos.channelTitle })
    .from(videos)
    .innerJoin(playlistItems, eq(playlistItems.videoId, videos.id))
    .where(and(
      inArray(playlistItems.playlistId, accessibleIds),
      isNotNull(videos.channelTitle),
      like(videos.channelTitle, `%${q.trim()}%`),
    ))
    .limit(10)

  return rows.map(r => r.channelTitle as string)
})
