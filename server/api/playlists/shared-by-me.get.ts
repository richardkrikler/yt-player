import { db } from '../../db'
import { playlists, playlistShares, users, userPlaylists } from '../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rows = await db
    .select({
      playlist: playlists,
      customTitle: userPlaylists.customTitle,
      sharedWith: {
        id: users.id,
        displayName: users.displayName,
        email: users.email,
      },
    })
    .from(playlistShares)
    .innerJoin(playlists, eq(playlistShares.playlistId, playlists.id))
    .innerJoin(users, eq(playlistShares.toUserId, users.id))
    .leftJoin(userPlaylists, and(
      eq(userPlaylists.playlistId, playlists.id),
      eq(userPlaylists.userId, user.id),
    ))
    .where(eq(playlistShares.fromUserId, user.id))

  return rows
})
