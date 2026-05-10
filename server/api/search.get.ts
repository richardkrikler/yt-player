import { db, sqlite } from '../db'
import { videos, playlistItems, userPlaylists, playlistShares } from '../db/schema'
import { eq, and, inArray } from 'drizzle-orm'
import { requireAuth } from '../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const { q, playlist } = getQuery(event)

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw createError({ statusCode: 400, message: 'Query must be at least 2 characters' })
  }

  const ftsRows = sqlite.prepare(
    `SELECT id FROM videos_fts WHERE videos_fts MATCH ? ORDER BY rank LIMIT 50`,
  ).all(q.trim() + '*') as { id: string }[]

  const videoIds = ftsRows.map(r => r.id)
  if (videoIds.length === 0) return []

  if (playlist && typeof playlist === 'string') {
    const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
      .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlist))).get()

    if (!owned) {
      const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
        .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, playlist))).get()
      if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
    }

    return db.select({ item: playlistItems, video: videos })
      .from(playlistItems)
      .innerJoin(videos, eq(playlistItems.videoId, videos.id))
      .where(and(eq(playlistItems.playlistId, playlist), inArray(videos.id, videoIds)))
  }

  // global search — only accessible playlists
  const ownedPlaylists = await db.select({ playlistId: userPlaylists.playlistId })
    .from(userPlaylists).where(eq(userPlaylists.userId, user.id))

  const sharedPlaylists = await db.select({ playlistId: playlistShares.playlistId })
    .from(playlistShares).where(eq(playlistShares.toUserId, user.id))

  const accessibleIds = [
    ...ownedPlaylists.map(p => p.playlistId),
    ...sharedPlaylists.map(p => p.playlistId),
  ]

  if (accessibleIds.length === 0) return []

  return db.select({ item: playlistItems, video: videos })
    .from(playlistItems)
    .innerJoin(videos, eq(playlistItems.videoId, videos.id))
    .where(and(
      inArray(playlistItems.playlistId, accessibleIds),
      inArray(videos.id, videoIds),
    ))
})
