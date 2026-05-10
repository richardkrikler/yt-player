import { db } from '../../../db'
import { playlists, users } from '../../../db/schema'
import { eq } from 'drizzle-orm'
import { requireAdmin } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return db.select({
    playlist: playlists,
    owner: {
      id: users.id,
      email: users.email,
      displayName: users.displayName,
    },
  })
    .from(playlists)
    .innerJoin(users, eq(playlists.ownerUserId, users.id))
})
