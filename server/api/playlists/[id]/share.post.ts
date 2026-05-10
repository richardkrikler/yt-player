import { db } from '../../../db'
import { users, userPlaylists, playlistShares } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const { email } = await readBody<{ email: string }>(event)

  if (!email) throw createError({ statusCode: 400, message: 'email is required' })

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()
  if (!owned) throw createError({ statusCode: 403, message: 'You do not own this playlist' })

  const target = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).get()
  if (!target) throw createError({ statusCode: 404, message: 'User not found' })
  if (target.id === user.id) throw createError({ statusCode: 400, message: 'Cannot share with yourself' })

  await db.insert(playlistShares).values({
    playlistId,
    fromUserId: user.id,
    toUserId: target.id,
    sharedAt: Date.now(),
  }).onConflictDoNothing()

  return { ok: true }
})
