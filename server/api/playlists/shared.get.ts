import { db } from '../../db'
import { playlists, playlistShares, users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAuth } from '../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)

  const rows = await db
    .select({
      playlist: playlists,
      sharedBy: {
        displayName: users.displayName,
        email: users.email,
      },
    })
    .from(playlistShares)
    .innerJoin(playlists, eq(playlistShares.playlistId, playlists.id))
    .innerJoin(users, eq(playlistShares.fromUserId, users.id))
    .where(eq(playlistShares.toUserId, user.id))

  return rows
})
