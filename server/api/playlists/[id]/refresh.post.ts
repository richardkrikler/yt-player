import { db } from '../../../db'
import { playlists, userPlaylists, playlistShares } from '../../../db/schema'
import { getYoutubeClientForPlaylist, getPublicYoutubeClient, clearYoutubeTokens } from '../../../utils/youtube'
import { requireAuth } from '../../../utils/requireRole'
import { eq, and } from 'drizzle-orm'

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

  try {
    const youtube = playlist.privacyStatus === 'public'
      ? getPublicYoutubeClient()
      : await getYoutubeClientForPlaylist(id)

    const res = await youtube.playlists.list({
      part: ['snippet', 'contentDetails', 'status'],
      id: [id],
    })

    const item = res.data.items?.[0]
    if (!item) throw createError({ statusCode: 404, message: 'Playlist not found on YouTube' })

    const [updated] = await db.update(playlists).set({
      title: item.snippet?.title ?? playlist.title,
      description: item.snippet?.description ?? null,
      itemCount: item.contentDetails?.itemCount ?? playlist.itemCount,
      thumbnailUrl: item.snippet?.thumbnails?.medium?.url ?? null,
      privacyStatus: item.status?.privacyStatus ?? null,
      metadataCachedAt: Date.now(),
    }).where(eq(playlists.id, id)).returning()

    return updated
  }
  catch (e: any) {
    if (e?.message === 'invalid_grant' || e?.statusCode === 401) {
      if (user.youtubeConnected) {
        await clearYoutubeTokens(user.id)
        await setUserSession(event, { user: { ...user, youtubeConnected: false } })
      }
      throw createError({ statusCode: 401, message: 'YouTube authorization expired. Please reconnect.' })
    }
    throw e
  }
})
