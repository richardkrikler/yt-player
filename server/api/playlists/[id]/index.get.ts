import { db } from '../../../db'
import { playlists, userPlaylists, playlistShares } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const id = getRouterParam(event, 'id')!

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, id))).get()

  if (!owned) {
    const shared = await db.select({ id: playlistShares.id }).from(playlistShares)
      .where(and(eq(playlistShares.toUserId, user.id), eq(playlistShares.playlistId, id))).get()
    if (!shared) throw createError({ statusCode: 403, message: 'Access denied' })
  }

  const playlist = await db.select().from(playlists).where(eq(playlists.id, id)).get()
  if (!playlist) throw createError({ statusCode: 404, message: 'Playlist not found' })

  return playlist
})
