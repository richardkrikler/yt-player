import { db } from '../../../db'
import { playlistShares } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireRole'

/** Allows the share recipient to remove their own access to a shared playlist. */
export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!

  await db.delete(playlistShares).where(
    and(
      eq(playlistShares.playlistId, playlistId),
      eq(playlistShares.toUserId, user.id),
    ),
  )

  return { ok: true }
})
