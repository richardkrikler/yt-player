import { db } from '../../../db'
import { userPlaylists } from '../../../db/schema'
import { eq, and } from 'drizzle-orm'
import { requireAuth } from '../../../utils/requireRole'

export default defineEventHandler(async (event) => {
  const user = await requireAuth(event)
  const playlistId = getRouterParam(event, 'id')!
  const { title } = await readBody<{ title: string }>(event)

  const owned = await db.select({ playlistId: userPlaylists.playlistId }).from(userPlaylists)
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId))).get()
  if (!owned) throw createError({ statusCode: 403, message: 'Access denied' })

  const customTitle = title?.trim() || null

  await db.update(userPlaylists)
    .set({ customTitle })
    .where(and(eq(userPlaylists.userId, user.id), eq(userPlaylists.playlistId, playlistId)))

  return { customTitle }
})
