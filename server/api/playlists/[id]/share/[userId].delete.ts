import { db } from '../../../../db'
import { userPlaylists, playlistShares } from '../../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const targetUserId = Number(getRouterParam(event, 'userId'))

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()
  if (!owned) throw createError({ statusCode: 403, message: 'You do not own this playlist' })

  await db.delete(playlistShares).where(
    and(
      eq(playlistShares.playlistId, playlistId),
      eq(playlistShares.toUserId, targetUserId),
    ),
  )

  return { ok: true }
})
